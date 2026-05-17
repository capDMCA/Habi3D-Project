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
import { supabase } from '../supabase';
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
    if (!canvasRef.current) return;
    drawFloorPlan(canvasRef.current, items, result.violations, roomWidthCm, roomLengthCm);
  }, [items, result.violations, roomLengthCm, roomWidthCm]);

  useEffect(() => {
    if (!participantId || scoreSaveAttemptedRef.current) return;
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

  if (loading) {
    return (
      <div className="screen" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div className="card" style={{ textAlign: 'center' }}>
          <p className="card-title">Analysing your layout...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="screen" style={{ maxWidth: 640, paddingBottom: 110 }}>
      <section style={{ height: '55vh', minHeight: 360, borderRadius: 16, overflow: 'hidden', border: '1px solid var(--border)', position: 'relative', marginBottom: 16 }}>
        <Canvas style={{ width: '100%', height: '100%', background: '#f8fafc' }} gl={{ antialias: true, alpha: true }}>
          <XR store={xrAnalysisStore}>
            <AnalysisScene
              items={items}
              classifications={result.allClassifications}
              roomWidthCm={roomWidthCm}
              roomLengthCm={roomLengthCm}
            />
          </XR>
        </Canvas>
        <div style={{ position: 'absolute', top: 12, left: 12, right: 12, display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ background: 'rgba(15,23,42,0.86)', color: 'white', padding: 12, borderRadius: 14 }}>
            <span style={stepBadgeStyle}>Spatial Clearance Visualization Overlay</span>
          </div>
          <button className="btn btn-secondary" type="button" style={{ width: 'auto' }} onClick={() => xrAnalysisStore.enterAR().catch(console.warn)}>
            Open AR
          </button>
        </div>
      </section>

      <section className="card">
        <p className="info-label">Space Utilization Score</p>
        <p style={{ margin: '4px 0', fontSize: 42, lineHeight: 1, fontWeight: 800, color: '#1F3864' }}>
          {result.spaceScoreBefore.toFixed(1)}%
        </p>
        <p className="card-subtitle">of your floor area is free</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
          <Pill label={`${redCount} RED violations`} color="#E24B4A" />
          <Pill label={`${yellowCount} YELLOW warnings`} color="#F0A500" />
          <Pill label={`${greenCount} GREEN`} color="#4CAF50" />
        </div>
      </section>

      <section className="card">
        <p className="card-title">2D floor plan</p>
        <canvas ref={canvasRef} style={{ width: '100%', height: 160, display: 'block', marginTop: 12, borderRadius: 12, border: '1px solid var(--border)' }} />
      </section>

      <section style={{ display: 'grid', gap: 12 }}>
        {result.violations.map((violation) => (
          <div key={violation.id} className="card" style={{ borderLeft: `5px solid ${getColor(violation.classification)}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <span style={{ ...badgeStyle, backgroundColor: getColor(violation.classification), color: 'white' }}>
                  {violation.ruleCode}
                </span>
                <p className="card-title" style={{ marginTop: 10, fontSize: 16 }}>{violation.furnitureLabel}</p>
                <p className="card-subtitle">{violation.ruleLabel}</p>
              </div>
              <p style={{ margin: 0, color: '#64748b', fontSize: 12 }}>
                Priority Score: {violation.priorityScore.toLocaleString()}
              </p>
            </div>
            <p style={{ margin: '12px 0 0', fontSize: 13, color: '#475569' }}>
              Measured: {violation.measuredCm}cm&nbsp;&nbsp; Required: {violation.requiredCm}cm&nbsp;&nbsp; Shortfall: {violation.shortfallCm}cm
            </p>
          </div>
        ))}
      </section>

      <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, padding: 14, background: 'var(--card)', borderTop: '1px solid var(--border)', zIndex: 20 }}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          {result.violations.length > 0 ? (
            <button className="btn btn-primary" type="button" onClick={() => navigateTo('recommendations')}>
              Fix violations step by step
            </button>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              <div style={{ padding: 12, borderRadius: 16, background: '#ECFDF5', color: '#166534', fontWeight: 700 }}>
                All 10 clearance standards met
              </div>
              <button className="btn btn-secondary" type="button" onClick={() => navigateTo('report')}>
                Export report
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Pill({ label, color }: { label: string; color: string }) {
  return (
    <span style={{ padding: '7px 10px', borderRadius: 999, backgroundColor: `${color}22`, color, fontWeight: 700, fontSize: 12 }}>
      {label}
    </span>
  );
}

const badgeStyle: CSSProperties = {
  display: 'inline-flex',
  padding: '4px 9px',
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 800,
};

const stepBadgeStyle: CSSProperties = {
  display: 'inline-block',
  fontSize: 11,
  fontWeight: 600,
  color: '#1F3864',
  backgroundColor: '#e6edf8',
  padding: '3px 12px',
  borderRadius: 20,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
};
