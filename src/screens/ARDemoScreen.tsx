import { useState, useRef, useCallback } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import {
  createXRStore,
  XR,
  XROrigin,
  useXRHitTest,
  XRDomOverlay,
  IfInSessionMode,
} from '@react-three/xr';
import * as THREE from 'three';
import { useSessionStore } from '../stores/sessionStore';

/* ------------------------------------------------------------------ 
   XR Store — configured with hit-test + plane detection for AR
   ------------------------------------------------------------------ */
const xrStore = createXRStore({
  offerSession: false,      // we control session entry manually
  emulate: false,           // no emulation — test real device
  hitTest: 'required',
  planeDetection: true,
  domOverlay: true,
  handTracking: false,
  meshDetection: false,
  depthSensing: false,
});

/* ------------------------------------------------------------------ 
   Reticle — shows where the floor is detected via hit-test
   ------------------------------------------------------------------ */
const _matrix = new THREE.Matrix4();
const _position = new THREE.Vector3();

function HitTestReticle({
  onPositionUpdate,
}: {
  onPositionUpdate: (pos: THREE.Vector3) => void;
}) {
  const reticleRef = useRef<THREE.Mesh>(null);

  useXRHitTest(
    (results, getWorldMatrix) => {
      if (results.length === 0 || !reticleRef.current) return;

      // Get world matrix of the first hit result
      const valid = getWorldMatrix(_matrix, results[0]);
      if (!valid) return;

      _position.setFromMatrixPosition(_matrix);
      reticleRef.current.position.copy(_position);
      reticleRef.current.visible = true;
      onPositionUpdate(_position.clone());
    },
    'viewer', // hit-test from the viewer's perspective (center of screen)
  );

  return (
    <mesh ref={reticleRef} rotation-x={-Math.PI / 2} visible={false}>
      {/* Outer ring */}
      <ringGeometry args={[0.09, 0.1, 32]} />
      <meshBasicMaterial color="#10B981" side={THREE.DoubleSide} opacity={0.9} transparent />
    </mesh>
  );
}

/* ------------------------------------------------------------------ 
   Placed furniture box — represents a placed furniture item
   ------------------------------------------------------------------ */
function PlacedBox({ position, color }: { position: THREE.Vector3; color: string }) {
  const meshRef = useRef<THREE.Mesh>(null);

  // Gentle floating animation
  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.3;
    }
  });

  return (
    <mesh ref={meshRef} position={[position.x, position.y + 0.15, position.z]}>
      <boxGeometry args={[0.3, 0.3, 0.3]} />
      <meshStandardMaterial color={color} roughness={0.4} metalness={0.1} />
    </mesh>
  );
}

/* ------------------------------------------------------------------ 
   AR Scene — the 3D content shown inside the AR session
   ------------------------------------------------------------------ */
function ARScene({
  placedObjects,
  onReticleUpdate,
}: {
  placedObjects: Array<{ position: THREE.Vector3; color: string }>;
  onReticleUpdate: (pos: THREE.Vector3) => void;
}) {
  return (
    <>
      <ambientLight intensity={1.2} />
      <directionalLight position={[3, 5, 3]} intensity={0.8} castShadow />
      <XROrigin />
      <HitTestReticle onPositionUpdate={onReticleUpdate} />
      {placedObjects.map((obj, i) => (
        <PlacedBox key={i} position={obj.position} color={obj.color} />
      ))}
    </>
  );
}

/* ------------------------------------------------------------------ 
   AR Overlay UI — DOM overlay shown on top of the AR camera feed
   ------------------------------------------------------------------ */
function AROverlayUI({
  objectCount,
  onPlace,
  onClear,
  onExit,
}: {
  objectCount: number;
  onPlace: () => void;
  onClear: () => void;
  onExit: () => void;
}) {
  return (
    <IfInSessionMode allow="immersive-ar">
      <XRDomOverlay>
        <div
          style={{
            position: 'fixed',
            inset: 0,
            pointerEvents: 'none',
            fontFamily: "'Inter', system-ui, sans-serif",
          }}
        >
          {/* Top bar */}
          <div
            style={{
              position: 'absolute',
              top: 16,
              left: 16,
              right: 16,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              pointerEvents: 'auto',
            }}
          >
            <div
              style={{
                background: 'rgba(0,0,0,0.7)',
                backdropFilter: 'blur(8px)',
                color: 'white',
                padding: '10px 16px',
                borderRadius: 12,
                fontSize: 13,
                maxWidth: '60%',
                lineHeight: 1.4,
              }}
            >
              {objectCount === 0
                ? '👆 Point camera at the floor.\nTap "Place" when you see the green ring.'
                : `✅ ${objectCount} object${objectCount > 1 ? 's' : ''} placed`}
            </div>
            <button
              onClick={onExit}
              style={{
                background: 'rgba(239,68,68,0.9)',
                color: 'white',
                border: 'none',
                padding: '10px 18px',
                borderRadius: 12,
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              ✕ Exit
            </button>
          </div>

          {/* Bottom controls */}
          <div
            style={{
              position: 'absolute',
              bottom: 32,
              left: 16,
              right: 16,
              display: 'flex',
              gap: 12,
              justifyContent: 'center',
              pointerEvents: 'auto',
            }}
          >
            {objectCount > 0 && (
              <button
                onClick={onClear}
                style={{
                  background: 'rgba(255,255,255,0.2)',
                  backdropFilter: 'blur(8px)',
                  color: 'white',
                  border: '1px solid rgba(255,255,255,0.3)',
                  padding: '14px 28px',
                  borderRadius: 16,
                  fontSize: 16,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                🗑️ Clear
              </button>
            )}
            <button
              onClick={onPlace}
              style={{
                background: 'linear-gradient(135deg, #1F3864 0%, #2B4E8C 100%)',
                color: 'white',
                border: 'none',
                padding: '14px 40px',
                borderRadius: 16,
                fontSize: 16,
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 4px 15px rgba(31,56,100,0.5)',
              }}
            >
              📦 Place Object
            </button>
          </div>
        </div>
      </XRDomOverlay>
    </IfInSessionMode>
  );
}

/* ------------------------------------------------------------------ 
   Main AR Demo Screen
   ------------------------------------------------------------------ */
const BOX_COLORS = ['#1F3864', '#2B4E8C', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

export default function ARDemoScreen() {
  const navigateTo = useSessionStore((s) => s.navigateTo);

  const [arActive, setArActive] = useState(false);
  const [placedObjects, setPlacedObjects] = useState<
    Array<{ position: THREE.Vector3; color: string }>
  >([]);
  const lastReticlePos = useRef<THREE.Vector3 | null>(null);

  const handleReticleUpdate = useCallback((pos: THREE.Vector3) => {
    lastReticlePos.current = pos;
  }, []);

  function handlePlace() {
    if (!lastReticlePos.current) return;
    const color = BOX_COLORS[placedObjects.length % BOX_COLORS.length];
    setPlacedObjects((prev) => [
      ...prev,
      { position: lastReticlePos.current!.clone(), color },
    ]);
  }

  function handleClear() {
    setPlacedObjects([]);
  }

  async function handleStartAR() {
    try {
      await xrStore.enterAR();
      setArActive(true);
    } catch (err) {
      console.error('Failed to start AR:', err);
      alert('Could not start AR session. Make sure you are using HTTPS and a supported device.');
    }
  }

  function handleExitAR() {
    const state = xrStore.getState();
    state.session?.end();
    setArActive(false);
    setPlacedObjects([]);
  }

  /* ---- Pre-AR info screen ---- */
  if (!arActive) {
    return (
      <div className="screen">
        <div className="screen-header">
          <button className="back-btn" onClick={() => navigateTo('entry')} aria-label="Go back">
            ←
          </button>
          <div className="screen-header-info">
            <span className="step-label">AR Test</span>
            <h2>Test AR Capabilities</h2>
          </div>
        </div>

        {/* What this tests */}
        <div className="card">
          <div className="card-header">
            <div className="card-icon card-icon-primary">📱</div>
            <div>
              <p className="card-title">WebXR AR Test</p>
              <p className="card-subtitle">Verify your device supports AR</p>
            </div>
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 16 }}>
            This test opens your camera and checks:
          </p>
          <ul
            style={{
              fontSize: '0.875rem',
              color: 'var(--text-secondary)',
              paddingLeft: 20,
              margin: '0 0 16px',
              lineHeight: 1.8,
            }}
          >
            <li>WebXR immersive-ar session</li>
            <li>Floor detection (hit-test)</li>
            <li>Plane detection</li>
            <li>3D object placement on real surfaces</li>
          </ul>
        </div>

        {/* Instructions */}
        <div className="card">
          <div className="card-header">
            <div className="card-icon card-icon-success">💡</div>
            <div>
              <p className="card-title">How It Works</p>
            </div>
          </div>
          <ol
            style={{
              fontSize: '0.875rem',
              color: 'var(--text-secondary)',
              paddingLeft: 20,
              margin: 0,
              lineHeight: 2,
            }}
          >
            <li>Tap <strong>"Launch AR"</strong> below</li>
            <li>Point your camera at the <strong>floor</strong></li>
            <li>Wait for the <strong>green ring</strong> to appear</li>
            <li>Tap <strong>"Place Object"</strong> to drop a 3D box</li>
            <li>Walk around to see the box stays in place</li>
          </ol>
        </div>

        {/* Requirements */}
        <div className="card card-sm">
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            <strong>Requirements:</strong> Android Chrome 79+ with ARCore, or iOS Safari with
            WebXR support · <strong>HTTPS connection required</strong> (use Vercel deploy URL)
          </p>
        </div>

        <div className="spacer" />

        <button
          id="launch-ar-btn"
          className="btn btn-primary"
          onClick={handleStartAR}
        >
          🚀 Launch AR Test
        </button>
      </div>
    );
  }

  /* ---- AR session active ---- */
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999 }}>
      <Canvas
        style={{ position: 'absolute', inset: 0 }}
        gl={{ antialias: true, alpha: true }}
      >
        <XR store={xrStore}>
          <ARScene placedObjects={placedObjects} onReticleUpdate={handleReticleUpdate} />
          <AROverlayUI
            objectCount={placedObjects.length}
            onPlace={handlePlace}
            onClear={handleClear}
            onExit={handleExitAR}
          />
        </XR>
      </Canvas>
    </div>
  );
}
