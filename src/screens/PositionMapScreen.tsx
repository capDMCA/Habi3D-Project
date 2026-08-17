import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { createXRStore, XR, XRDomOverlay, useXRHitTest, XROrigin } from '@react-three/xr';
import * as THREE from 'three';
import { createFurnitureShape } from '../ar/shapeLibrary';
import {
  deriveCalibration,
  applyCalibration,
  invertCalibration,
  calibrationThetaRad,
  type ArPoint,
  type CalibrationTransform,
} from '../ar/calibration';
import { useFurnitureStore } from '../stores/furnitureStore';
import { useSessionStore } from '../stores/sessionStore';
import { fontFamily } from '../components/tokens';
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

function radiansToDegrees(radians: number): number {
  const degrees = (radians * 180) / Math.PI;
  return Math.round(((degrees % 360) + 360) % 360);
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
  position: { x: number; z: number };
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

  const opacity = mode === 'ghost' ? 0.5 : 0.9;
  const meshY = boundingBox.heightM / 2;
  const labelY = boundingBox.heightM + 0.22;

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
  items,
  activeItem,
  lockedPosition,
  rotationY,
  placing,
  onPreviewMove,
  onFloorTap,
  calibration,
}: {
  items: FurnitureItem[];
  activeItem: FurnitureItem | null;
  lockedPosition: { x: number; z: number } | null;
  rotationY: number;
  placing: boolean;
  onPreviewMove: (position: { x: number; z: number }) => void;
  onFloorTap: (position: { x: number; z: number }) => void;
  /** Already-placed items (placedItems below) are stored in the 2D plan's
   *  frame — this session's own hit-tests are still raw AR-local. Rendering
   *  them correctly in the live AR view means converting plan-frame back to
   *  this session's AR-local space, the inverse of what onFloorTap/
   *  confirmPlacement do on the way in. */
  calibration: CalibrationTransform;
}) {
  const latestHitRef = useRef<{ x: number; z: number } | null>(null);
  const placedItems = items.filter((item) => isPositioned(item) && item.id !== activeItem?.id);
  const thetaRad = calibrationThetaRad(calibration);

  useXRHitTest(
    useCallback(
      (results, getWorldMatrix) => {
        if (!activeItem || !placing || results.length === 0) return;

        const hasMatrix = getWorldMatrix(hitMatrix, results[0]);
        if (!hasMatrix) return;

        const point = new THREE.Vector3().setFromMatrixPosition(hitMatrix);
        const position = { x: point.x, z: point.z };
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

  return (
    <>
      <ambientLight intensity={1.4} />
      <directionalLight position={[3, 5, 3]} intensity={0.9} />
      <XROrigin />

      {placedItems.map((item) => (
        <PlacementMesh
          key={item.id}
          item={item}
          position={invertCalibration({ x: item.posX, z: item.posZ }, calibration)}
          rotationY={item.rotationY - thetaRad}
          mode="placed"
          showLabel
        />
      ))}

      {activeItem && lockedPosition && (
        <PlacementMesh
          item={activeItem}
          position={lockedPosition}
          rotationY={rotationY}
          mode={placing ? 'ghost' : 'placed'}
          showLabel={!placing}
        />
      )}
    </>
  );
}

/** A small marker at the first (corner) calibration tap, so the user can
 *  see it registered while aiming the second tap. */
function CalibrationMarker({ position }: { position: ArPoint }) {
  return (
    <mesh position={[position.x, 0.02, position.z]}>
      <sphereGeometry args={[0.05, 16, 16]} />
      <meshStandardMaterial color="#2563EB" />
    </mesh>
  );
}

/**
 * Captures the two calibration taps before any furniture placement is
 * allowed. Structurally the same hit-test → pointerdown-tap pattern
 * PlacementScene uses below, just driving two reference points instead of
 * a furniture position.
 */
function CalibrationScene({
  step,
  cornerPoint,
  onTapCorner,
  onTapWall,
}: {
  step: 'corner' | 'wall';
  cornerPoint: ArPoint | null;
  onTapCorner: (p: ArPoint) => void;
  onTapWall: (p: ArPoint) => void;
}) {
  const latestHitRef = useRef<ArPoint | null>(null);

  useXRHitTest(
    useCallback((results, getWorldMatrix) => {
      if (results.length === 0) return;
      const hasMatrix = getWorldMatrix(hitMatrix, results[0]);
      if (!hasMatrix) return;
      const point = new THREE.Vector3().setFromMatrixPosition(hitMatrix);
      latestHitRef.current = { x: point.x, z: point.z };
    }, []),
    'viewer',
  );

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest('button, input, select, textarea')) return;
      const hit = latestHitRef.current;
      if (!hit) return;
      if (step === 'corner') onTapCorner(hit);
      else onTapWall(hit);
    }

    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [step, onTapCorner, onTapWall]);

  return (
    <>
      <ambientLight intensity={1.4} />
      <directionalLight position={[3, 5, 3]} intensity={0.9} />
      <XROrigin />
      {cornerPoint && <CalibrationMarker position={cornerPoint} />}
    </>
  );
}

export default function PositionMapScreen() {
  const navigateTo = useSessionStore((s) => s.navigateTo);
  const items = useFurnitureStore((s) => s.items);
  const updatePosition = useFurnitureStore((s) => s.updatePosition);

  const [arActive, setArActive] = useState(false);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [previewPosition, setPreviewPosition] = useState<{ x: number; z: number } | null>(null);
  const [lockedPosition, setLockedPosition] = useState<{ x: number; z: number } | null>(null);
  const [rotationDeg, setRotationDeg] = useState(0);
  const [placing, setPlacing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Calibration — once per AR session (see the subscribe effect below,
  // which clears all of this the moment the session ends). Placement is
  // gated on `calibration` being non-null; see the render below.
  const [calibration, setCalibration] = useState<CalibrationTransform | null>(null);
  const [calibrationStep, setCalibrationStep] = useState<'corner' | 'wall'>('corner');
  const [cornerPoint, setCornerPoint] = useState<ArPoint | null>(null);
  const [calibrationError, setCalibrationError] = useState('');

  useEffect(() => {
    return xrPlacementStore.subscribe((state, prevState) => {
      if (state.session === prevState.session) return;
      setArActive(state.session != null);
      if (state.session == null) {
        // Session ended — its reference space is gone with it. Next entry
        // is a fresh session with an unrelated origin/heading, so
        // calibration must run again before any placement is allowed.
        setCalibration(null);
        setCalibrationStep('corner');
        setCornerPoint(null);
        setCalibrationError('');
      }
    });
  }, []);

  const handleTapCorner = useCallback((p: ArPoint) => {
    setCornerPoint(p);
    setCalibrationStep('wall');
  }, []);

  const handleTapWall = useCallback(
    (p: ArPoint) => {
      if (!cornerPoint) return;
      const transform = deriveCalibration(cornerPoint, p);
      if (!transform) {
        setCalibrationError("That's too close to the corner — step further along the north wall and tap again.");
        return;
      }
      setCalibrationError('');
      setCalibration(transform);
    },
    [cornerPoint],
  );

  function retryCalibration() {
    setCalibrationStep('corner');
    setCornerPoint(null);
    setCalibrationError('');
  }

  const unpositionedItems = items.filter((item) => !isPositioned(item));
  const activeItem = items.find((item) => item.id === activeItemId) ?? null;
  const rotationY = degreesToRadians(rotationDeg);
  const visibleActivePosition = placing ? previewPosition : lockedPosition;
  const allPlaced = items.length > 0 && unpositionedItems.length === 0 && !activeItem;

  async function startPlacement(item: FurnitureItem) {
    setErrorMsg('');
    setActiveItemId(item.id);
    setPreviewPosition(null);
    setLockedPosition(isPositioned(item) ? { x: item.posX, z: item.posZ } : null);
    setRotationDeg(radiansToDegrees(item.rotationY));
    setPlacing(true);

    try {
      await xrPlacementStore.enterAR();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setErrorMsg(message);
      setActiveItemId(null);
      setPlacing(false);
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

  function handleFloorTap(position: { x: number; z: number }) {
    setLockedPosition(position);
    setPreviewPosition(position);
    setPlacing(false);
  }

  function handleReplace() {
    setPlacing(true);
    setLockedPosition(null);
  }

  function confirmPlacement() {
    if (!activeItem || !lockedPosition || !calibration) return;

    // The write path: lockedPosition/rotationY are this session's raw
    // AR-local values (correct for what the live ghost mesh showed) —
    // convert to the 2D plan's frame before it ever reaches furnitureStore.
    const planPosition = applyCalibration(lockedPosition, calibration);
    const planRotationY = rotationY + calibrationThetaRad(calibration);
    updatePosition(activeItem.id, planPosition.x, planPosition.z, planRotationY);

    const remainingAfterConfirm = items.filter(
      (item) => item.id !== activeItem.id && !isPositioned(item),
    );

    setActiveItemId(null);
    setPreviewPosition(null);
    setLockedPosition(null);
    setPlacing(false);

    if (remainingAfterConfirm.length === 0) {
      stopAR();
      return;
    }

    const nextItem = remainingAfterConfirm[0];
    setActiveItemId(nextItem.id);
    setRotationDeg(radiansToDegrees(nextItem.rotationY));
    setPlacing(true);
  }

  return (
    <>
      <div className="screen">
        <div className="screen-header">
          <button className="back-btn" onClick={() => navigateTo('furnitureInput')} aria-label="Go back">
            &lt;
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
            <p className="card-title" style={{ color: 'var(--danger)' }}>AR Placement Failed</p>
            <p className="form-error" style={{ marginBottom: 0 }}>{errorMsg}</p>
          </div>
        )}

        {items.length === 0 && (
          <div className="card">
            <p className="card-title">No Furniture Added</p>
            <p className="card-subtitle">Add furniture dimensions before mapping positions.</p>
            <button
              className="btn btn-primary"
              onClick={() => navigateTo('furnitureInput')}
              style={{ marginTop: 'var(--space-md)' }}
            >
              Add Furniture
            </button>
          </div>
        )}

        {allPlaced && (
          <div className="card">
            <div className="card-header">
              <div className="card-icon card-icon-success">OK</div>
              <div>
                <p className="card-title">{items.length} items placed in your room</p>
                <p className="card-subtitle">Positions and rotations are stored for analysis.</p>
              </div>
            </div>
            <button className="btn btn-primary" onClick={() => navigateTo('analysis')}>
              Analyse layout
            </button>
          </div>
        )}

        {unpositionedItems.length > 0 && (
          <>
            <div className="card card-sm">
              <p className="card-title">Items Needing Position</p>
              <p className="card-subtitle">
                {unpositionedItems.length} of {items.length} item
                {items.length === 1 ? '' : 's'} still need placement.
              </p>
            </div>

            {unpositionedItems.map((item) => (
              <div className="card" key={item.id}>
                <div className="card-header">
                  <div className="card-icon card-icon-primary">{item.label.slice(0, 1).toUpperCase()}</div>
                  <div>
                    <p className="card-title">{item.label}</p>
                    <p className="card-subtitle">
                      {item.shape} | {item.lengthCm} x {item.widthCm} x {item.heightCm}cm
                    </p>
                  </div>
                </div>
                <button className="btn btn-primary" onClick={() => startPlacement(item)}>
                  Place in room
                </button>
              </div>
            ))}
          </>
        )}
      </div>

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
            {calibration ? (
              <PlacementScene
                items={items}
                activeItem={activeItem}
                lockedPosition={visibleActivePosition}
                rotationY={rotationY}
                placing={placing}
                onPreviewMove={setPreviewPosition}
                onFloorTap={handleFloorTap}
                calibration={calibration}
              />
            ) : (
              <CalibrationScene
                step={calibrationStep}
                cornerPoint={cornerPoint}
                onTapCorner={handleTapCorner}
                onTapWall={handleTapWall}
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
                      background: 'rgba(17, 24, 39, 0.86)',
                      color: 'white',
                      padding: '10px 12px',
                      borderRadius: 8,
                      fontSize: 13,
                      lineHeight: 1.45,
                    }}
                  >
                    {calibration ? (
                      <>
                        <strong>{activeItem?.label ?? 'Furniture placement'}</strong>
                        <br />
                        {placing
                          ? 'Move your phone until the preview sits on the real furniture position, then tap the floor.'
                          : 'Adjust rotation to match the real furniture, then confirm placement.'}
                      </>
                    ) : (
                      <>
                        <strong>{calibrationStep === 'corner' ? 'Step 1 of 2 — Set the corner' : 'Step 2 of 2 — Set north'}</strong>
                        <br />
                        {calibrationStep === 'corner'
                          ? "Stand at the unit's northwest corner — where the two outer walls meet — and tap the floor right at the corner."
                          : 'Now walk a few steps along the north wall and tap the floor again, to show which way is east.'}
                        {calibrationError && (
                          <div style={{ marginTop: 6, color: '#fca5a5', fontWeight: 700 }}>{calibrationError}</div>
                        )}
                      </>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={stopAR}
                    style={{
                      background: '#ef4444',
                      color: 'white',
                      border: 0,
                      borderRadius: 8,
                      padding: '10px 14px',
                      fontWeight: 700,
                    }}
                  >
                    Exit
                  </button>
                </div>

                {!calibration && calibrationStep === 'wall' && (
                  <div
                    style={{
                      position: 'absolute',
                      left: 16,
                      right: 16,
                      bottom: 24,
                      pointerEvents: 'auto',
                    }}
                  >
                    <button
                      type="button"
                      onClick={retryCalibration}
                      style={{
                        width: '100%',
                        background: 'rgba(17, 24, 39, 0.86)',
                        color: 'white',
                        border: 0,
                        borderRadius: 8,
                        padding: '12px 14px',
                        fontWeight: 700,
                      }}
                    >
                      Start over from the corner
                    </button>
                  </div>
                )}

                {calibration && activeItem && (
                  <div
                    style={{
                      position: 'absolute',
                      left: 16,
                      right: 16,
                      bottom: 24,
                      background: 'rgba(255, 255, 255, 0.94)',
                      color: '#111827',
                      borderRadius: 8,
                      padding: 14,
                      boxShadow: '0 10px 30px rgba(0,0,0,0.22)',
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
                      <span>{rotationDeg} deg</span>
                    </label>
                    <input
                      id="rotation-slider"
                      type="range"
                      min="0"
                      max="360"
                      step="1"
                      value={rotationDeg}
                      onChange={(event) => setRotationDeg(Number(event.target.value))}
                      style={{ width: '100%', marginBottom: 12 }}
                    />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={handleReplace}
                        disabled={placing}
                        style={{ minHeight: 46 }}
                      >
                        Re-place
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={confirmPlacement}
                        disabled={!lockedPosition || placing}
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
