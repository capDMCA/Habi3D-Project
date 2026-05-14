import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { createXRStore, XR, XROrigin } from '@react-three/xr';
import ClearanceOverlay from '../ar/ClearanceOverlay.tsx';
import { createFurnitureShape } from '../ar/shapeLibrary';
import { runClearanceAnalysis, type ClearanceResult } from '../engine/clearance';
import { useFurnitureStore } from '../stores/furnitureStore';
import { useSessionStore } from '../stores/sessionStore';
import { useViolationStore } from '../stores/violationStore';
import { supabase } from '../supabase';
import type { FurnitureItem } from '../types';
import { drawFloorPlan } from '../utils/floorPlan';

const xrAnalysisStore = createXRStore({
  offerSession: false,
  emulate: false,
  hitTest: true,
  planeDetection: true,
  domOverlay: true,
});

function getRoomDimensions(roomDimensions: ReturnType<typeof useSessionStore.getState>['roomDimensions']) {
  if (!roomDimensions) return { roomWidthCm: 360, roomLengthCm: 520 };

  return {
    roomWidthCm: Math.max(roomDimensions.livingWidthCm, roomDimensions.diningWidthCm),
    roomLengthCm: roomDimensions.livingDepthCm + roomDimensions.diningDepthCm,
  };
}

function FurnitureAnalysisMesh({ item }: { item: FurnitureItem }) {
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

function AnalysisARScene({
  items,
  result,
  roomWidthCm,
  roomLengthCm,
}: {
  items: FurnitureItem[];
  result: ClearanceResult;
  roomWidthCm: number;
  roomLengthCm: number;
}) {
  return (
    <>
      <ambientLight intensity={1.2} />
      <directionalLight position={[3, 5, 3]} intensity={0.9} />
      <XROrigin>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[roomWidthCm / 200 - 1, 0, roomLengthCm / 200 - 1]}>
          <planeGeometry args={[roomWidthCm / 100 + 2, roomLengthCm / 100 + 2]} />
          <meshBasicMaterial color="#f8fafc" />
        </mesh>
        {items.map((item) => (
          <FurnitureAnalysisMesh key={item.id} item={item} />
        ))}
        <ClearanceOverlay
          items={items}
          classifications={result.allClassifications}
          roomWidthCm={roomWidthCm}
          roomLengthCm={roomLengthCm}
        />
      </XROrigin>
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
  const [analysisLoading, setAnalysisLoading] = useState(true);
  const { roomWidthCm, roomLengthCm } = getRoomDimensions(roomDimensions);

  const result = useMemo(
    () => runClearanceAnalysis(items, roomWidthCm, roomLengthCm),
    [items, roomLengthCm, roomWidthCm],
  );

  const redCount = result.violations.filter((entry) => entry.classification === 'RED').length;
  const yellowCount = result.violations.filter((entry) => entry.classification === 'YELLOW').length;

  useEffect(() => {
    const timer = window.setTimeout(() => setAnalysisLoading(false), 120);
    return () => window.clearTimeout(timer);
  }, [items, roomWidthCm, roomLengthCm]);

  useEffect(() => {
    setViolations(result.violations);
    setSpaceScoreBefore(result.spaceScoreBefore);
  }, [result, setSpaceScoreBefore, setViolations]);

  useEffect(() => {
    if (!canvasRef.current) return;
    drawFloorPlan(canvasRef.current, items, result.allClassifications, roomWidthCm, roomLengthCm);
  }, [items, result.allClassifications, roomWidthCm, roomLengthCm]);

  useEffect(() => {
    let cancelled = false;

    async function saveScore() {
      if (!participantId) {
        console.warn('Score calculated locally. No participant ID is active.');
        return;
      }

      const { error } = await supabase.from('space_utilization_scores').insert({
        participant_id: participantId,
        score_before: result.spaceScoreBefore,
        score_after: 0,
        improvement_points: 0,
      });

      if (cancelled) return;
      if (error) console.warn(`Supabase save failed: ${error.message}`);

    }

    saveScore();
    return () => {
      cancelled = true;
    };
  }, [participantId, result.spaceScoreBefore]);

  async function startAROverlay() {
    try {
      await xrAnalysisStore.enterAR();
    } catch (err) {
      console.warn(err);
    }
  }

  return (
    <div className="screen" style={{ minHeight: '100vh', paddingBottom: 96 }}>
      <div style={{ width: '100%', marginBottom: 16, borderRadius: 20, overflow: 'hidden', height: '55vh', position: 'relative' }}>
        <Canvas style={{ width: '100%', height: '100%' }} gl={{ antialias: true, alpha: true }}>
          <XR store={xrAnalysisStore}>
            <AnalysisARScene
              items={items}
              result={result}
              roomWidthCm={roomWidthCm}
              roomLengthCm={roomLengthCm}
            />
          </XR>
        </Canvas>
        <div
          style={{
            position: 'absolute',
            left: 16,
            top: 16,
            right: 16,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 12,
          }}
        >
          <div style={{ background: 'rgba(15, 23, 42, 0.85)', padding: 12, borderRadius: 16, color: '#fff' }}>
            <p className="step-label" style={{ color: '#94a3b8', marginBottom: 4 }}>Spatial clearance overlay</p>
            <h2 style={{ margin: 0, fontSize: '1.3rem' }}>AR clearance view</h2>
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ alignSelf: 'flex-start' }}
            onClick={startAROverlay}
          >
            Open AR view
          </button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 220 }}>
            <p className="info-label">Space Utilization Score</p>
            <p className="info-value" style={{ fontSize: 32, fontWeight: 700 }}>{result.spaceScoreBefore.toFixed(1)}%</p>
            <p className="card-subtitle">of your floor area is free</p>
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ padding: 14, borderRadius: 16, background: 'rgba(242, 222, 222, 0.8)', minWidth: 120 }}>
              <p className="info-label">Red violations</p>
              <p className="info-value" style={{ color: '#E24B4A' }}>{redCount}</p>
            </div>
            <div style={{ padding: 14, borderRadius: 16, background: 'rgba(253, 240, 218, 0.9)', minWidth: 120 }}>
              <p className="info-label">Yellow warnings</p>
              <p className="info-value" style={{ color: '#F0A500' }}>{yellowCount}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <div className="card-icon card-icon-success">2D</div>
          <div>
            <p className="card-title">2D floor plan</p>
            <p className="card-subtitle">Exact clearance zones and furniture positions</p>
          </div>
        </div>
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height: 180, borderRadius: 12, marginTop: 12, display: 'block' }}
        />
      </div>

      {analysisLoading ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div className="loading-spinner" />
          <p style={{ marginTop: 16 }}>Analysing your layout...</p>
        </div>
      ) : result.violations.length === 0 ? (
        <div className="card" style={{ borderLeft: '4px solid #16A34A', background: '#ECFDF5' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 28, color: '#16A34A' }}>✓</span>
            <div>
              <p className="card-title">Your layout meets all 10 clearance standards</p>
              <p className="card-subtitle">Space Utilization Score: {result.spaceScoreBefore.toFixed(1)}%</p>
            </div>
          </div>
          <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => navigateTo('report')}>
            Export report
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 14, marginBottom: 96 }}>
          {result.violations.map((violation) => (
            <div
              key={violation.id}
              className="card"
              style={{ borderLeft: `4px solid ${violation.classification === 'RED' ? '#E24B4A' : '#F0A500'}` }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '6px 10px',
                      borderRadius: 999,
                      background: violation.classification === 'RED' ? '#FEE2E2' : '#FFFBEB',
                      color: violation.classification === 'RED' ? '#B91C1C' : '#92400E',
                      fontWeight: 700,
                      fontSize: 12,
                    }}
                  >
                    {violation.ruleCode}
                  </div>
                  <p className="card-title" style={{ marginTop: 10 }}>{violation.furnitureLabel}</p>
                  <p className="card-subtitle">{violation.ruleLabel}</p>
                </div>
                <div style={{ textAlign: 'right', minWidth: 120 }}>
                  <p className="info-label">Measured</p>
                  <p className="info-value">{violation.measuredCm} cm</p>
                  <p className="info-label" style={{ marginTop: 8 }}>Required</p>
                  <p className="info-value">{violation.requiredCm} cm</p>
                </div>
              </div>
              <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p className="card-subtitle">Priority Score: {violation.priorityScore.toLocaleString()}</p>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#475569', fontSize: 13 }}>
                  <span>{violation.measuredCm}</span>
                  <span>→</span>
                  <span>{violation.requiredCm}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          borderTop: '1px solid var(--border)',
          background: 'var(--card-bg)',
          padding: '14px 16px',
          display: 'flex',
          justifyContent: 'center',
          zIndex: 50,
        }}
      >
        {result.violations.length > 0 ? (
          <button className="btn btn-primary" style={{ width: '100%', maxWidth: 420 }} onClick={() => navigateTo('recommendation')}>
            Fix violations step by step
          </button>
        ) : (
          <button className="btn btn-secondary" style={{ width: '100%', maxWidth: 420 }} onClick={() => navigateTo('report')}>
            Export report
          </button>
        )}
      </div>
    </div>
  );
}
