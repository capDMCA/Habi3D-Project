import { useState, useRef, useCallback, useEffect } from 'react';
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
  hitTest: true,            // optional feature (not 'required' — some devices reject that)
  planeDetection: true,
  domOverlay: true,
  handTracking: false,
  meshDetection: false,
  depthSensing: false,
});

/* ------------------------------------------------------------------ 
   Diagnostics — checks device/browser AR capabilities
   ------------------------------------------------------------------ */
interface Diagnostics {
  isHttps: boolean;
  hasNavigatorXR: boolean;
  arSupported: boolean | null; // null = still checking
  userAgent: string;
  error: string;
}

function useDiagnostics(): Diagnostics {
  const [diag, setDiag] = useState<Diagnostics>(() => {
    const hasNavigatorXR = typeof navigator !== 'undefined' && 'xr' in navigator;
    return {
      isHttps: location.protocol === 'https:' || location.hostname === 'localhost',
      hasNavigatorXR,
      arSupported: hasNavigatorXR ? null : false,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      error: hasNavigatorXR ? '' : 'WebXR API not available in this browser',
    };
  });

  useEffect(() => {
    if (diag.hasNavigatorXR && diag.arSupported === null) {
      navigator.xr!.isSessionSupported('immersive-ar').then(
        (supported) =>
          setDiag((d) => ({
            ...d,
            arSupported: supported,
            error: supported ? '' : 'immersive-ar not supported on this device',
          })),
        (err) => setDiag((d) => ({ ...d, arSupported: false, error: String(err) })),
      );
    }
  }, [diag.hasNavigatorXR, diag.arSupported]);

  return diag;
}

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

      const valid = getWorldMatrix(_matrix, results[0]);
      if (!valid) return;

      _position.setFromMatrixPosition(_matrix);
      reticleRef.current.position.copy(_position);
      reticleRef.current.visible = true;
      onPositionUpdate(_position.clone());
    },
    'viewer'
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
                ? 'Point camera at the floor.\nTap Place when you see the green ring.'
                : `${objectCount} object${objectCount > 1 ? 's' : ''} placed`}
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
              Exit
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
                Clear
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
              Place Object
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
  const diag = useDiagnostics();

  const [arActive, setArActive] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [placedObjects, setPlacedObjects] = useState<
    Array<{ position: THREE.Vector3; color: string }>
  >([]);
  const lastReticlePos = useRef<THREE.Vector3 | null>(null);

  const handleReticleUpdate = useCallback((pos: THREE.Vector3) => {
    lastReticlePos.current = pos;
  }, []);

  useEffect(() => {
    return xrStore.subscribe((state, prevState) => {
      if (state.session === prevState.session) return;

      const hasSession = state.session != null;
      setArActive(hasSession);

      if (!hasSession) {
        setPlacedObjects([]);
        lastReticlePos.current = null;
      }
    });
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
    setErrorMsg('');
    try {
      const session = await xrStore.enterAR();
      if (session) {
        setArActive(true);
      } else {
        setErrorMsg('AR session returned empty. Your device may not support WebXR AR.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('Failed to start AR:', err);
      setErrorMsg(msg);
    }
  }

  function handleExitAR() {
    const state = xrStore.getState();
    state.session?.end();
    setArActive(false);
    setPlacedObjects([]);
  }

  const canLaunch = diag.isHttps && diag.arSupported === true;

  /* ---- Pre-AR info screen ---- */
  const preARScreen = (
      <div className="screen">
        <div className="screen-header">
          <button className="back-btn" onClick={() => navigateTo('auth')} aria-label="Go back">
            ←
          </button>
          <div className="screen-header-info">
            <span className="step-label">AR Test</span>
            <h2>Test AR Capabilities</h2>
          </div>
        </div>

        {/* Device Diagnostics Card */}
        <div className="card">
          <div className="card-header">
            <div className="card-icon card-icon-primary">AR</div>
            <div>
              <p className="card-title">Device Diagnostics</p>
              <p className="card-subtitle">Checking your device capabilities</p>
            </div>
          </div>

          <div className="info-row">
            <span className="info-label">Connection</span>
            <span className="info-value">
              {diag.isHttps
                ? <span className="badge badge-success">HTTPS</span>
                : <span className="badge badge-danger">Not HTTPS</span>}
            </span>
          </div>
          <div className="info-row">
            <span className="info-label">WebXR API</span>
            <span className="info-value">
              {diag.hasNavigatorXR
                ? <span className="badge badge-success">Available</span>
                : <span className="badge badge-danger">Not available</span>}
            </span>
          </div>
          <div className="info-row">
            <span className="info-label">AR Support</span>
            <span className="info-value">
              {diag.arSupported === null
                ? <span className="badge">Checking…</span>
                : diag.arSupported
                  ? <span className="badge badge-success">Supported</span>
                  : <span className="badge badge-danger">Not supported</span>}
            </span>
          </div>
          <div className="info-row">
            <span className="info-label">URL</span>
            <span className="info-value" style={{ fontSize: '0.75rem', wordBreak: 'break-all' }}>
              {location.href}
            </span>
          </div>

          {!diag.isHttps && (
            <p style={{ fontSize: '0.8125rem', color: 'var(--danger)', marginTop: 12 }}>
              WebXR requires HTTPS. You are on HTTP. Deploy to Vercel and use the HTTPS URL.
            </p>
          )}
          {diag.hasNavigatorXR && diag.arSupported === false && (
            <p style={{ fontSize: '0.8125rem', color: 'var(--danger)', marginTop: 12 }}>
              Your browser/device does not support immersive-ar. Make sure you have:
              <br />• Android Chrome 79+ with <strong>Google Play Services for AR (ARCore)</strong> installed
              <br />• Or iOS Safari 15.4+ on iPhone/iPad with LiDAR
            </p>
          )}
          {!diag.hasNavigatorXR && (
            <p style={{ fontSize: '0.8125rem', color: 'var(--danger)', marginTop: 12 }}>
              This browser does not have the WebXR API. Try <strong>Google Chrome</strong> on Android.
            </p>
          )}
        </div>

        {/* Error message if AR failed */}
        {errorMsg && (
          <div className="card" style={{ borderColor: 'var(--danger-border)', background: 'var(--danger-bg)' }}>
            <div className="card-header">
              <div className="card-icon" style={{ background: 'var(--danger-bg)', color: 'var(--danger)', fontSize: '1rem', fontWeight: 700 }}>!</div>
              <div>
                <p className="card-title" style={{ color: 'var(--danger)' }}>AR Session Failed</p>
              </div>
            </div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--danger)', margin: 0, wordBreak: 'break-word' }}>
              {errorMsg}
            </p>
          </div>
        )}

        {/* Instructions */}
        <div className="card">
          <div className="card-header">
            <div className="card-icon card-icon-success">i</div>
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
            <strong>Requirements:</strong> Android Chrome 79+ with ARCore installed,
            or iOS Safari 15.4+ · <strong>HTTPS required</strong>
          </p>
        </div>

        <div className="spacer" />

        <button
          id="launch-ar-btn"
          className="btn btn-primary"
          onClick={handleStartAR}
          disabled={!canLaunch}
        >
          {!diag.isHttps ? 'HTTPS Required' : diag.arSupported === false ? 'AR Not Supported' : 'Launch AR Test'}
        </button>
      </div>
  );

  /* ---- AR session active ---- */
  return (
    <>
      {!arActive && preARScreen}

      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: arActive ? 9999 : -1,
          visibility: arActive ? 'visible' : 'hidden',
          pointerEvents: arActive ? 'auto' : 'none',
        }}
      >
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
    </>
  );
}
