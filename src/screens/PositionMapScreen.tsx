import { useEffect, useMemo, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { createXRStore, XR, XRDomOverlay, XROrigin } from '@react-three/xr';
import * as THREE from 'three';
import { createFurnitureShape } from '../ar/shapeLibrary';
import { useFurnitureStore } from '../stores/furnitureStore';
import { useSessionStore } from '../stores/sessionStore';
import Spinner from '../components/Spinner';
import { fontFamily } from '../components/tokens';
import { findOversizedFurniture } from '../utils/furnitureValidation';
import type { FurnitureItem } from '../types';

const xrPlacementStore = createXRStore({
  offerSession: false,
  emulate: false,
  hitTest: false,
  domOverlay: true,
});

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

/**
 * AR 1:1 Scale Visualizer Scene.
 * Spawns the 3D furniture model statically 1.5 meters directly in front of the active camera.
 * AR no longer dictates 2D placement; it acts solely as a 1:1 scale visualizer.
 */
function ARVisualizerScene({
  item,
}: {
  item: FurnitureItem;
}) {
  const [spawnedTransform, setSpawnedTransform] = useState<{
    position: [number, number, number];
    rotationY: number;
  } | null>(null);

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

  // Capture active camera pose on first valid frame and spawn 1.5m directly in front
  useFrame(({ camera }) => {
    if (spawnedTransform) return;

    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    if (dir.lengthSq() < 0.001) return;

    // Spawn 1.5 meters directly in front of the active camera
    const spawnPos = camera.position.clone().add(dir.multiplyScalar(1.5));
    const yaw = Math.atan2(dir.x, dir.z);

    setSpawnedTransform({
      position: [spawnPos.x, spawnPos.y, spawnPos.z],
      rotationY: yaw,
    });
  });

  return (
    <>
      <ambientLight intensity={1.5} />
      <directionalLight position={[3, 5, 3]} intensity={1.0} />
      <XROrigin />

      {spawnedTransform && (
        <group
          position={spawnedTransform.position}
          rotation={[0, spawnedTransform.rotationY, 0]}
        >
          <mesh geometry={geometry}>
            <meshStandardMaterial
              color="#2B4E8C"
              roughness={0.45}
              metalness={0.05}
            />
          </mesh>
          <FloatingLabel label={item.label} y={boundingBox.heightM / 2 + 0.22} />
        </group>
      )}
    </>
  );
}

export default function PositionMapScreen() {
  const navigateTo = useSessionStore((s) => s.navigateTo);
  const items = useFurnitureStore((s) => s.items);

  const [arActive, setArActive] = useState(false);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [recenterTrigger, setRecenterTrigger] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [arInitializing, setArInitializing] = useState(false);
  const [oversizedWarningItem, setOversizedWarningItem] = useState<FurnitureItem | null>(null);

  useEffect(() => {
    return xrPlacementStore.subscribe((state, prevState) => {
      if (state.session === prevState.session) return;
      setArActive(state.session != null);
      if (state.session == null) {
        setActiveItemId(null);
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

  async function startVisualizer(item: FurnitureItem) {
    setErrorMsg('');
    setActiveItemId(item.id);
    setArInitializing(true);

    try {
      await xrPlacementStore.enterAR();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setErrorMsg(message);
      setActiveItemId(null);
    } finally {
      setArInitializing(false);
    }
  }

  function stopAR() {
    xrPlacementStore.getState().session?.end();
    setArActive(false);
    setActiveItemId(null);
  }

  return (
    <>
      <div className="screen">
        <div className="screen-header">
          <button className="back-btn" onClick={() => navigateTo('furnitureInput')} aria-label="Go back">
            &lt;
          </button>
          <div className="screen-header-info">
            <span className="step-label">1:1 AR Visualizer</span>
            <h2>Furniture Visualizer</h2>
          </div>
        </div>

        {errorMsg && (
          <div className="card" style={{ borderColor: 'var(--danger-border)', background: 'var(--danger-bg)' }}>
            <p className="card-title" style={{ color: 'var(--danger)' }}>AR Session Notice</p>
            <p className="form-error" style={{ marginBottom: 0 }}>{errorMsg}</p>
          </div>
        )}

        {items.length === 0 ? (
          <div className="card">
            <p className="card-title">No Furniture Added</p>
            <p className="card-subtitle">Add furniture items to preview them in 1:1 scale AR or arrange them in 2D.</p>
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
                  <p className="card-title">1:1 Scale Visualizer</p>
                  <p className="card-subtitle">
                    Spawn any 3D furniture piece 1.5 meters in front of your camera to inspect real-world proportions.
                  </p>
                </div>
              </div>
              <button className="btn btn-primary" onClick={handleProceedToWorkspace}>
                Open 2D Workspace
              </button>
            </div>

            <div className="card card-sm">
              <p className="card-title">Furniture Pieces ({items.length})</p>
              <p className="card-subtitle">
                Tap an item to preview its full 1:1 physical volume in AR.
              </p>
            </div>

            {items.map((item) => (
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
                  className="btn btn-secondary"
                  onClick={() => startVisualizer(item)}
                  disabled={arInitializing}
                >
                  {arInitializing && activeItemId === item.id ? (
                    <>
                      <Spinner />
                      Starting AR camera…
                    </>
                  ) : (
                    'Preview 1:1 in AR'
                  )}
                </button>
              </div>
            ))}
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
              <ARVisualizerScene
                key={`${activeItem.id}-${recenterTrigger}`}
                item={activeItem}
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
                    <strong>{activeItem?.label ?? 'Furniture Visualizer'}</strong> (1:1 Scale)
                    <br />
                    Spawned statically 1.5m in front of camera. Walk around to inspect physical scale.
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

                {/* Bottom control: Re-center */}
                <div
                  style={{
                    position: 'absolute',
                    bottom: 24,
                    left: 16,
                    right: 16,
                    display: 'flex',
                    justifyContent: 'center',
                    pointerEvents: 'auto',
                  }}
                >
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => setRecenterTrigger((c) => c + 1)}
                    style={{
                      maxWidth: 280,
                      width: '100%',
                      minHeight: 46,
                      borderRadius: 10,
                      boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
                    }}
                  >
                    Re-center in Front of Me
                  </button>
                </div>
              </div>
            </XRDomOverlay>
          </XR>
        </Canvas>
      </div>
    </>
  );
}
