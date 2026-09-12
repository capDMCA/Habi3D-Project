import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { createXRStore, XR, XRDomOverlay, useXRHitTest, XROrigin } from '@react-three/xr';
import * as THREE from 'three';
import { createFurnitureShape } from '../ar/shapeLibrary';
import {
  deriveCalibration as baseDeriveCalibration,
  applyCalibration,
  type CalibrationTransform,
} from '../ar/calibration';
import { useFurnitureStore } from '../stores/furnitureStore';
import { useSessionStore } from '../stores/sessionStore';
import Spinner from '../components/Spinner';
import BackIcon from '../components/BackIcon';
import { fontFamily, numeric } from '../components/tokens';
import type { FurnitureItem } from '../types';

interface XRHitTestResult {
  pose: {
    position: { x: number; y?: number; z: number };
    orientation?: { x: number; y: number; z: number; w: number };
  };
}

interface ViewerPoseLike {
  transform: {
    orientation: { x: number; y: number; z: number; w: number };
  };
}

interface XRReferenceSpaceLike {
  [key: string]: unknown;
}

interface XRFrameLike {
  getViewerPose?: (referenceSpace: unknown) => ViewerPoseLike | null;
}

let activeXRReferenceSpace: XRReferenceSpaceLike | null = null;
let activeXRFrame: XRFrameLike | null = null;
let activeViewerPose: ViewerPoseLike | null = null;

const xrReferenceSpace: XRReferenceSpaceLike = {};
const frame: {
  getViewerPose: (refSpace?: unknown) => ViewerPoseLike | null;
} = {
  getViewerPose: () => {
    if (activeXRFrame && activeXRReferenceSpace) {
      try {
        const p = activeXRFrame.getViewerPose?.(activeXRReferenceSpace);
        if (p?.transform?.orientation) return p;
      } catch {
        // Fallback to activeViewerPose
      }
    }
    if (activeViewerPose?.transform?.orientation) {
      return activeViewerPose;
    }
    return {
      transform: {
        orientation: { x: 0, y: 0, z: 0, w: 1 },
      },
    };
  },
};

function showToast(msg: string) {
  if (typeof document === 'undefined') return;
  let el = document.getElementById('position-map-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'position-map-toast';
    el.style.position = 'fixed';
    el.style.bottom = '80px';
    el.style.left = '50%';
    el.style.transform = 'translateX(-50%)';
    el.style.backgroundColor = 'rgba(17, 24, 39, 0.9)';
    el.style.color = '#fff';
    el.style.padding = '10px 18px';
    el.style.borderRadius = '24px';
    el.style.fontSize = '14px';
    el.style.fontWeight = '600';
    el.style.zIndex = '99999';
    el.style.pointerEvents = 'none';
    el.style.boxShadow = '0 4px 12px rgba(0,0,0,0.25)';
    el.style.transition = 'opacity 0.25s ease';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.opacity = '1';
  window.setTimeout(() => {
    if (el) el.style.opacity = '0';
  }, 2500);
}

function deriveCalibration(
  arg:
    | { arPoint: { x: number; z: number }; blueprintPoint: { x: number; z: number }; yaw: number }
    | { x: number; z: number },
  alongWall?: { x: number; z: number },
): CalibrationTransform | null {
  if (alongWall) {
    return baseDeriveCalibration(arg as { x: number; z: number }, alongWall);
  }
  const { arPoint, blueprintPoint, yaw } = arg as {
    arPoint: { x: number; z: number };
    blueprintPoint: { x: number; z: number };
    yaw: number;
  };
  const alongNorth = {
    x: arPoint.x + Math.cos(yaw) * 1.5,
    z: arPoint.z + Math.sin(yaw) * 1.5,
  };
  const base = baseDeriveCalibration(arPoint, alongNorth);
  const cos = base ? base.cosTheta : Math.cos(-yaw);
  const sin = base ? base.sinTheta : Math.sin(-yaw);
  return {
    originX: arPoint.x - (blueprintPoint.x * cos + blueprintPoint.z * sin),
    originZ: arPoint.z - (-blueprintPoint.x * sin + blueprintPoint.z * cos),
    cosTheta: cos,
    sinTheta: sin,
  };
}

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
  activeItem,
  lockedPosition,
  rotationY,
  placing,
  onPreviewMove,
  onFloorTap,
}: {
  activeItem: FurnitureItem | null;
  lockedPosition: { x: number; z: number } | null;
  rotationY: number;
  placing: boolean;
  onPreviewMove: (position: { x: number; z: number }) => void;
  onFloorTap: (result: XRHitTestResult) => void;
}) {
  const { gl, camera } = useThree();
  const latestHitRef = useRef<{ x: number; z: number } | null>(null);

  useFrame(() => {
    const xr = gl.xr as unknown as {
      getReferenceSpace?: () => XRReferenceSpaceLike | null;
      getFrame?: () => XRFrameLike | null;
      frame?: XRFrameLike | null;
    };
    activeXRReferenceSpace = xr.getReferenceSpace?.() ?? null;
    activeXRFrame = xr.getFrame?.() ?? xr.frame ?? null;
    activeViewerPose = activeXRFrame?.getViewerPose?.(activeXRReferenceSpace) ?? {
      transform: {
        orientation: {
          x: camera.quaternion.x,
          y: camera.quaternion.y,
          z: camera.quaternion.z,
          w: camera.quaternion.w,
        },
      },
    };
  });

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
      onFloorTap({
        pose: {
          position: {
            x: latestHitRef.current.x,
            z: latestHitRef.current.z,
          },
        },
      });
    }

    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [activeItem, onFloorTap, placing]);

  return (
    <>
      <ambientLight intensity={1.4} />
      <directionalLight position={[3, 5, 3]} intensity={0.9} />
      <XROrigin />

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

export default function PositionMapScreen() {
  const navigateTo = useSessionStore((s) => s.navigateTo);
  const items = useFurnitureStore((s) => s.items);
  const storeAddItem = useFurnitureStore((s) => s.addItem);
  const updatePosition = useFurnitureStore((s) => s.updatePosition);
  const updateItem = useFurnitureStore((s) => s.updateItem);

  const [arActive, setArActive] = useState(false);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [previewPosition, setPreviewPosition] = useState<{ x: number; z: number } | null>(null);
  const [lockedPosition, setLockedPosition] = useState<{ x: number; z: number } | null>(null);
  const [rotationDeg, setRotationDeg] = useState(0);
  const [placing, setPlacing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [arInitializing, setArInitializing] = useState(false);

  // 2. ADD THREE STATE VARIABLES (after existing useState calls):
  const [anchorCalibration, setAnchorCalibration] = useState<CalibrationTransform | null>(null);
  const [anchorTapMode, setAnchorTapMode] = useState<'waitingForAnchor' | 'placing'>('waitingForAnchor');
  const [deviceYaw, setDeviceYaw] = useState(0);

  useEffect(() => {
    return xrPlacementStore.subscribe((state, prevState) => {
      if (state.session === prevState.session) return;
      setArActive(state.session != null);
      if (state.session == null) {
        setActiveItemId(null);
        setPreviewPosition(null);
        setLockedPosition(null);
        setPlacing(false);
        setAnchorCalibration(null);
        setAnchorTapMode('waitingForAnchor');
        setDeviceYaw(0);
      }
    });
  }, []);

  const unpositionedItems = items.filter((item) => !isPositioned(item));
  const activeItem = items.find((item) => item.id === activeItemId) ?? null;
  const itemPayload = activeItem ?? unpositionedItems[0] ?? items[0] ?? ({} as FurnitureItem);
  const rotationY = degreesToRadians(rotationDeg);
  const visibleActivePosition = placing ? previewPosition : lockedPosition;
  const allPlaced = items.length > 0 && unpositionedItems.length === 0 && !activeItem;

  const addItem = useCallback(
    (payload: FurnitureItem) => {
      const exists = items.some((it) => it.id === payload.id);
      if (exists) {
        updatePosition(payload.id, payload.posX, payload.posZ, payload.rotationY);
        updateItem(payload.id, {
          roomId: payload.roomId,
          posX: payload.posX,
          posZ: payload.posZ,
          rotationY: payload.rotationY,
        });
      } else {
        storeAddItem(payload);
      }
    },
    [items, storeAddItem, updateItem, updatePosition],
  );

  async function startPlacement(item: FurnitureItem) {
    setErrorMsg('');
    setActiveItemId(item.id);
    setPreviewPosition(null);
    setLockedPosition(isPositioned(item) ? { x: item.posX, z: item.posZ } : null);
    setRotationDeg(radiansToDegrees(item.rotationY));
    setPlacing(true);
    setAnchorTapMode('waitingForAnchor');
    setAnchorCalibration(null);
    setDeviceYaw(0);
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
    setAnchorCalibration(null);
    setAnchorTapMode('waitingForAnchor');
    setDeviceYaw(0);
  }

  // 3. ADD NEW FUNCTION (before handleConfirmPlacement):
  const handleAnchorTap = (hitTestResult: XRHitTestResult) => {
    const ENTRY_DOOR_BLUEPRINT = { x: 0.2, z: 0.1 };
    try {
      const viewer = frame.getViewerPose(xrReferenceSpace);
      if (!viewer?.transform) { showToast("⚠️ Unable to read device orientation. Try again."); return; }
      const quat = viewer.transform.orientation;
      const yaw = Math.atan2(2 * (quat.w * quat.z + quat.x * quat.y), 1 - 2 * (quat.y * quat.y + quat.z * quat.z));
      const calibration = deriveCalibration({ arPoint: { x: hitTestResult.pose.position.x, z: hitTestResult.pose.position.z }, blueprintPoint: ENTRY_DOOR_BLUEPRINT, yaw });
      setAnchorCalibration(calibration);
      setDeviceYaw(yaw);
      setAnchorTapMode('placing');
      showToast("✓ Room anchor set. Now place furniture.");
    } catch (error) { console.error("Calibration failed:", error); showToast("⚠️ Anchor tap failed. Try again."); }
  };

  // 4. REPLACE handleTapToPlace():
  const handleTapToPlace = (hitTestResult: XRHitTestResult) => {
    if (anchorTapMode === 'waitingForAnchor') {
      handleAnchorTap(hitTestResult);
    } else if (anchorTapMode === 'placing') {
      setLockedPosition({ x: hitTestResult.pose.position.x, z: hitTestResult.pose.position.z });
      setPlacing(false);
    }
  };

  function handleReplace() {
    setPlacing(true);
    setLockedPosition(null);
  }

  // 5. REPLACE handleConfirmPlacement():
  const handleConfirmPlacement = () => {
    if (!lockedPosition || !anchorCalibration) { showToast("⚠️ Please set room anchor and place furniture first."); return; }
    try {
      const blueprintCoord = applyCalibration({ x: lockedPosition.x, z: lockedPosition.z }, anchorCalibration);
      const safeX = Math.max(0.1, Math.min(blueprintCoord.x, 2.5));
      const safeZ = Math.max(0.1, Math.min(blueprintCoord.z, 3.6));
      addItem({ ...itemPayload, posX: safeX, posZ: safeZ, rotationY: deviceYaw, roomId: 'living' });
      stopAR();
      navigateTo('workspace');
    } catch (error) { console.error("Placement failed:", error); showToast("⚠️ Placement failed. Try again."); }
  };


  return (
    <>
      <div className="screen">
        <div className="screen-header">
          <button className="back-btn" onClick={() => navigateTo('furnitureInput')} aria-label="Go back">
            <BackIcon />
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
            <button className="btn btn-primary" onClick={() => navigateTo('workspace')}>
              Open 2D Workspace
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
            {activeItem && (
              <PlacementScene
                activeItem={activeItem}
                lockedPosition={visibleActivePosition}
                rotationY={rotationY}
                placing={placing}
                onPreviewMove={setPreviewPosition}
                onFloorTap={handleTapToPlace}
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
                {anchorTapMode === 'waitingForAnchor' && (
                  <div style={{ position: 'absolute', top: '12px', left: '50%', transform: 'translateX(-50%)', backgroundColor: '#fbbf24', color: '#78350f', padding: '8px 16px', borderRadius: '20px', fontSize: '14px', fontWeight: 500, zIndex: 100 }}>
                    📍 Tap the room entry corner to align
                  </div>
                )}
                {anchorTapMode === 'placing' && (
                  <div style={{ position: 'absolute', top: '12px', left: '50%', transform: 'translateX(-50%)', backgroundColor: '#34d399', color: '#065f46', padding: '8px 16px', borderRadius: '20px', fontSize: '14px', fontWeight: 500, zIndex: 100 }}>
                    ✓ Room aligned. Now place furniture.
                  </div>
                )}

                <div
                  style={{
                    position: 'absolute',
                    top: 56,
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
                    <strong>{activeItem?.label ?? 'Furniture placement'}</strong>
                    <br />
                    {anchorTapMode === 'waitingForAnchor'
                      ? 'Tap the room entry corner on the floor to align the blueprint frame.'
                      : placing
                      ? 'Move your phone until the preview sits on the real furniture position, then tap the floor.'
                      : 'Adjust rotation to match the real furniture, then confirm placement.'}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'auto' }}>
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

                {activeItem && !placing && (
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
                        onClick={handleConfirmPlacement}
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
