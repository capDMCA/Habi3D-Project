import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { createXRStore, XR, XRDomOverlay, useXRHitTest, XROrigin } from '@react-three/xr';
import * as THREE from 'three';
import { createFurnitureShape } from '../ar/shapeLibrary';
import {
  applyCalibration,
  invertCalibration,
  calibrationThetaRad,
  type CalibrationTransform,
} from '../ar/calibration';
import { useFurnitureStore } from '../stores/furnitureStore';
import { useSessionStore } from '../stores/sessionStore';
import Spinner from '../components/Spinner';
import { fontFamily, numeric } from '../components/tokens';
import { isFurnitureDimensionOversized, findOversizedFurniture } from '../utils/furnitureValidation';
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

const alignNavBtnStyle: React.CSSProperties = {
  background: 'rgba(255, 255, 255, 0.15)',
  color: '#ffffff',
  border: '1px solid rgba(255, 255, 255, 0.28)',
  borderRadius: 8,
  minHeight: 44,
  padding: '0 16px',
  fontWeight: 700,
  fontSize: 13,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
};

/**
 * Visual alignment guide for Mulberry Place 2BR Living & Dining area.
 * Renders an architectural wireframe outline at ceiling level (2.4m)
 * with corner drop lines to physical floor level, preventing furniture
 * obstruction while aligning the predefined footprint.
 */
function RoomAlignmentScene({ calibration }: { calibration: CalibrationTransform }) {
  const thetaRad = calibrationThetaRad(calibration);
  const ceilingY = 2.4;

  return (
    <>
      <ambientLight intensity={1.4} />
      <directionalLight position={[3, 5, 3]} intensity={0.9} />
      <XROrigin />

      <group position={[calibration.originX, ceilingY, calibration.originZ]} rotation={[0, thetaRad, 0]}>
        {/* North boundary beam (z = 3.4, width = 2.6m) */}
        <mesh position={[1.3, 0, 3.4]}>
          <boxGeometry args={[2.6, 0.03, 0.03]} />
          <meshStandardMaterial color="#38bdf8" roughness={0.2} emissive="#0284c7" emissiveIntensity={0.3} />
        </mesh>

        {/* South boundary beam (z = 8.8, width = 2.6m) */}
        <mesh position={[1.3, 0, 8.8]}>
          <boxGeometry args={[2.6, 0.03, 0.03]} />
          <meshStandardMaterial color="#38bdf8" roughness={0.2} emissive="#0284c7" emissiveIntensity={0.3} />
        </mesh>

        {/* Living / Dining interior dividing beam (z = 7.0, width = 2.6m) */}
        <mesh position={[1.3, 0, 7.0]}>
          <boxGeometry args={[2.6, 0.02, 0.02]} />
          <meshStandardMaterial color="#f59e0b" roughness={0.2} emissive="#d97706" emissiveIntensity={0.3} />
        </mesh>

        {/* West outer boundary beam (x = 0, depth = 5.4m) */}
        <mesh position={[0, 0, 6.1]}>
          <boxGeometry args={[0.03, 0.03, 5.4]} />
          <meshStandardMaterial color="#38bdf8" roughness={0.2} emissive="#0284c7" emissiveIntensity={0.3} />
        </mesh>

        {/* East outer boundary beam (x = 2.6, depth = 5.4m) */}
        <mesh position={[2.6, 0, 6.1]}>
          <boxGeometry args={[0.03, 0.03, 5.4]} />
          <meshStandardMaterial color="#38bdf8" roughness={0.2} emissive="#0284c7" emissiveIntensity={0.3} />
        </mesh>

        {/* 4 Corner Drop Lines from ceiling to floor (2.4m) for wall visual reference */}
        {/* NW corner (0, 3.4) */}
        <mesh position={[0, -1.2, 3.4]}>
          <boxGeometry args={[0.02, 2.4, 0.02]} />
          <meshStandardMaterial color="#38bdf8" transparent opacity={0.65} />
        </mesh>
        {/* NE corner (2.6, 3.4) */}
        <mesh position={[2.6, -1.2, 3.4]}>
          <boxGeometry args={[0.02, 2.4, 0.02]} />
          <meshStandardMaterial color="#38bdf8" transparent opacity={0.65} />
        </mesh>
        {/* SE corner (2.6, 8.8) */}
        <mesh position={[2.6, -1.2, 8.8]}>
          <boxGeometry args={[0.02, 2.4, 0.02]} />
          <meshStandardMaterial color="#38bdf8" transparent opacity={0.65} />
        </mesh>
        {/* SW corner (0, 8.8) */}
        <mesh position={[0, -1.2, 8.8]}>
          <boxGeometry args={[0.02, 2.4, 0.02]} />
          <meshStandardMaterial color="#38bdf8" transparent opacity={0.65} />
        </mesh>

        {/* Floating Zone Name Labels */}
        <group position={[1.3, 0, 5.2]}>
          <FloatingLabel label="Living Room" y={0.25} />
        </group>
        <group position={[1.3, 0, 7.9]}>
          <FloatingLabel label="Dining Area" y={0.25} />
        </group>
      </group>
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
  // Covers the gap between tapping "Place in room" and the WebXR session
  // actually starting (camera permission, ARCore handshake) — previously a
  // blank wait with no feedback until the AR overlay suddenly appeared.
  const [arInitializing, setArInitializing] = useState(false);

  // Room Calibration — once per AR session.
  // Instead of physical corner/wall tapping, residents align a ceiling-height
  // wireframe guide of the Living & Dining footprint.
  const [calibration, setCalibration] = useState<CalibrationTransform | null>(null);
  const [alignmentOffset, setAlignmentOffset] = useState<{ x: number; z: number }>({ x: 0, z: -3.5 });
  const [alignmentYawDeg, setAlignmentYawDeg] = useState(0);
  const [recalibrateConfirmPending, setRecalibrateConfirmPending] = useState(false);

  // Derived live calibration transform from current visual guide alignment
  const currentCalibration: CalibrationTransform = useMemo(() => {
    const theta = (alignmentYawDeg * Math.PI) / 180;
    const cosTheta = Math.cos(theta);
    const sinTheta = Math.sin(theta);
    // Center of predefined Living (260cm x 360cm at y:340..700) + Dining (260cm x 180cm at y:700..880)
    // in 2D plan coordinates is X: 1.3m, Z: 6.1m
    const xc = 1.3;
    const zc = 6.1;
    const originX = alignmentOffset.x - (xc * cosTheta + zc * sinTheta);
    const originZ = alignmentOffset.z - (-xc * sinTheta + zc * cosTheta);
    return { originX, originZ, cosTheta, sinTheta };
  }, [alignmentOffset.x, alignmentOffset.z, alignmentYawDeg]);

  const [oversizedWarningItem, setOversizedWarningItem] = useState<FurnitureItem | null>(null);

  useEffect(() => {
    return xrPlacementStore.subscribe((state, prevState) => {
      if (state.session === prevState.session) return;
      setArActive(state.session != null);
      if (state.session == null) {
        setCalibration(null);
        setAlignmentOffset({ x: 0, z: -3.5 });
        setAlignmentYawDeg(0);
        setRecalibrateConfirmPending(false);
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

  function handleProceedToAnalysis() {
    const oversized = findOversizedFurniture(items);
    if (oversized) {
      setOversizedWarningItem(oversized);
      return;
    }
    navigateTo('analysis');
  }

  function recalibrate() {
    setCalibration(null);
    setAlignmentOffset({ x: 0, z: -3.5 });
    setAlignmentYawDeg(0);
    setRecalibrateConfirmPending(false);
  }

  function requestRecalibrate() {
    if (items.some(isPositioned)) {
      setRecalibrateConfirmPending(true);
    } else {
      recalibrate();
    }
  }

  function cancelRecalibrate() {
    setRecalibrateConfirmPending(false);
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

    // Dimension sanity check before completing placement
    if (isFurnitureDimensionOversized(activeItem)) {
      setOversizedWarningItem(activeItem);
      return;
    }

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
            <button className="btn btn-primary" onClick={handleProceedToAnalysis}>
              Analyse layout
            </button>
          </div>
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
                <button
                  className="btn btn-primary"
                  onClick={() => startPlacement(item)}
                  disabled={arInitializing}
                >
                  {arInitializing && activeItemId === item.id ? (
                    <>
                      <Spinner />
                      Setting up your camera…
                    </>
                  ) : (
                    'Place in room'
                  )}
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
              <RoomAlignmentScene calibration={currentCalibration} />
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
                        <strong>Align Room</strong>
                        <br />
                        Align the Living and Dining outline with your room, then tap Confirm. You can fine-tune individual furniture positions later.
                      </>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'auto' }}>
                    {calibration && (
                      <button
                        type="button"
                        onClick={requestRecalibrate}
                        style={{
                          background: 'rgba(17, 24, 39, 0.86)',
                          color: 'white',
                          border: 0,
                          borderRadius: 8,
                          minHeight: 44,
                          padding: '0 14px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        Recalibrate
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={stopAR}
                      style={{
                        background: '#ef4444',
                        color: 'white',
                        border: 0,
                        borderRadius: 8,
                        minHeight: 44,
                        padding: '0 14px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                      }}
                    >
                      Exit
                    </button>
                  </div>
                </div>

                {!calibration && (
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
                      padding: 14,
                      boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
                      pointerEvents: 'auto',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 10,
                    }}
                  >
                    {/* Directional Nudge (Forward, Backward, Left, Right) */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                      <button
                        type="button"
                        onClick={() => setAlignmentOffset((prev) => ({ ...prev, z: Number((prev.z - 0.1).toFixed(3)) }))}
                        style={alignNavBtnStyle}
                        aria-label="Move Forward"
                      >
                        Move Forward ↑
                      </button>
                      <div style={{ display: 'flex', gap: 14 }}>
                        <button
                          type="button"
                          onClick={() => setAlignmentOffset((prev) => ({ ...prev, x: Number((prev.x - 0.1).toFixed(3)) }))}
                          style={alignNavBtnStyle}
                          aria-label="Move Left"
                        >
                          ← Left
                        </button>
                        <button
                          type="button"
                          onClick={() => setAlignmentOffset((prev) => ({ ...prev, x: Number((prev.x + 0.1).toFixed(3)) }))}
                          style={alignNavBtnStyle}
                          aria-label="Move Right"
                        >
                          Right →
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => setAlignmentOffset((prev) => ({ ...prev, z: Number((prev.z + 0.1).toFixed(3)) }))}
                        style={alignNavBtnStyle}
                        aria-label="Move Backward"
                      >
                        Move Backward ↓
                      </button>
                    </div>

                    {/* Rotation (Yaw) Controls */}
                    <div style={{ display: 'flex', gap: 10, width: '100%' }}>
                      <button
                        type="button"
                        onClick={() => setAlignmentYawDeg((prev) => (prev - 5 + 360) % 360)}
                        style={{ ...alignNavBtnStyle, flex: 1 }}
                        aria-label="Rotate Left"
                      >
                        ↺ Rotate Left
                      </button>
                      <button
                        type="button"
                        onClick={() => setAlignmentYawDeg((prev) => (prev + 5) % 360)}
                        style={{ ...alignNavBtnStyle, flex: 1 }}
                        aria-label="Rotate Right"
                      >
                        Rotate Right ↻
                      </button>
                    </div>

                    {/* Actions: Reset & Confirm */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, width: '100%', marginTop: 2 }}>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => {
                          setAlignmentOffset({ x: 0, z: -3.5 });
                          setAlignmentYawDeg(0);
                        }}
                        style={{ minHeight: 46 }}
                      >
                        Reset Alignment
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => setCalibration(currentCalibration)}
                        style={{ minHeight: 46 }}
                      >
                        Confirm Alignment
                      </button>
                    </div>
                  </div>
                )}

                {calibration && recalibrateConfirmPending && (
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
                    <p style={{ margin: '0 0 12px', fontSize: 13, lineHeight: 1.5 }}>
                      <strong>Recalibrate?</strong> You've already placed{' '}
                      {items.filter(isPositioned).length} item{items.filter(isPositioned).length === 1 ? '' : 's'}. Recalibrating won't
                      move them — they'll keep their current positions and may look misaligned until you re-place them.
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <button type="button" className="btn btn-secondary" onClick={cancelRecalibrate} style={{ minHeight: 46 }}>
                        Cancel
                      </button>
                      <button type="button" className="btn btn-primary" onClick={recalibrate} style={{ minHeight: 46 }}>
                        Recalibrate anyway
                      </button>
                    </div>
                  </div>
                )}

                {calibration && activeItem && !recalibrateConfirmPending && (
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
                      <span style={numeric}>{rotationDeg} deg</span>
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

                {/* AR Oversized Furniture Warning Dialog */}
                {oversizedWarningItem && (
                  <div
                    style={{
                      position: 'absolute',
                      left: 16,
                      right: 16,
                      bottom: 24,
                      background: 'rgba(10, 22, 44, 0.96)',
                      backdropFilter: 'blur(12px)',
                      color: '#ffffff',
                      borderRadius: 16,
                      padding: 18,
                      boxShadow: '0 12px 36px rgba(0,0,0,0.5)',
                      pointerEvents: 'auto',
                      border: '1px solid rgba(255,255,255,0.18)',
                      zIndex: 100,
                    }}
                  >
                    <p style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 800, color: '#f59e0b' }}>
                      Check Furniture Size
                    </p>
                    <p style={{ margin: '0 0 8px', fontSize: 13, lineHeight: 1.45, color: 'rgba(255,255,255,0.9)' }}>
                      This furniture appears unusually large for the Living/Dining area.
                      Please review its dimensions.
                    </p>
                    <p style={{ margin: '0 0 16px', fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>
                      <strong>{oversizedWarningItem.label}</strong>: {oversizedWarningItem.lengthCm} × {oversizedWarningItem.widthCm} × {oversizedWarningItem.heightCm} cm
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: 10 }}>
                      <button
                        type="button"
                        onClick={handleCancelOversized}
                        style={{
                          minHeight: 46,
                          borderRadius: 12,
                          border: '1px solid rgba(255,255,255,0.25)',
                          background: 'rgba(255,255,255,0.12)',
                          color: '#ffffff',
                          fontWeight: 700,
                          fontSize: 14,
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleReviewDimensions}
                        style={{
                          minHeight: 46,
                          borderRadius: 12,
                          border: 'none',
                          background: '#0284c7',
                          color: '#ffffff',
                          fontWeight: 800,
                          fontSize: 14,
                        }}
                      >
                        Review Dimensions
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
