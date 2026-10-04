import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { createXRStore, XR, XRDomOverlay, useXRHitTest, XROrigin } from '@react-three/xr';
import * as THREE from 'three';
import {
  deriveCalibration as baseDeriveCalibration,
  applyCalibration,
  type CalibrationTransform,
} from '../ar/calibration';
import {
  validatePlacement,
  type PlacementValidationResult,
} from '../ar/placementValidation';
import PlacementMesh from '../ar/PlacementMesh';
import ARCorrectionIndicator from '../ar/ARCorrectionIndicator';
import { runClearanceAnalysis } from '../engine/clearance';
import { useFurnitureStore, getDefaultRoomPosition } from '../stores/furnitureStore';
import { useSessionStore } from '../stores/sessionStore';
import { useViolationStore } from '../stores/violationStore';
import Spinner from '../components/Spinner';
import BackIcon from '../components/BackIcon';
import { fontFamily, numeric, color as t } from '../components/tokens';
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

function PlacementScene({
  activeItem,
  lockedPosition,
  rotationY,
  placing,
  validation,
  onPreviewMove,
  onFloorTap,
}: {
  activeItem: FurnitureItem | null;
  lockedPosition: { x: number; z: number } | null;
  rotationY: number;
  placing: boolean;
  validation: PlacementValidationResult | null;
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
        <>
          <PlacementMesh
            item={activeItem}
            position={lockedPosition}
            rotationY={rotationY}
            mode={placing ? 'ghost' : 'placed'}
            status={validation?.status ?? 'valid'}
            showLabel={!placing}
          />

          {validation && (
            <ARCorrectionIndicator
              position={lockedPosition}
              correctionVector={validation.correctionVector}
              status={validation.status}
            />
          )}
        </>
      )}
    </>
  );
}

export default function PositionMapScreen() {
  const navigateTo = useSessionStore((s) => s.navigateTo);
  const activePlacementItemId = useSessionStore((s) => s.activePlacementItemId);
  const setActivePlacementItemId = useSessionStore((s) => s.setActivePlacementItemId);
  const items = useFurnitureStore((s) => s.items);
  const storeAddItem = useFurnitureStore((s) => s.addItem);
  const updatePosition = useFurnitureStore((s) => s.updatePosition);
  const updateItem = useFurnitureStore((s) => s.updateItem);
  const refreshViolations = useViolationStore((s) => s.refreshViolations);
  const setSpaceScoreAfter = useViolationStore((s) => s.setSpaceScoreAfter);

  const [arActive, setArActive] = useState(false);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [previewPosition, setPreviewPosition] = useState<{ x: number; z: number } | null>(null);
  const [lockedPosition, setLockedPosition] = useState<{ x: number; z: number } | null>(null);
  const [rotationDeg, setRotationDeg] = useState(0);
  const [placing, setPlacing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [arInitializing, setArInitializing] = useState(false);
  const [xrSupported, setXrSupported] = useState<boolean | null>(null);

  const [anchorCalibration, setAnchorCalibration] = useState<CalibrationTransform | null>(null);
  const [anchorTapMode, setAnchorTapMode] = useState<'waitingForAnchor' | 'placing'>('waitingForAnchor');
  const [deviceYaw, setDeviceYaw] = useState(0);

  // Check WebXR AR capability on mount
  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'xr' in navigator && navigator.xr) {
      navigator.xr
        .isSessionSupported('immersive-ar')
        .then((supported) => setXrSupported(supported))
        .catch(() => setXrSupported(false));
    } else {
      setXrSupported(false);
    }
  }, []);

  // Sync activePlacementItemId from sessionStore if passed
  useEffect(() => {
    if (activePlacementItemId && items.some((it) => it.id === activePlacementItemId)) {
      setActiveItemId(activePlacementItemId);
    }
  }, [activePlacementItemId, items]);

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

  // Lightweight placement validation against the floor plan layout
  const currentValidation: PlacementValidationResult | null = useMemo(() => {
    if (!activeItem || !visibleActivePosition) return null;
    return validatePlacement({
      candidateItem: activeItem,
      arPosition: visibleActivePosition,
      rotationY,
      allExistingItems: items,
      calibration: anchorCalibration,
    });
  }, [activeItem, visibleActivePosition, rotationY, items, anchorCalibration]);

  const addItem = useCallback(
    (payload: FurnitureItem) => {
      const exists = items.some((it) => it.id === payload.id);
      if (exists) {
        updatePosition(payload.id, payload.posX, payload.posZ, payload.rotationY);
        updateItem(payload.id, {
          label: payload.label,
          roomId: payload.roomId,
          posX: payload.posX,
          posZ: payload.posZ,
          rotationY: payload.rotationY,
          quantity: payload.quantity,
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
    setActivePlacementItemId(item.id);
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
      setErrorMsg(
        xrSupported === false
          ? 'Immersive AR is not supported on this device/browser. You can place and arrange your furniture directly in the 2D Workspace.'
          : message,
      );
      setActiveItemId(null);
      setPlacing(false);
    } finally {
      setArInitializing(false);
    }
  }

  function handleDirect2DPlacement(item: FurnitureItem) {
    if (!isPositioned(item)) {
      const def = getDefaultRoomPosition(item.category, item.label);
      updatePosition(item.id, def.posX, def.posZ, 0);
      updateItem(item.id, { roomId: def.roomId });
    }
    setActivePlacementItemId(null);
    navigateTo('workspace');
  }

  function stopAR() {
    xrPlacementStore.getState().session?.end();
    setArActive(false);
    setActiveItemId(null);
    setActivePlacementItemId(null);
    setPreviewPosition(null);
    setLockedPosition(null);
    setPlacing(false);
    setAnchorCalibration(null);
    setAnchorTapMode('waitingForAnchor');
    setDeviceYaw(0);
  }

  const handleAnchorTap = (hitTestResult: XRHitTestResult) => {
    const ENTRY_DOOR_BLUEPRINT = { x: 0.2, z: 0.1 };
    try {
      const viewer = frame.getViewerPose(xrReferenceSpace);
      if (!viewer?.transform) {
        showToast('⚠️ Unable to read device orientation. Try again.');
        return;
      }
      const quat = viewer.transform.orientation;
      const yaw = Math.atan2(
        2 * (quat.w * quat.z + quat.x * quat.y),
        1 - 2 * (quat.y * quat.y + quat.z * quat.z),
      );
      const calibration = deriveCalibration({
        arPoint: { x: hitTestResult.pose.position.x, z: hitTestResult.pose.position.z },
        blueprintPoint: ENTRY_DOOR_BLUEPRINT,
        yaw,
      });
      setAnchorCalibration(calibration);
      setDeviceYaw(yaw);
      setAnchorTapMode('placing');
      showToast('✓ Room anchor set. Move phone to position furniture.');
    } catch (error) {
      console.error('Calibration failed:', error);
      showToast('⚠️ Anchor tap failed. Try again.');
    }
  };

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

  const handleConfirmPlacement = () => {
    if (!lockedPosition || !anchorCalibration) {
      showToast('⚠️ Please set room anchor and place furniture first.');
      return;
    }

    try {
      const defaultPos = getDefaultRoomPosition(itemPayload.category, itemPayload.label);
      const isDining = defaultPos.roomId === 'dining';

      const blueprintCoord = applyCalibration(
        { x: lockedPosition.x, z: lockedPosition.z },
        anchorCalibration,
      );
      let safeX = blueprintCoord.x;
      let safeZ = blueprintCoord.z;

      // Validate bounds and fall back to room defaults if out-of-bounds or NaN
      if (isDining) {
        if (
          Number.isNaN(safeX) ||
          Number.isNaN(safeZ) ||
          safeZ < 6.9 ||
          safeZ > 8.9 ||
          safeX < 0 ||
          safeX > 2.7
        ) {
          safeX = defaultPos.posX;
          safeZ = defaultPos.posZ;
        } else {
          safeX = Math.max(0.3, Math.min(safeX, 2.3));
          safeZ = Math.max(7.2, Math.min(safeZ, 8.6));
        }
      } else {
        if (
          Number.isNaN(safeX) ||
          Number.isNaN(safeZ) ||
          safeZ < 3.3 ||
          safeZ > 7.1 ||
          safeX < 0 ||
          safeX > 2.7
        ) {
          safeX = defaultPos.posX;
          safeZ = defaultPos.posZ;
        } else {
          safeX = Math.max(0.3, Math.min(safeX, 2.3));
          safeZ = Math.max(3.6, Math.min(safeZ, 6.8));
        }
      }

      const qty = itemPayload.quantity && itemPayload.quantity > 1 ? itemPayload.quantity : 1;

      if (qty > 1) {
        const baseLabel = itemPayload.label.replace(/\s*\d+$/, '').trim() || 'Dining Chair';
        const rows = Math.ceil(qty / 2);

        for (let i = 0; i < qty; i++) {
          const col = i % 2;
          const row = Math.floor(i / 2);
          const dx = col === 0 ? -0.28 : 0.28;
          const dz = (row - (rows - 1) / 2) * 0.55;

          let itemX = safeX + dx;
          let itemZ = safeZ + dz;
          if (isDining) {
            itemX = Math.max(0.3, Math.min(itemX, 2.3));
            itemZ = Math.max(7.15, Math.min(itemZ, 8.65));
          } else {
            itemX = Math.max(0.3, Math.min(itemX, 2.3));
            itemZ = Math.max(3.55, Math.min(itemZ, 6.85));
          }

          if (i === 0) {
            addItem({
              ...itemPayload,
              label: `${baseLabel} 1`,
              posX: itemX,
              posZ: itemZ,
              rotationY: deviceYaw,
              roomId: defaultPos.roomId,
              quantity: 1,
            });
          } else {
            storeAddItem({
              ...itemPayload,
              id: `${itemPayload.id}-${i + 1}`,
              label: `${baseLabel} ${i + 1}`,
              posX: itemX,
              posZ: itemZ,
              rotationY: deviceYaw,
              roomId: defaultPos.roomId,
              quantity: 1,
            });
          }
        }
      } else {
        addItem({
          ...itemPayload,
          posX: safeX,
          posZ: safeZ,
          rotationY: deviceYaw,
          roomId: defaultPos.roomId,
        });
      }

      // Run full post-placement design analysis against the updated layout
      const updatedItems = useFurnitureStore.getState().items;
      const fullAnalysis = runClearanceAnalysis(updatedItems, 510, 880);
      refreshViolations(fullAnalysis.violations);
      setSpaceScoreAfter(fullAnalysis.spaceScoreBefore);

      setActivePlacementItemId(null);
      stopAR();
      navigateTo('workspace');
    } catch (error) {
      console.error('Placement failed:', error);
      showToast('⚠️ Placement failed. Try again.');
    }
  };

  return (
    <>
      <div className="screen">
        <div className="screen-header">
          <button
            className="back-btn"
            onClick={() => navigateTo('furnitureInput')}
            aria-label="Go back"
          >
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

        {/* Graceful Fallback Banner if WebXR AR is unsupported */}
        {xrSupported === false && (
          <div
            className="card"
            style={{
              borderColor: 'rgba(59, 130, 246, 0.3)',
              background: 'rgba(59, 130, 246, 0.05)',
              padding: '16px',
            }}
          >
            <p className="card-title" style={{ color: t.brand, marginBottom: 4 }}>
              AR Not Available On This Device
            </p>
            <p className="card-subtitle" style={{ lineHeight: 1.45, marginBottom: 12 }}>
              WebXR AR is supported on compatible mobile devices (e.g. Chrome on Android). You can
              position, rotate, and check your furniture directly in the interactive 2D Workspace.
            </p>
            <button className="btn btn-primary" onClick={() => navigateTo('workspace')}>
              Open 2D Workspace
            </button>
          </div>
        )}

        {errorMsg && (
          <div
            className="card"
            style={{ borderColor: 'var(--danger-border)', background: 'var(--danger-bg)' }}
          >
            <p className="card-title" style={{ color: 'var(--danger)' }}>
              AR Placement Notice
            </p>
            <p className="form-error" style={{ marginBottom: 10 }}>
              {errorMsg}
            </p>
            <button className="btn btn-secondary" onClick={() => navigateTo('workspace')}>
              Continue in 2D Workspace
            </button>
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
                <p className="card-title">{items.length} items placed in your layout</p>
                <p className="card-subtitle">
                  Positions and rotations are stored. You can fine-tune in 2D or re-open AR placement.
                </p>
              </div>
            </div>
            <button className="btn btn-primary" onClick={() => navigateTo('workspace')}>
              Open 2D Workspace
            </button>
          </div>
        )}

        {/* List of items that need placement or can be re-placed */}
        {items.length > 0 && (
          <>
            <div className="card card-sm">
              <p className="card-title">Select Item to Place in AR</p>
              <p className="card-subtitle">
                {unpositionedItems.length > 0
                  ? `${unpositionedItems.length} of ${items.length} item${
                      items.length === 1 ? '' : 's'
                    } still need placement.`
                  : 'All items placed. Tap any piece to re-position with AR guidance.'}
              </p>
            </div>

            {items.map((item) => {
              const placed = isPositioned(item);
              return (
                <div
                  className="card"
                  key={item.id}
                  style={{
                    borderLeft: placed ? `4px solid ${t.comfortFg}` : `4px solid ${t.brand}`,
                  }}
                >
                  <div className="card-header">
                    <div
                      className={`card-icon ${
                        placed ? 'card-icon-success' : 'card-icon-primary'
                      }`}
                    >
                      {item.label.slice(0, 1).toUpperCase()}
                    </div>
                    <div>
                      <p className="card-title">
                        {item.label}
                        {item.quantity && item.quantity > 1 ? ` (x${item.quantity})` : ''}
                      </p>
                      <p className="card-subtitle">
                        {item.shape} | {item.lengthCm} × {item.widthCm} × {item.heightCm} cm
                        {placed ? ' · Placed' : ' · Needs Placement'}
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <button
                      className="btn btn-primary"
                      onClick={() => startPlacement(item)}
                      disabled={arInitializing}
                      style={{ flex: 1 }}
                    >
                      {arInitializing && activeItemId === item.id ? (
                        <>
                          <Spinner />
                          Opening camera…
                        </>
                      ) : placed ? (
                        '📷 Re-position in AR'
                      ) : (
                        '📷 Place in AR'
                      )}
                    </button>

                    <button
                      className="btn btn-secondary"
                      onClick={() => handleDirect2DPlacement(item)}
                      title="Arrange on 2D floor plan"
                      style={{ flex: 1 }}
                    >
                      ✏️ Arrange in 2D
                    </button>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* AR Viewport & Live Guidance DOM Overlay */}
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
                validation={currentValidation}
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
                {/* Mode Indicator Pill (Top Center) */}
                {anchorTapMode === 'waitingForAnchor' && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '12px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      backgroundColor: '#fbbf24',
                      color: '#78350f',
                      padding: '8px 18px',
                      borderRadius: '24px',
                      fontSize: '13px',
                      fontWeight: 700,
                      zIndex: 100,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                    }}
                  >
                    📍 Step 1: Tap entry door corner to align unit
                  </div>
                )}

                {anchorTapMode === 'placing' && currentValidation && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '12px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      backgroundColor:
                        currentValidation.status === 'valid'
                          ? '#10b981'
                          : currentValidation.status === 'warning'
                          ? '#f59e0b'
                          : '#ef4444',
                      color: '#ffffff',
                      padding: '7px 18px',
                      borderRadius: '24px',
                      fontSize: '13px',
                      fontWeight: 750,
                      zIndex: 100,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    {currentValidation.status === 'valid'
                      ? '✓ Valid Placement'
                      : currentValidation.status === 'warning'
                      ? '⚠️ Suboptimal Clearance'
                      : '✕ Cannot Place Here'}
                  </div>
                )}

                {/* Designer Guidance Card (Top Floating HUD) */}
                <div
                  style={{
                    position: 'absolute',
                    top: 54,
                    left: 14,
                    right: 14,
                    display: 'flex',
                    gap: 10,
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
                      borderRadius: 12,
                      fontSize: 13,
                      lineHeight: 1.45,
                      boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                      border: '1px solid rgba(255,255,255,0.1)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <strong style={{ fontSize: 14, color: '#f8fafc' }}>
                        {activeItem?.label ?? 'Furniture placement'}
                      </strong>
                      <span style={{ fontSize: 11, color: '#94a3b8' }}>
                        {currentValidation?.roomName ?? 'Mulberry Place'}
                      </span>
                    </div>

                    {anchorTapMode === 'waitingForAnchor' ? (
                      <p style={{ margin: 0, color: '#e2e8f0', fontSize: 12.5 }}>
                        Aim at the floor near the unit entrance corner and tap to align the floor plan.
                      </p>
                    ) : currentValidation ? (
                      <div>
                        {/* What is wrong & What to do */}
                        <div style={{ fontWeight: 700, fontSize: 13, color: '#ffffff', marginBottom: 2 }}>
                          {currentValidation.problem}
                        </div>
                        <div style={{ fontSize: 12.5, color: '#cbd5e1' }}>
                          👉 {currentValidation.action}
                        </div>
                        {/* Why it helps */}
                        {currentValidation.reason && (
                          <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 4 }}>
                            💡 {currentValidation.reason}
                          </div>
                        )}
                      </div>
                    ) : (
                      <p style={{ margin: 0, color: '#cbd5e1' }}>
                        Move phone over the floor to preview placement.
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={stopAR}
                    style={{
                      background: 'rgba(239, 68, 68, 0.9)',
                      color: 'white',
                      border: 0,
                      borderRadius: 10,
                      minHeight: 44,
                      padding: '0 14px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 750,
                      fontSize: 13,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                    }}
                  >
                    Exit
                  </button>
                </div>

                {/* Bottom Control Sheet: Rotation & Confirmation */}
                {activeItem && !placing && (
                  <div
                    style={{
                      position: 'absolute',
                      left: 14,
                      right: 14,
                      bottom: 20,
                      background: 'rgba(255, 255, 255, 0.96)',
                      backdropFilter: 'blur(12px)',
                      color: '#111827',
                      borderRadius: 14,
                      padding: 14,
                      boxShadow: '0 12px 36px rgba(0,0,0,0.3)',
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
                        marginBottom: 6,
                      }}
                    >
                      <span>Adjust Rotation</span>
                      <span style={numeric}>{rotationDeg}°</span>
                    </label>

                    <input
                      id="rotation-slider"
                      type="range"
                      min="0"
                      max="360"
                      step="5"
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
                        style={{ minHeight: 46, fontWeight: 700 }}
                      >
                        Re-place
                      </button>

                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={handleConfirmPlacement}
                        disabled={!lockedPosition || placing}
                        style={{
                          minHeight: 46,
                          fontWeight: 700,
                          background: currentValidation?.status === 'invalid' ? '#f59e0b' : undefined,
                        }}
                      >
                        Confirm Placement
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
