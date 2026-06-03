import { useEffect, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

// ─── Types ────────────────────────────────────────────────────────────────────

export type MeasurePhase = 'scanning' | 'ready' | 'placed' | 'done' | 'error';

interface Props {
  onMeasured: (distanceCm: number) => void;
  onPhaseChange?: (phase: MeasurePhase, liveCm?: number) => void;
}

// ─── Module-level scratch objects (never recreated — no GC pressure) ──────────

const _mat = new THREE.Matrix4();
const _hitPos = new THREE.Vector3();

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Euclidean distance in the XZ floor plane, in centimetres. */
function floorCm(a: THREE.Vector3, b: THREE.Vector3): number {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  return Math.round(Math.sqrt(dx * dx + dz * dz) * 100);
}

function setLinePoints(line: THREE.Line, a: THREE.Vector3, b: THREE.Vector3) {
  const attr = line.geometry.attributes.position as THREE.BufferAttribute;
  attr.setXYZ(0, a.x, a.y + 0.01, a.z);
  attr.setXYZ(1, b.x, b.y + 0.01, b.z);
  attr.needsUpdate = true;
  line.geometry.computeBoundingSphere();
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ARMeasureSession({ onMeasured, onPhaseChange }: Props) {
  const { gl, scene } = useThree();

  // --- Stable refs — safe to read in useFrame without closure issues ---
  const hitSrcRef   = useRef<XRHitTestSource | null>(null);
  const latestHit   = useRef<THREE.Vector3 | null>(null);
  const pointA      = useRef<THREE.Vector3 | null>(null);
  const phaseRef    = useRef<MeasurePhase>('scanning');
  const doneRef     = useRef(false);
  const reticleRef  = useRef<THREE.Group>(null);
  const lineRef     = useRef<THREE.Line | null>(null);
  const cbRef       = useRef(onPhaseChange);
  const prevLiveCm  = useRef(-1);
  const prevNotifyT = useRef(0);

  // Keep callback ref current without adding it to effect deps
  useEffect(() => { cbRef.current = onPhaseChange; }, [onPhaseChange]);

  // --- React state (only drives JSX — not touched in useFrame) ---
  const [markerA, setMarkerA] = useState<THREE.Vector3 | null>(null);

  // Phase transition helper — throttles live-cm updates to ~10 fps
  function notify(phase: MeasurePhase, liveCm?: number) {
    if (liveCm !== undefined) {
      const now = performance.now();
      if (Math.abs(liveCm - prevLiveCm.current) < 2 && now - prevNotifyT.current < 100) return;
      prevLiveCm.current = liveCm;
      prevNotifyT.current = now;
    }
    cbRef.current?.(phase, liveCm);
  }

  // ── Initialize hit-test source directly from the raw XR session ──────────
  //
  //  This is the Three.js "webxr_ar_hittest" pattern.
  //  requestHitTestSource is called once after the session starts, not
  //  re-requested every frame, which is what causes timing failures in
  //  the @react-three/xr useXRHitTest wrapper.
  //
  useEffect(() => {
    let src: XRHitTestSource | null = null;

    async function init(session: XRSession) {
      try {
        const viewerSpace = await session.requestReferenceSpace('viewer');
        // requestHitTestSource is part of the hit-test WebXR module
        src = await (session as XRSession & {
          requestHitTestSource(o: { space: XRSpace }): Promise<XRHitTestSource | undefined>;
        }).requestHitTestSource({ space: viewerSpace }) ?? null;

        hitSrcRef.current = src;

        session.addEventListener('end', () => {
          src?.cancel();
          hitSrcRef.current = null;
        }, { once: true });

      } catch (err) {
        console.warn('[ARMeasure] hit-test source failed:', err);
        phaseRef.current = 'error';
        notify('error');
      }
    }

    // The session may already be running (component mounts inside <XR>)
    const existing = gl.xr.getSession();
    if (existing) {
      void init(existing);
    } else {
      // Race guard: listen for sessionstart in case enterAR() is still resolving
      function onStart() {
        const s = gl.xr.getSession();
        if (s) void init(s);
      }
      gl.xr.addEventListener('sessionstart', onStart);
      return () => {
        gl.xr.removeEventListener('sessionstart', onStart);
        src?.cancel();
        hitSrcRef.current = null;
      };
    }

    return () => {
      src?.cancel();
      hitSrcRef.current = null;
    };
  }, [gl]);

  // ── Measurement line — lives in the scene imperatively (no JSX) ─────────
  useEffect(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    const mat = new THREE.LineBasicMaterial({ color: '#facc15', linewidth: 1 });
    const line = new THREE.Line(geo, mat);
    line.visible = false;
    line.frustumCulled = false;
    scene.add(line);
    lineRef.current = line;
    return () => {
      scene.remove(line);
      geo.dispose();
      mat.dispose();
      lineRef.current = null;
    };
  }, [scene]);

  // ── Per-frame XR processing — direct hit-test API ────────────────────────
  useFrame((state, _, xrFrame) => {
    if (doneRef.current || !xrFrame) return;

    const refSpace = state.gl.xr.getReferenceSpace();
    const src      = hitSrcRef.current;
    const reticle  = reticleRef.current;
    if (!refSpace || !src || !reticle) return;

    // Core Three.js hit-test pattern: getHitTestResults every frame
    const results = (xrFrame as XRFrame).getHitTestResults(src as XRHitTestSource);

    if (results.length === 0) {
      reticle.visible = false;
      if (phaseRef.current === 'ready') {
        phaseRef.current = 'scanning';
        notify('scanning');
      }
      return;
    }

    const pose = results[0].getPose(refSpace);
    if (!pose) { reticle.visible = false; return; }

    // Position the reticle using the hit pose matrix (official Three.js pattern)
    _mat.fromArray(pose.transform.matrix);
    _hitPos.setFromMatrixPosition(_mat);
    latestHit.current = _hitPos.clone();

    reticle.matrix.copy(_mat);
    reticle.visible = true;

    // Transition scanning → ready
    if (phaseRef.current === 'scanning') {
      phaseRef.current = 'ready';
      notify('ready');
    }

    // Live line and distance after first point placed
    const pA = pointA.current;
    const line = lineRef.current;
    if (pA && line) {
      setLinePoints(line, pA, _hitPos);
      line.visible = true;
      notify('placed', floorCm(pA, _hitPos));
    }
  });

  // ── Tap handler ───────────────────────────────────────────────────────────
  useEffect(() => {
    function onTap(e: PointerEvent) {
      // Ignore taps on overlaid UI elements
      if ((e.target as HTMLElement)?.closest('button, input, select, textarea, a')) return;
      if (doneRef.current) return;

      const hit = latestHit.current;
      if (!hit) return;

      if (!pointA.current) {
        // ── First tap — place start marker ──
        const p = hit.clone();
        pointA.current = p;
        setMarkerA(p);
        phaseRef.current = 'placed';
        notify('placed', 0);
      } else {
        // ── Second tap — finalise ──
        const dist = floorCm(pointA.current, hit);
        doneRef.current = true;
        phaseRef.current = 'done';
        if (lineRef.current) lineRef.current.visible = false;
        notify('done');
        // Short delay so the user sees the "done" state before the session closes
        setTimeout(() => onMeasured(dist), 450);
      }
    }

    window.addEventListener('pointerdown', onTap);
    return () => window.removeEventListener('pointerdown', onTap);
  }, [onMeasured]);

  // ── JSX ───────────────────────────────────────────────────────────────────
  return (
    <>
      <ambientLight intensity={1.4} />
      <directionalLight position={[2, 5, 2]} intensity={1.0} />

      {/*
        Reticle group — matrix is set imperatively in useFrame.
        Children are rotated -90° on X so the ring/dot face upward (+Y),
        matching the floor surface the hit-pose matrix places them on.
        This mirrors the Three.js webxr_ar_hittest.html geometry.rotateX pattern.
      */}
      <group ref={reticleRef} visible={false} matrixAutoUpdate={false}>
        {/* Outer ring */}
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.055, 0.07, 40]} />
          <meshBasicMaterial
            color="#ffffff"
            side={THREE.DoubleSide}
            transparent
            opacity={0.92}
            depthWrite={false}
          />
        </mesh>
        {/* Centre dot */}
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.009, 24]} />
          <meshBasicMaterial
            color="#ffffff"
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      </group>

      {/* Start-point marker (blue sphere, stays after first tap) */}
      {markerA && (
        <mesh position={[markerA.x, markerA.y + 0.025, markerA.z]}>
          <sphereGeometry args={[0.025, 24, 16]} />
          <meshStandardMaterial color="#3b82f6" roughness={0.3} metalness={0.1} />
        </mesh>
      )}
    </>
  );
}
