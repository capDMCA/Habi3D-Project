import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { createXRStore, XR, XRDomOverlay, XROrigin } from '@react-three/xr';
import OverlayScene from '../ar/overlayRenderer';
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
      <ambientLight intensity={1.4} />
      <directionalLight position={[3, 5, 3]} intensity={0.9} />
      <XROrigin />
      {items.map((item) => (
        <FurnitureAnalysisMesh key={item.id} item={item} />
      ))}
      <OverlayScene
        items={items}
        classifications={result.allClassifications}
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
  const [arActive, setArActive] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');
  const { roomWidthCm, roomLengthCm } = getRoomDimensions(roomDimensions);

  const result = useMemo(
    () => runClearanceAnalysis(items, roomWidthCm, roomLengthCm),
    [items, roomLengthCm, roomWidthCm],
  );

  const redCount = result.violations.filter((entry) => entry.classification === 'RED').length;
  const yellowCount = result.violations.filter((entry) => entry.classification === 'YELLOW').length;

  useEffect(() => {
    setViolations(result.violations);
    setSpaceScoreBefore(result.spaceScoreBefore);
  }, [result, setSpaceScoreBefore, setViolations]);

  useEffect(() => {
    if (!canvasRef.current) return;
    drawFloorPlan(
      canvasRef.current,
      items,
      result.allClassifications,
      roomWidthCm,
      roomLengthCm,
    );
  }, [items, result, roomLengthCm, roomWidthCm]);

  useEffect(() => {
    let cancelled = false;

    async function saveScore() {
      if (!participantId) {
        setSaveStatus('Score calculated locally. No participant ID is active.');
        return;
      }

      const { error } = await supabase.from('space_utilization_scores').insert({
        participant_id: participantId,
        score_before: result.spaceScoreBefore,
        score_after: 0,
        improvement_points: 0,
      });

      if (cancelled) return;
      setSaveStatus(error ? `Supabase save failed: ${error.message}` : 'Score saved to Supabase.');
    }

    saveScore();
    return () => {
      cancelled = true;
    };
  }, [participantId, result.spaceScoreBefore]);

  useEffect(() => {
    return xrAnalysisStore.subscribe((state, prevState) => {
      if (state.session === prevState.session) return;
      setArActive(state.session != null);
    });
  }, []);

  async function startAROverlay() {
    try {
      await xrAnalysisStore.enterAR();
    } catch (err) {
      setSaveStatus(err instanceof Error ? err.message : String(err));
    }
  }

  function stopAROverlay() {
    xrAnalysisStore.getState().session?.end();
    setArActive(false);
  }

  return (
    <>
      <div className="screen">
        <div className="screen-header">
          <button className="back-btn" onClick={() => navigateTo('positionMap')} aria-label="Go back">
            &lt;
          </button>
          <div className="screen-header-info">
            <span className="step-label">Step 6 of 7</span>
            <h2>Clearance Analysis</h2>
          </div>
        </div>

        <div className="progress-bar">
          <div className="progress-step completed" />
          <div className="progress-step completed" />
          <div className="progress-step completed" />
          <div className="progress-step completed" />
          <div className="progress-step completed" />
          <div className="progress-step active" />
          <div className="progress-step" />
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-icon card-icon-primary">%</div>
            <div>
              <p className="card-title">Space Utilization Score</p>
              <p className="card-subtitle">{result.spaceScoreBefore}% free floor area before fixes</p>
            </div>
          </div>
          <div className="info-row">
            <span className="info-label">Violations found</span>
            <span className="info-value">{result.violations.length}</span>
          </div>
          <div className="info-row">
            <span className="info-label">Red</span>
            <span className="info-value">{redCount}</span>
          </div>
          <div className="info-row">
            <span className="info-label">Yellow</span>
            <span className="info-value">{yellowCount}</span>
          </div>
          {saveStatus && <p className="card-subtitle" style={{ marginTop: 12 }}>{saveStatus}</p>}
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-icon card-icon-success">2D</div>
            <div>
              <p className="card-title">Top-Down Floor Plan</p>
              <p className="card-subtitle">Worst classification color per item</p>
            </div>
          </div>
          <canvas
            ref={canvasRef}
            style={{
              width: '100%',
              height: 260,
              border: '1px solid var(--border)',
              borderRadius: 8,
            }}
          />
        </div>

        <button className="btn btn-primary" onClick={startAROverlay}>
          View AR Clearance Overlay
        </button>

        <button
          className="btn btn-secondary"
          onClick={() => navigateTo('recommendation')}
          style={{ marginTop: 'var(--space-sm)' }}
        >
          See step-by-step fixes
        </button>
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
          <XR store={xrAnalysisStore}>
            <AnalysisARScene
              items={items}
              result={result}
              roomWidthCm={roomWidthCm}
              roomLengthCm={roomLengthCm}
            />
            <XRDomOverlay>
              <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none' }}>
                <div
                  style={{
                    position: 'absolute',
                    top: 16,
                    left: 16,
                    right: 16,
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 12,
                    pointerEvents: 'auto',
                  }}
                >
                  <div
                    style={{
                      background: 'rgba(17, 24, 39, 0.86)',
                      color: 'white',
                      borderRadius: 8,
                      padding: '10px 12px',
                      fontSize: 13,
                      lineHeight: 1.4,
                      flex: 1,
                    }}
                  >
                    Red zones need correction. Yellow zones are usable but below comfort.
                  </div>
                  <button
                    type="button"
                    onClick={stopAROverlay}
                    style={{
                      background: '#ef4444',
                      color: 'white',
                      border: 0,
                      borderRadius: 8,
                      padding: '10px 14px',
                      fontWeight: 700,
                    }}
                  >
                    Exit
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
