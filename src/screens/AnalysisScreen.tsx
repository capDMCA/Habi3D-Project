import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Canvas } from '@react-three/fiber';
import { createXRStore, XR, XROrigin } from '@react-three/xr';
import ClearanceOverlay from '../ar/ClearanceOverlay';
import { createFurnitureShape } from '../ar/shapeLibrary';
import { runClearanceAnalysis } from '../engine/clearance';
import { useFurnitureStore } from '../stores/furnitureStore';
import { useSessionStore } from '../stores/sessionStore';
import { useViolationStore } from '../stores/violationStore';
import { hasSupabaseConfig, supabase } from '../supabase';
import type { FurnitureItem, RoomDimensions, Violation } from '../types';
import { drawFloorPlan } from '../utils/floorPlan';

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

function getColor(classification: Violation['classification']) {
  if (classification === 'RED') return '#E24B4A';
  if (classification === 'YELLOW') return '#F0A500';
  return '#4CAF50';
}

function FurnitureMesh({ item }: { item: FurnitureItem }) {
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
      {items.map((item) => (
        <FurnitureMesh key={item.id} item={item} />
      ))}
      <ClearanceOverlay
        items={items}
        classifications={classifications}
        roomWidthCm={roomWidthCm}
        roomLengthCm={roomLengthCm}
      />
    </>
  );
}

export default function AnalysisScreen() {
  const navigateTo = useSessionStore((s) => s.navigateTo);
  const participantId = useSessionStore((s) => s.participantId);
  const roomDimensions = useSessionStore((s) => s.roomDimensions);
  const items = useFurnitureStore((s) => s.items);
  const setViolations = useViolationStore((s) => s.setViolations);
  const setSpaceScoreBefore = useViolationStore((s) => s.setSpaceScoreBefore);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scoreSaveAttemptedRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [arError, setArError] = useState('');
  const { roomWidthCm, roomLengthCm } = getRoomDimensions(roomDimensions);

  const result = useMemo(
    () => runClearanceAnalysis(items, roomWidthCm, roomLengthCm),
    [items, roomLengthCm, roomWidthCm],
  );

  const redCount = result.violations.filter((item) => item.classification === 'RED').length;
  const yellowCount = result.violations.filter((item) => item.classification === 'YELLOW').length;
  const greenCount = result.allClassifications.filter((item) => item.classification === 'GREEN').length;

  useEffect(() => {
    const timer = window.setTimeout(() => setLoading(false), 150);
    return () => window.clearTimeout(timer);
  }, [items, roomLengthCm, roomWidthCm]);

  useEffect(() => {
    setViolations(result.violations);
    setSpaceScoreBefore(result.spaceScoreBefore);
  }, [result.violations, result.spaceScoreBefore, setSpaceScoreBefore, setViolations]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const redraw = () => {
      drawFloorPlan(canvas, items, result.violations, roomWidthCm, roomLengthCm);
    };

    const frame = window.requestAnimationFrame(redraw);
    const observer = new ResizeObserver(redraw);
    observer.observe(canvas);

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [items, result.violations, roomLengthCm, roomWidthCm]);

  useEffect(() => {
    if (!participantId || !hasSupabaseConfig || scoreSaveAttemptedRef.current) return;
    scoreSaveAttemptedRef.current = true;
    supabase
      .from('space_utilization_scores')
      .insert({
        participant_id: participantId,
        score_before: result.spaceScoreBefore,
        score_after: 0,
        improvement_points: 0,
      })
      .then(({ error }) => {
        if (error) console.warn(error.message);
      });
  }, [participantId, result.spaceScoreBefore]);

  async function openArOverlay() {
    setArError('');
    try {
      await xrAnalysisStore.enterAR();
    } catch (error) {
      setArError(error instanceof Error ? error.message : String(error));
    }
  }

  if (loading) {
    return (
      <div className="screen" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div className="card" style={{ textAlign: 'center', width: '100%' }}>
          <p className="card-title">Analysing your layout...</p>
          <p className="card-subtitle">Checking clearance rules and preparing the overlay.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="screen" style={{ maxWidth: 680, paddingBottom: 116 }}>
      <section style={arPanelStyle}>
        <Canvas
          camera={{ position: [0, 4.5, 5.5], fov: 48 }}
          style={{ width: '100%', height: '100%', background: '#f8fafc' }}
          gl={{ antialias: true, alpha: true }}
        >
          <XR store={xrAnalysisStore}>
            <AnalysisScene
              items={items}
              classifications={result.allClassifications}
              roomWidthCm={roomWidthCm}
              roomLengthCm={roomLengthCm}
            />
          </XR>
        </Canvas>
        <div style={arOverlayHeaderStyle}>
          <div style={arLabelStyle}>
            <span style={stepBadgeStyle}>Spatial Clearance Visualization Overlay</span>
            <p style={{ margin: '8px 0 0', color: '#e5e7eb', fontSize: 12 }}>
              Open AR to inspect color zones on the floor.
            </p>
          </div>
          <button className="btn btn-secondary" type="button" style={{ width: 'auto', minWidth: 118 }} onClick={openArOverlay}>
            Open AR
          </button>
        </div>
      </section>

      {arError && (
        <div className="card" style={{ borderLeft: '5px solid #E24B4A', color: '#991B1B' }}>
          {arError}
        </div>
      )}

      <section className="card" style={scoreCardStyle}>
        <div>
          <p className="info-label">Space Utilization Score</p>
          <p style={scoreValueStyle}>{result.spaceScoreBefore.toFixed(1)}%</p>
          <p className="card-subtitle">of your floor area is free</p>
        </div>
        <div style={pillWrapStyle}>
          <Pill label={`${redCount} RED violations`} color="#E24B4A" />
          <Pill label={`${yellowCount} YELLOW warnings`} color="#F0A500" />
          <Pill label={`${greenCount} GREEN checks`} color="#4CAF50" />
        </div>
      </section>

      <section className="card">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <p className="card-title">2D floor plan preview</p>
            <p className="card-subtitle">Auto-fitted from your AR-mapped furniture positions.</p>
          </div>
          <span style={miniBadgeStyle}>{items.length} items</span>
        </div>
        <canvas ref={canvasRef} style={floorPlanCanvasStyle} />
      </section>

      <section style={{ display: 'grid', gap: 12 }}>
        {result.violations.length === 0 ? (
          <div className="card" style={{ borderLeft: '5px solid #4CAF50' }}>
            <p className="card-title">All 10 clearance standards met</p>
            <p className="card-subtitle">No RED violations or YELLOW warnings were found.</p>
          </div>
        ) : (
          result.violations.map((violation, index) => (
            <div key={violation.id} className="card" style={{ ...violationCardStyle, borderLeft: `5px solid ${getColor(violation.classification)}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <span style={{ ...badgeStyle, backgroundColor: getColor(violation.classification), color: 'white' }}>
                    {violation.ruleCode}
                  </span>
                  <p className="card-title" style={{ marginTop: 10, fontSize: 16 }}>
                    {index + 1}. {violation.furnitureLabel}
                  </p>
                  <p className="card-subtitle">{violation.ruleLabel}</p>
                </div>
                <p style={priorityStyle}>Priority Score: {violation.priorityScore.toLocaleString()}</p>
              </div>
              <div style={metricsRowStyle}>
                <Metric label="Measured" value={`${violation.measuredCm}cm`} />
                <Metric label="Required" value={`${violation.requiredCm}cm`} />
                <Metric label="Shortfall" value={`${violation.shortfallCm}cm`} />
              </div>
            </div>
          ))
        )}
      </section>

      <div style={stickyFooterStyle}>
        <div style={{ maxWidth: 680, margin: '0 auto' }}>
          {result.violations.length > 0 ? (
            <button className="btn btn-primary" type="button" onClick={() => navigateTo('recommendations')}>
              Fix violations step by step
            </button>
          ) : (
            <button className="btn btn-primary" type="button" onClick={() => navigateTo('report')}>
              Export report
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Pill({ label, color }: { label: string; color: string }) {
  return (
    <span style={{ padding: '7px 10px', borderRadius: 999, backgroundColor: `${color}1f`, color, fontWeight: 800, fontSize: 12 }}>
      {label}
    </span>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ minWidth: 0 }}>
      <p style={{ margin: 0, color: '#94a3b8', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>
        {label}
      </p>
      <p style={{ margin: '2px 0 0', color: '#334155', fontSize: 13, fontWeight: 800 }}>
        {value}
      </p>
    </div>
  );
}

const arPanelStyle: CSSProperties = {
  height: '55vh',
  minHeight: 360,
  borderRadius: 16,
  overflow: 'hidden',
  border: '1px solid var(--border)',
  position: 'relative',
  marginBottom: 16,
  boxShadow: 'var(--shadow-md)',
};

const arOverlayHeaderStyle: CSSProperties = {
  position: 'absolute',
  top: 12,
  left: 12,
  right: 12,
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: 12,
};

const arLabelStyle: CSSProperties = {
  background: 'rgba(15,23,42,0.88)',
  color: 'white',
  padding: 12,
  borderRadius: 14,
  maxWidth: 320,
};

const scoreCardStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr',
  gap: 16,
};

const scoreValueStyle: CSSProperties = {
  margin: '4px 0',
  fontSize: 42,
  lineHeight: 1,
  fontWeight: 850,
  color: '#1F3864',
  letterSpacing: 0,
};

const pillWrapStyle: CSSProperties = {
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
};

const floorPlanCanvasStyle: CSSProperties = {
  width: '100%',
  height: 210,
  display: 'block',
  marginTop: 14,
  borderRadius: 14,
  border: '1px solid var(--border)',
  background: '#ffffff',
  boxShadow: 'inset 0 0 0 1px rgba(15,23,42,0.02)',
};

const violationCardStyle: CSSProperties = {
  borderRadius: 16,
  boxShadow: 'var(--shadow-sm)',
};

const metricsRowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: 10,
  marginTop: 14,
  paddingTop: 12,
  borderTop: '1px solid var(--border)',
};

const priorityStyle: CSSProperties = {
  margin: 0,
  color: '#64748b',
  fontSize: 12,
  fontWeight: 750,
  textAlign: 'right',
};

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

const badgeStyle: CSSProperties = {
  display: 'inline-flex',
  padding: '4px 9px',
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 800,
};

const miniBadgeStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  borderRadius: 999,
  padding: '5px 10px',
  color: '#1F3864',
  background: '#e6edf8',
  fontSize: 12,
  fontWeight: 800,
  whiteSpace: 'nowrap',
};

const stepBadgeStyle: CSSProperties = {
  display: 'inline-block',
  fontSize: 11,
  fontWeight: 700,
  color: '#1F3864',
  backgroundColor: '#e6edf8',
  padding: '3px 12px',
  borderRadius: 20,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
};
