import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { createXRStore, XR, XRDomOverlay, useXRHitTest, XROrigin } from '@react-three/xr';
import * as THREE from 'three';
import { createFurnitureShape } from '../ar/shapeLibrary';
import { useFurnitureStore } from '../stores/furnitureStore';
import { useSessionStore } from '../stores/sessionStore';
import Spinner from '../components/Spinner';
import { fontFamily, numeric } from '../components/tokens';
import { findOversizedFurniture } from '../utils/furnitureValidation';
import type { FurnitureItem } from '../types';

const xrPlacementStore = createXRStore({
  offerSession: false,
  emulate: false,
  hitTest: true,
  domOverlay: true,
});

const hitMatrix = new THREE.Matrix4();

function isPositioned(item: FurnitureItem): boolean {
  return item.posX !== 0 || item.posZ !== 0;
}

function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function makeLabelTexture(label: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;

  const context = canvas.getContext('2d');
  if (context) {
    context.fillStyle = 'rgba(17, 24, 39, 0.88)';
    context.roundRect(12, 18, 488, 92, 18);
    context.fill();
    context.fillStyle = '#ffffff';
    context.font = '700 38px Inter, Arial, sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(label.slice(0, 22), 256, 64);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function FloatingLabel({
  label,
  y,
}: {
  label: string;
  y: number;
}) {
  const texture = useMemo(() => makeLabelTexture(label), [label]);

  useEffect(() => () => texture.dispose(), [texture]);

  return (
    <sprite position={[0, y, 0]} scale={[0.7, 0.18, 1]}>
      <spriteMaterial map={texture} transparent depthTest={false} />
    </sprite>
  );
}

function PlacementMesh({
  item,
  position,
  rotationY,
  mode,
  showLabel = false,
}: {
  item: FurnitureItem;
  position: { x: number; y?: number; z: number };
  rotationY: number;
  mode: 'ghost' | 'placed';
  showLabel?: boolean;
}) {
  const { geometry, boundingBox } = useMemo(
    () =>
      createFurnitureShape(item.shape, {
        lengthCm: item.lengthCm,
        widthCm: item.widthCm,
        heightCm: item.heightCm,
      }),
    [item.heightCm, item.lengthCm, item.shape, item.widthCm],
  );

  useEffect(() => () => geometry.dispose(), [geometry]);

  const opacity = mode === 'ghost' ? 0.55 : 0.95;
  const meshY = (position.y ?? 0) + boundingBox.heightM / 2;
  const labelY = (position.y ?? 0) + boundingBox.heightM + 0.22;

  return (
    <group position={[position.x, meshY, position.z]} rotation={[0, rotationY, 0]}>
      <mesh geometry={geometry}>
        <meshStandardMaterial
          color={mode === 'ghost' ? '#38bdf8' : '#2B4E8C'}
          roughness={0.45}
          metalness={0.05}
          transparent={mode === 'ghost'}
          opacity={opacity}
          depthWrite={mode !== 'ghost'}
        />
      </mesh>
      {showLabel && <FloatingLabel label={item.label} y={labelY} />}
    </group>
  );
}

function PlacementScene({
  activeItem,
  lockedPosition,
  previewPosition,
  rotationY,
  placing,
  onPreviewMove,
  onFloorTap,
}: {
  activeItem: FurnitureItem | null;
  lockedPosition: { x: number; y: number; z: number } | null;
  previewPosition: { x: number; y: number; z: number } | null;
  rotationY: number;
  placing: boolean;
  onPreviewMove: (position: { x: number; y: number; z: number }) => void;
  onFloorTap: (position: { x: number; y: number; z: number }) => void;
}) {
  const latestHitRef = useRef<{ x: number; y: number; z: number } | null>(null);

  useXRHitTest(
    useCallback(
      (results, getWorldMatrix) => {
        if (!activeItem || !placing || results.length === 0) return;

        const hasMatrix = getWorldMatrix(hitMatrix, results[0]);
        if (!hasMatrix) return;

        const point = new THREE.Vector3().setFromMatrixPosition(hitMatrix);
        const position = { x: point.x, y: point.y, z: point.z };
        latestHitRef.current = position;
        onPreviewMove(position);
      },
      [activeItem, onPreviewMove, placing],
    ),
    'viewer',
  );

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest('button, input, select, textarea')) return;
      if (!activeItem || !placing || !latestHitRef.current) return;
      onFloorTap(latestHitRef.current);
    }

    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [activeItem, onFloorTap, placing]);

  const currentPos = placing ? previewPosition : lockedPosition;

  return (
    <>
      <ambientLight intensity={1.5} />
      <directionalLight position={[3, 5, 3]} intensity={1.0} />
      <XROrigin />

      {activeItem && currentPos && (
        <PlacementMesh
          item={activeItem}
          position={currentPos}
          rotationY={rotationY}
          mode={placing ? 'ghost' : 'placed'}
          showLabel={!placing}
        />
      )}
    </>
  );
}

export default function PositionMapScreen() {
  const navigateTo = useSessionStore((s) => s.navigateTo);
  const items = useFurnitureStore((s) => s.items);
  const updateItem = useFurnitureStore((s) => s.updateItem);

  const [arActive, setArActive] = useState(false);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [previewPosition, setPreviewPosition] = useState<{ x: number; y: number; z: number } | null>(null);
  const [lockedPosition, setLockedPosition] = useState<{ x: number; y: number; z: number } | null>(null);
  const [rotationDeg, setRotationDeg] = useState(0);
  const [placing, setPlacing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [arInitializing, setArInitializing] = useState(false);
  const [oversizedWarningItem, setOversizedWarningItem] = useState<FurnitureItem | null>(null);

  useEffect(() => {
    return xrPlacementStore.subscribe((state, prevState) => {
      if (state.session === prevState.session) return;
      setArActive(state.session != null);
      if (state.session == null) {
        setActiveItemId(null);
        setPreviewPosition(null);
        setLockedPosition(null);
        setPlacing(false);
        setOversizedWarningItem(null);
      }
    });
  }, []);

  function handleReviewDimensions() {
    setOversizedWarningItem(null);
    if (arActive) {
      stopAR();
    }
    navigateTo('furnitureInput');
  }

  function handleCancelOversized() {
    setOversizedWarningItem(null);
  }

  function handleProceedToWorkspace() {
    const oversized = findOversizedFurniture(items);
    if (oversized) {
      setOversizedWarningItem(oversized);
      return;
    }
    navigateTo('workspace');
  }

  const activeItem = items.find((item) => item.id === activeItemId) ?? null;
  const rotationY = degreesToRadians(rotationDeg);
  const unpositionedItems = items.filter((item) => !isPositioned(item));
  const positionedItems = items.filter(isPositioned);

  async function startPlacement(item: FurnitureItem) {
    setErrorMsg('');
    setActiveItemId(item.id);
    setPreviewPosition(null);
    setLockedPosition(null);
    setRotationDeg(0);
    setPlacing(true);
    setArInitializing(true);

    try {
      await xrPlacementStore.enterAR();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setErrorMsg(message);
      setActiveItemId(null);
      setPlacing(false);
    } finally {
      setArInitializing(false);
    }
  }

  function stopAR() {
    xrPlacementStore.getState().session?.end();
    setArActive(false);
    setActiveItemId(null);
    setPreviewPosition(null);
    setLockedPosition(null);
    setPlacing(false);
  }

  function handleFloorTap(position: { x: number; y: number; z: number }) {
    setLockedPosition(position);
    setPreviewPosition(position);
    setPlacing(false);
  }

  function handleReplace() {
    setPlacing(true);
    setLockedPosition(null);
  }

  function confirmPlacement() {
    if (!activeItem || !lockedPosition) return;

    // End the AR session cleanly
    stopAR();

    // Safe 2D Handoff:
    // Dispatch item to furnitureStore using hardcoded safe coordinates for the Living Room center (posX: 130, posZ: 520, roomId: 'living').
    // In meters: posX: 1.3 (130cm), posZ: 5.2 (520cm).
    updateItem(activeItem.id, {
      posX: 1.3,
      posZ: 5.2,
      roomId: 'living',
      rotationY,
    });

    // Route user directly to 2D workspace
    navigateTo('workspace');
  }

  return (
    <>
      <div className="screen">
        <div className="screen-header">
          <button className="back-btn" onClick={() => navigateTo('furnitureInput')} aria-label="Go back">
            ←
          </button>
          <div className="screen-header-info">
            <span className="step-label">Step 2 of 2</span>
            <h2>Position Furniture</h2>
          </div>
        </div>

        <div className="progress-bar">
          <div className="progress-step completed" />
          <div className="progress-step active" />
        </div>

        {errorMsg && (
          <div className="card" style={{ borderColor: 'var(--danger-border)', background: 'var(--danger-bg)' }}>
            <p className="card-title" style={{ color: 'var(--danger)' }}>AR Placement Notice</p>
            <p className="form-error" style={{ marginBottom: 0 }}>{errorMsg}</p>
          </div>
        )}

        {items.length === 0 ? (
          <div className="card">
            <p className="card-title">No Furniture Added</p>
            <p className="card-subtitle">Add furniture items first to position them on the physical floor.</p>
            <button
              className="btn btn-primary"
              onClick={() => navigateTo('furnitureInput')}
              style={{ marginTop: 'var(--space-md)' }}
            >
              Add Furniture
            </button>
          </div>
        ) : (
          <>
            <div className="card">
              <div className="card-header">
                <div className="card-icon card-icon-success">AR</div>
                <div>
                  <p className="card-title">AR Floor Placement</p>
                  <p className="card-subtitle">
                    Tap "Place in room" to place your furniture directly on the floor with AR hit-testing. After placing, you will proceed directly to the 2D workspace to fine-tune.
                  </p>
                </div>
              </div>
              <button className="btn btn-primary" onClick={handleProceedToWorkspace}>
                Open 2D Workspace
              </button>
            </div>

            {unpositionedItems.length > 0 && (
              <>
                <div className="card card-sm">
                  <p className="card-title">Items Needing Placement ({unpositionedItems.length})</p>
                  <p className="card-subtitle">
                    Select a piece to place it on your room floor in AR.
                  </p>
                </div>

                {unpositionedItems.map((item) => (
                  <div className="card" key={item.id}>
                    <div className="card-header">
                      <div className="card-icon card-icon-primary">{item.label.slice(0, 1).toUpperCase()}</div>
                      <div>
                        <p className="card-title">{item.label}</p>
                        <p className="card-subtitle">
                          {item.shape} | {item.lengthCm} × {item.widthCm} × {item.heightCm} cm
                        </p>
                      </div>
                    </div>
                    <button
                      className="btn btn-primary"
                      onClick={() => startPlacement(item)}
                      disabled={arInitializing}
                    >
                      {arInitializing && activeItemId === item.id ? (
                        <>
                          <Spinner />
                          Setting up AR camera…
                        </>
                      ) : (
                        'Place in room'
                      )}
                    </button>
                  </div>
                ))}
              </>
            )}

            {positionedItems.length > 0 && (
              <>
                <div className="card card-sm">
                  <p className="card-title">Placed Items ({positionedItems.length})</p>
                  <p className="card-subtitle">
                    These items are already positioned in the layout.
                  </p>
                </div>

                {positionedItems.map((item) => (
                  <div className="card" key={item.id}>
                    <div className="card-header">
                      <div className="card-icon card-icon-secondary">{item.label.slice(0, 1).toUpperCase()}</div>
                      <div>
                        <p className="card-title">{item.label}</p>
                        <p className="card-subtitle">
                          {item.shape} | {item.lengthCm} × {item.widthCm} × {item.heightCm} cm
                        </p>
                      </div>
                    </div>
                    <button
                      className="btn btn-secondary"
                      onClick={() => startPlacement(item)}
                      disabled={arInitializing}
                    >
                      {arInitializing && activeItemId === item.id ? (
                        <>
                          <Spinner />
                          Setting up AR camera…
                        </>
                      ) : (
                        'Re-place in AR'
                      )}
                    </button>
                  </div>
                ))}
              </>
            )}
          </>
        )}

        {/* 2D Oversized Furniture Warning Modal */}
        {oversizedWarningItem && !arActive && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 10000,
              background: 'rgba(0, 0, 0, 0.65)',
              backdropFilter: 'blur(4px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 20,
            }}
          >
            <div className="card" style={{ maxWidth: 440, width: '100%', margin: 0, boxShadow: '0 20px 40px rgba(0,0,0,0.3)' }}>
              <div className="card-header">
                <div className="card-icon card-icon-warning">⚠️</div>
                <div>
                  <h3 className="card-title" style={{ fontSize: 18, margin: 0 }}>Check Furniture Size</h3>
                </div>
              </div>
              <p style={{ margin: '10px 0 8px', fontSize: 14, lineHeight: 1.5, color: 'var(--text-primary)' }}>
                This furniture appears unusually large for the Living/Dining area.
                Please review its dimensions.
              </p>
              <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--text-muted)' }}>
                <strong>{oversizedWarningItem.label}</strong> ({oversizedWarningItem.lengthCm} × {oversizedWarningItem.widthCm} × {oversizedWarningItem.heightCm} cm)
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: 10 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleCancelOversized}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleReviewDimensions}
                >
                  Review Dimensions
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* AR Fullscreen Canvas */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: arActive ? 9999 : -1,
          visibility: arActive ? 'visible' : 'hidden',
          pointerEvents: arActive ? 'auto' : 'none',
        }}
      >
        <Canvas style={{ position: 'absolute', inset: 0 }} gl={{ antialias: true, alpha: true }}>
          <XR store={xrPlacementStore}>
            {activeItem && (
              <PlacementScene
                activeItem={activeItem}
                lockedPosition={lockedPosition}
                previewPosition={previewPosition}
                rotationY={rotationY}
                placing={placing}
                onPreviewMove={setPreviewPosition}
                onFloorTap={handleFloorTap}
              />
            )}

            <XRDomOverlay>
              <div
                style={{
                  position: 'fixed',
                  inset: 0,
                  pointerEvents: 'none',
                  fontFamily,
                }}
              >
                {/* Top bar with item label & exit */}
                <div
                  style={{
                    position: 'absolute',
                    top: 16,
                    left: 16,
                    right: 16,
                    display: 'flex',
                    gap: 12,
                    alignItems: 'flex-start',
                    pointerEvents: 'auto',
                  }}
                >
                  <div
                    style={{
                      flex: 1,
                      background: 'rgba(17, 24, 39, 0.88)',
                      backdropFilter: 'blur(8px)',
                      color: 'white',
                      padding: '12px 14px',
                      borderRadius: 10,
                      fontSize: 13,
                      lineHeight: 1.45,
                    }}
                  >
                    <strong>{activeItem?.label ?? 'Furniture placement'}</strong>
                    <br />
                    {placing
                      ? 'Move your phone until the preview sits on your floor, then tap the floor to place.'
                      : 'Adjust rotation to match your room, then tap Confirm placement.'}
                  </div>
                  <button
                    type="button"
                    onClick={stopAR}
                    style={{
                      background: '#ef4444',
                      color: 'white',
                      border: 0,
                      borderRadius: 8,
                      minHeight: 44,
                      padding: '0 16px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Exit
                  </button>
                </div>

                {/* Bottom guide during placing */}
                {placing && (
                  <div
                    style={{
                      position: 'absolute',
                      left: 16,
                      right: 16,
                      bottom: 24,
                      display: 'flex',
                      justifyContent: 'center',
                      pointerEvents: 'none',
                    }}
                  >
                    <div
                      style={{
                        background: 'rgba(17, 24, 39, 0.82)',
                        backdropFilter: 'blur(8px)',
                        color: '#ffffff',
                        padding: '10px 18px',
                        borderRadius: 20,
                        fontSize: 13,
                        fontWeight: 600,
                        boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
                      }}
                    >
                      Tap the physical floor to place
                    </div>
                  </div>
                )}

                {/* Bottom control: Rotation & Confirmation when locked */}
                {!placing && lockedPosition && (
                  <div
                    style={{
                      position: 'absolute',
                      left: 16,
                      right: 16,
                      bottom: 24,
                      background: 'rgba(17, 24, 39, 0.94)',
                      backdropFilter: 'blur(10px)',
                      color: '#ffffff',
                      borderRadius: 14,
                      padding: 16,
                      boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
                      pointerEvents: 'auto',
                    }}
                  >
                    <label
                      htmlFor="rotation-slider"
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: 13,
                        fontWeight: 700,
                        marginBottom: 8,
                      }}
                    >
                      Rotation
                      <span style={numeric}>{rotationDeg}°</span>
                    </label>
                    <input
                      id="rotation-slider"
                      type="range"
                      min="0"
                      max="360"
                      step="1"
                      value={rotationDeg}
                      onChange={(event) => setRotationDeg(Number(event.target.value))}
                      style={{ width: '100%', marginBottom: 14 }}
                    />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={handleReplace}
                        style={{ minHeight: 46 }}
                      >
                        Re-place
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={confirmPlacement}
                        disabled={!lockedPosition}
                        style={{ minHeight: 46 }}
                      >
                        Confirm placement
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </XRDomOverlay>
          </XR>
        </Canvas>
      </div>
    </>
  );
}
