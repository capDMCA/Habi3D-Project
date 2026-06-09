import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Canvas } from '@react-three/fiber';
import { createXRStore, XR, XRDomOverlay, XROrigin } from '@react-three/xr';
import ClearanceOverlay from '../ar/ClearanceOverlay';
import { createFurnitureShape } from '../ar/shapeLibrary';
import { runClearanceAnalysis } from '../engine/clearance';
import { useFurnitureStore } from '../stores/furnitureStore';
import { useSessionStore } from '../stores/sessionStore';
import { useViolationStore } from '../stores/violationStore';
import { hasSupabaseConfig, supabase } from '../supabase';
import type { FurnitureItem, RoomDimensions, Violation } from '../types';

const xrAnalysisStore = createXRStore({
  offerSession: false,
  emulate: false,
  hitTest: true,
  planeDetection: true,
  domOverlay: true,
});

function getRoomDimensions(roomDimensions: RoomDimensions | null) {
  if (!roomDimensions) return { roomWidthCm: 360, roomLengthCm: 520 };
  return {
    roomWidthCm: Math.max(roomDimensions.livingWidthCm, roomDimensions.diningWidthCm),
    roomLengthCm: roomDimensions.livingDepthCm + roomDimensions.diningDepthCm,
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FurnitureMesh({ item }: { item: FurnitureItem }) {
  const { geometry, boundingBox } = useMemo(
    () => createFurnitureShape(item.shape, { lengthCm: item.lengthCm, widthCm: item.widthCm, heightCm: item.heightCm }),
    [item.heightCm, item.lengthCm, item.shape, item.widthCm],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <group position={[item.posX, boundingBox.heightM / 2, item.posZ]} rotation={[0, item.rotationY, 0]}>
      <mesh geometry={geometry}>
        <meshStandardMaterial color="#2B4E8C" roughness={0.45} metalness={0.05} />
      </mesh>
    </group>
  );
}

function AnalysisScene({
  items,
  classifications,
  roomWidthCm,
  roomLengthCm,
}: {
  items: FurnitureItem[];
  classifications: ReturnType<typeof runClearanceAnalysis>['allClassifications'];
  roomWidthCm: number;
  roomLengthCm: number;
}) {
  return (
    <>
      <ambientLight intensity={1.25} />
      <directionalLight position={[3, 5, 3]} intensity={0.9} />
      <XROrigin />
      {items.map((item) => <FurnitureMesh key={item.id} item={item} />)}
      <ClearanceOverlay items={items} classifications={classifications} roomWidthCm={roomWidthCm} roomLengthCm={roomLengthCm} />
    </>
  );
}

function ClassBadge({ count, level, label }: { count: number; level: 'RED' | 'YELLOW' | 'GREEN'; label: string }) {
  const color = level === 'RED' ? '#E24B4A' : level === 'YELLOW' ? '#F0A500' : '#4CAF50';
  const bg = level === 'RED' ? '#FEF2F2' : level === 'YELLOW' ? '#FFFBEB' : '#ECFDF5';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '6px 12px', background: bg, borderRadius: 20 }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
      <span style={{ fontSize: 13, fontWeight: 700, color }}>{count} {label}</span>
    </div>
  );
}

function ViolationCard({ violation, rank }: { violation: Violation; rank: number }) {
  const color = violation.classification === 'RED' ? '#E24B4A' : '#F0A500';
  return (
    <div className="card card-sm" style={{ borderLeft: `4px solid ${color}`, marginBottom: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ background: color, color: 'white', padding: '2px 9px', borderRadius: 99, fontSize: 11, fontWeight: 800 }}>
              {violation.ruleCode}
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, color, letterSpacing: '0.04em' }}>
              {violation.classification}
            </span>
          </div>
          <p className="card-title" style={{ fontSize: '0.9375rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {rank}. {violation.furnitureLabel}
          </p>
          <p className="card-subtitle">{violation.ruleLabel}</p>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <p style={{ margin: 0, color: '#94a3b8', fontSize: 10, fontWeight: 600, textTransform: 'uppercase' }}>Priority</p>
          <p style={{ margin: '2px 0 0', color: '#334155', fontSize: 14, fontWeight: 800 }}>{violation.priorityScore.toLocaleString()}</p>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
        {[
          { label: 'Measured', value: `${violation.measuredCm} cm`, hi: false },
          { label: 'Required', value: `${violation.requiredCm} cm`, hi: false },
          { label: 'Shortfall', value: `${violation.shortfallCm} cm`, hi: true },
        ].map(({ label, value, hi }) => (
          <div key={label} style={{ textAlign: 'center' }}>
            <p style={{ margin: 0, color: '#94a3b8', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>{label}</p>
            <p style={{ margin: '2px 0 0', color: hi ? color : '#334155', fontSize: 13, fontWeight: 800 }}>{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function AnalysisScreen() {
  const navigateTo = useSessionStore((s) => s.navigateTo);
  const participantId = useSessionStore((s) => s.participantId);
  const roomDimensions = useSessionStore((s) => s.roomDimensions);
  const items = useFurnitureStore((s) => s.items);
  const setViolations = useViolationStore((s) => s.setViolations);
  const setSpaceScoreBefore = useViolationStore((s) => s.setSpaceScoreBefore);

  const scoreSaveAttemptedRef = useRef(false);
  const [arError, setArError] = useState('');
  const [arPreviewOpen, setArPreviewOpen] = useState(false);

  const { roomWidthCm, roomLengthCm } = getRoomDimensions(roomDimensions);

  const result = useMemo(
    () => runClearanceAnalysis(items, roomWidthCm, roomLengthCm),
    [items, roomLengthCm, roomWidthCm],
  );

  const redCount   = result.violations.filter((v) => v.classification === 'RED').length;
  const yellowCount = result.violations.filter((v) => v.classification === 'YELLOW').length;
  const greenCount  = result.allClassifications.filter((v) => v.classification === 'GREEN').length;

  // Detect furniture that hasn't been AR-placed yet (all at default origin)
  const hasUnpositioned = items.length > 0 && items.every((item) => item.posX === 0 && item.posZ === 0);

  useEffect(() => {
    setViolations(result.violations);
    setSpaceScoreBefore(result.spaceScoreBefore);
  }, [result.violations, result.spaceScoreBefore, setSpaceScoreBefore, setViolations]);

  // Save space score to Supabase (once per session)
  useEffect(() => {
    if (!participantId || !hasSupabaseConfig || scoreSaveAttemptedRef.current) return;
    scoreSaveAttemptedRef.current = true;
    supabase
      .from('space_utilization_scores')
      .insert({ participant_id: participantId, score_before: result.spaceScoreBefore, score_after: 0, improvement_points: 0 })
      .then(({ error }) => { if (error) console.warn(error.message); });
  }, [participantId, result.spaceScoreBefore]);

  async function openArOverlay() {
    setArError('');
    try {
      await xrAnalysisStore.enterAR();
    } catch (error) {
      setArError(error instanceof Error ? error.message : String(error));
    }
  }

  function exitAR() {
    xrAnalysisStore.getState().session?.end();
  }

  return (
    <div className="screen" style={{ maxWidth: 680, paddingBottom: 96 }}>

      {/* Header */}
      <div className="screen-header">
        <button className="back-btn" onClick={() => navigateTo('positionMap')} aria-label="Go back">
          ←
        </button>
        <div className="screen-header-info">
          <span className="step-label">Step 5 of 6</span>
          <h2>Clearance Analysis</h2>
        </div>
      </div>

      {/* Progress */}
      <div className="progress-bar">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className={`progress-step ${i < 4 ? 'completed' : i === 4 ? 'active' : ''}`} />
        ))}
      </div>

      {/* No furniture added state */}
      {items.length === 0 && (
        <div className="card" style={{ borderLeft: '5px solid var(--border)', textAlign: 'center', padding: 'var(--space-xl)' }}>
          <p className="card-title">No furniture added yet</p>
          <p className="card-subtitle" style={{ margin: '6px 0 16px' }}>
            Add furniture items and position them in AR before running analysis.
          </p>
          <button className="btn btn-secondary" onClick={() => navigateTo('furnitureInput')}>
            Add Furniture
          </button>
        </div>
      )}

      {/* Items added but not AR-positioned */}
      {hasUnpositioned && (
        <div className="card" style={{ borderLeft: '5px solid #F0A500', background: '#FFFBEB' }}>
          <p className="card-title" style={{ color: '#92400E' }}>Furniture not positioned in AR</p>
          <p className="card-subtitle" style={{ marginTop: 4 }}>
            All items are at the default origin. Go back to Position Map to place them in your room for accurate results.
          </p>
          <button className="btn btn-secondary" style={{ marginTop: 12 }} onClick={() => navigateTo('positionMap')}>
            Go to Position Map
          </button>
        </div>
      )}

      {items.length > 0 && (
        <>
          {/* Score summary */}
          <section className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
              <div>
                <p className="info-label" style={{ marginBottom: 4 }}>Free Floor Area</p>
                <p style={{ fontSize: 48, fontWeight: 850, color: '#1F3864', margin: 0, lineHeight: 1, letterSpacing: '-0.03em' }}>
                  {result.spaceScoreBefore.toFixed(1)}%
                </p>
                <p className="card-subtitle" style={{ marginTop: 6 }}>of your floor area is unoccupied</p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                <ClassBadge count={redCount}    level="RED"    label={redCount === 1 ? 'violation' : 'violations'} />
                <ClassBadge count={yellowCount} level="YELLOW" label={yellowCount === 1 ? 'warning' : 'warnings'} />
                <ClassBadge count={greenCount}  level="GREEN"  label="clear" />
              </div>
            </div>
          </section>

          {/* AR Overlay */}
          <section className="card card-sm">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div>
                <p className="card-title">AR Clearance Overlay</p>
                <p className="card-subtitle">Inspect color zones live in your room</p>
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button
                  className="btn btn-secondary"
                  type="button"
                  style={{ width: 'auto', fontSize: '0.875rem', padding: '10px 14px', minHeight: 40 }}
                  onClick={() => setArPreviewOpen((v) => !v)}
                >
                  {arPreviewOpen ? 'Hide 3D' : '3D Preview'}
                </button>
                <button
                  className="btn btn-primary"
                  type="button"
                  style={{ width: 'auto', fontSize: '0.875rem', padding: '10px 14px', minHeight: 40 }}
                  onClick={openArOverlay}
                >
                  Open AR
                </button>
              </div>
            </div>

            {arError && (
              <p className="form-error" style={{ marginTop: 8 }}>{arError}</p>
            )}

            {/* Canvas is always mounted so xrAnalysisStore.enterAR() has a
                Three.js context to attach to; the container controls visibility */}
            <div style={{
              marginTop: arPreviewOpen ? 12 : 0,
              height: arPreviewOpen ? 340 : 0,
              overflow: 'hidden',
              borderRadius: 10,
              border: arPreviewOpen ? '1px solid var(--border)' : 'none',
              background: '#f0f4f8',
            }}>
              <Canvas
                camera={{ position: [0, 4.5, 5.5], fov: 48 }}
                style={{ width: '100%', height: 340 }}
                gl={{ antialias: true, alpha: true }}
              >
                <XR store={xrAnalysisStore}>
                  <AnalysisScene
                    items={items}
                    classifications={result.allClassifications}
                    roomWidthCm={roomWidthCm}
                    roomLengthCm={roomLengthCm}
                  />
                  <XRDomOverlay>
                    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none' }}>
                      <button
                        type="button"
                        onClick={exitAR}
                        style={{
                          position: 'absolute', top: 16, right: 16,
                          background: 'rgba(239,68,68,0.92)', color: 'white',
                          border: 0, borderRadius: 12, padding: '12px 16px',
                          fontWeight: 700, fontSize: 14,
                          backdropFilter: 'blur(8px)', pointerEvents: 'auto',
                        }}
                      >
                        Exit AR
                      </button>
                    </div>
                  </XRDomOverlay>
                </XR>
              </Canvas>
            </div>
          </section>

          {/* Violations / all-clear */}
          {result.violations.length === 0 ? (
            <div className="card" style={{ borderLeft: '5px solid #4CAF50', background: '#ECFDF5' }}>
              <p className="card-title" style={{ color: '#166534' }}>All 10 clearance standards met</p>
              <p className="card-subtitle" style={{ marginTop: 4 }}>
                No RED violations or YELLOW warnings found in this layout.
              </p>
            </div>
          ) : (
            <section>
              <p style={{ margin: '0 0 10px 4px', fontSize: '0.875rem', fontWeight: 700, color: '#475569' }}>
                {result.violations.length} issue{result.violations.length !== 1 ? 's' : ''} found — sorted by priority
              </p>
              <div style={{ display: 'grid', gap: 10 }}>
                {result.violations.map((violation, index) => (
                  <ViolationCard key={violation.id} violation={violation} rank={index + 1} />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {/* Sticky footer */}
      <div style={stickyFooterStyle}>
        <div style={{ maxWidth: 680, margin: '0 auto' }}>
          {items.length === 0 ? (
            <button className="btn btn-secondary" type="button" onClick={() => navigateTo('furnitureInput')}>
              Add Furniture
            </button>
          ) : result.violations.length > 0 ? (
            <button className="btn btn-primary" type="button" onClick={() => navigateTo('recommendations')}>
              Fix violations — step by step
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ─── Style constants ──────────────────────────────────────────────────────────

const stickyFooterStyle: CSSProperties = {
  position: 'fixed',
  left: 0,
  right: 0,
  bottom: 0,
  padding: 14,
  paddingBottom: 'calc(14px + env(safe-area-inset-bottom, 0px))',
  background: 'rgba(255,255,255,0.96)',
  borderTop: '1px solid var(--border)',
  zIndex: 20,
  backdropFilter: 'blur(10px)',
};
