import { useEffect, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { createXRStore, XR, XRDomOverlay } from '@react-three/xr';
import { useFurnitureStore } from '../stores/furnitureStore';
import { useSessionStore } from '../stores/sessionStore';
import ARMeasureSession from '../ar/ARMeasureSession';
import { createFurnitureShape } from '../ar/shapeLibrary';
import type { FurnitureCategory, FurnitureShape } from '../types';

const xrMeasureStore = createXRStore({
  offerSession: false,
  emulate: false,
  hitTest: true,
  planeDetection: true,
  domOverlay: true,
});

const CATEGORIES: Array<{ value: FurnitureCategory; label: string }> = [
  { value: 'sofa', label: 'Sofa' },
  { value: 'coffee_table', label: 'Coffee Table' },
  { value: 'tv_stand', label: 'TV Stand' },
  { value: 'dining_table', label: 'Dining Table' },
  { value: 'dining_chair', label: 'Dining Chair' },
  { value: 'cabinet', label: 'Cabinet' },
  { value: 'other', label: 'Other' },
];

const SHAPES: Array<{ value: FurnitureShape; label: string; hint: string }> = [
  { value: 'rectangle', label: 'Rectangle', hint: 'Sofas, cabinets, TV stands' },
  { value: 'l-shape', label: 'L-shape', hint: 'Sectionals or corner furniture' },
  { value: 'round', label: 'Round', hint: 'Round tables or stools' },
  { value: 'oval', label: 'Oval', hint: 'Oval dining or coffee tables' },
];

type MeasureTarget = 'length' | 'width';

function createFurnitureId(): string {
  if ('randomUUID' in crypto) return crypto.randomUUID();
  return `furniture-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function toPositiveInteger(value: string): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function ShapePreview({
  shape,
  lengthCm,
  widthCm,
  heightCm,
}: {
  shape: FurnitureShape;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
}) {
  const geometry = useMemo(
    () =>
      createFurnitureShape(shape, {
        lengthCm: Math.max(lengthCm, 120),
        widthCm: Math.max(widthCm, 60),
        heightCm: Math.max(heightCm, 40),
      }).geometry,
    [heightCm, lengthCm, shape, widthCm],
  );

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <Canvas
      style={{
        width: '100%',
        height: 160,
        background: 'rgba(31, 56, 100, 0.04)',
        borderRadius: 8,
      }}
      camera={{ position: [2.2, 1.8, 2.2], fov: 45 }}
    >
      <ambientLight intensity={1.5} />
      <directionalLight position={[3, 4, 3]} intensity={1.2} />
      <mesh geometry={geometry} rotation-y={-0.55}>
        <meshStandardMaterial color="#2B4E8C" roughness={0.45} metalness={0.05} />
      </mesh>
      <gridHelper args={[3, 6, '#94a3b8', '#cbd5e1']} position={[0, -0.31, 0]} />
    </Canvas>
  );
}

export default function FurnitureInputScreen() {
  const navigateTo = useSessionStore((s) => s.navigateTo);
  const roomDimensions = useSessionStore((s) => s.roomDimensions);
  const items = useFurnitureStore((s) => s.items);
  const addItem = useFurnitureStore((s) => s.addItem);

  const [category, setCategory] = useState<FurnitureCategory | ''>('');
  const [shape, setShape] = useState<FurnitureShape | ''>('');
  const [label, setLabel] = useState('');
  const [lengthCm, setLengthCm] = useState('');
  const [widthCm, setWidthCm] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [measureTarget, setMeasureTarget] = useState<MeasureTarget | null>(null);
  const [arActive, setArActive] = useState(false);
  const [arError, setArError] = useState('');

  useEffect(() => {
    return xrMeasureStore.subscribe((state, prevState) => {
      if (state.session === prevState.session) return;
      setArActive(state.session != null);
    });
  }, []);

  const canAddItem = useMemo(
    () =>
      category !== '' &&
      shape !== '' &&
      toPositiveInteger(lengthCm) > 0 &&
      toPositiveInteger(widthCm) > 0 &&
      toPositiveInteger(heightCm) > 0,
    [category, heightCm, lengthCm, shape, widthCm],
  );

  const selectedCategoryLabel =
    CATEGORIES.find((option) => option.value === category)?.label ?? 'Furniture';
  const measurementLabel =
    measureTarget === 'length'
      ? 'Measure furniture length'
      : measureTarget === 'width'
        ? 'Measure furniture width'
        : 'Measure furniture';

  async function startMeasurement(target: MeasureTarget) {
    setArError('');
    setMeasureTarget(target);

    try {
      await xrMeasureStore.enterAR();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setArError(message);
      setMeasureTarget(null);
    }
  }

  function stopMeasurement() {
    xrMeasureStore.getState().session?.end();
    setArActive(false);
    setMeasureTarget(null);
  }

  function handleMeasured(distanceCm: number) {
    if (measureTarget === 'length') {
      setLengthCm(String(distanceCm));
    }

    if (measureTarget === 'width') {
      setWidthCm(String(distanceCm));
    }

    window.setTimeout(stopMeasurement, 650);
  }

  function resetForm() {
    setCategory('');
    setShape('');
    setLabel('');
    setLengthCm('');
    setWidthCm('');
    setHeightCm('');
    setMeasureTarget(null);
    setArError('');
  }

  function handleAddItem() {
    if (!canAddItem || category === '' || shape === '') return;

    addItem({
      id: createFurnitureId(),
      label: label.trim() || selectedCategoryLabel,
      category,
      shape,
      lengthCm: toPositiveInteger(lengthCm),
      widthCm: toPositiveInteger(widthCm),
      heightCm: toPositiveInteger(heightCm),
      posX: 0,
      posZ: 0,
      rotationY: 0,
    });

    resetForm();
  }

  return (
    <>
      <div className="screen">
        {/* Header */}
        <div className="screen-header">
          <button className="back-btn" onClick={() => navigateTo('unitSetup')} aria-label="Go back">
            &lt;
          </button>
          <div className="screen-header-info">
            <span className="step-label">Step 3 of 7</span>
            <h2>Map Your Furniture</h2>
          </div>
        </div>

        {/* Progress */}
        <div className="progress-bar">
          <div className="progress-step completed" />
          <div className="progress-step completed" />
          <div className="progress-step active" />
          <div className="progress-step" />
          <div className="progress-step" />
          <div className="progress-step" />
          <div className="progress-step" />
        </div>

        {/* Room dims summary */}
        {roomDimensions && (
          <div className="card card-sm">
            <div className="card-header" style={{ marginBottom: 0 }}>
              <div className="card-icon card-icon-success">OK</div>
              <div>
                <p className="card-title">Unit Confirmed</p>
                <p className="card-subtitle">
                  Living {roomDimensions.livingWidthCm} x {roomDimensions.livingDepthCm}cm
                  {' | '}
                  Dining {roomDimensions.diningWidthCm} x {roomDimensions.diningDepthCm}cm
                </p>
              </div>
            </div>
          </div>
        )}

        {items.length > 0 && (
          <div className="card card-sm">
            <p className="card-title">Furniture Added</p>
            <p className="card-subtitle">
              {items.length} item{items.length === 1 ? '' : 's'} ready for position mapping
            </p>
          </div>
        )}

        <div className="card">
          <div className="card-header">
            <div className="card-icon card-icon-primary">1</div>
            <div>
              <p className="card-title">Category</p>
              <p className="card-subtitle">Choose the furniture type</p>
            </div>
          </div>

          <div className="option-group">
            {CATEGORIES.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`option-item ${category === option.value ? 'selected' : ''}`}
                onClick={() => {
                  setCategory(option.value);
                  if (!label) setLabel(option.label);
                }}
              >
                <span>{option.label}</span>
              </button>
            ))}
          </div>
        </div>

        {category && (
          <div className="card">
            <div className="card-header">
              <div className="card-icon card-icon-primary">2</div>
              <div>
                <p className="card-title">Shape</p>
                <p className="card-subtitle">Used for the visual model and bounding box</p>
              </div>
            </div>

            <div className="option-group">
              {SHAPES.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`option-item ${shape === option.value ? 'selected' : ''}`}
                  onClick={() => setShape(option.value)}
                >
                  <span>
                    <strong>{option.label}</strong>
                    <br />
                    <span className="form-sublabel">{option.hint}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {category && shape && (
          <div className="card">
            <div className="card-header">
              <div className="card-icon card-icon-primary">3</div>
              <div>
                <p className="card-title">Dimensions</p>
                <p className="card-subtitle">Measure length and width in AR, enter height manually</p>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="furniture-label">
                Label
              </label>
              <input
                id="furniture-label"
                className="form-input"
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                placeholder={selectedCategoryLabel}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Shape Preview</label>
              <ShapePreview
                shape={shape}
                lengthCm={toPositiveInteger(lengthCm)}
                widthCm={toPositiveInteger(widthCm)}
                heightCm={toPositiveInteger(heightCm)}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="length-cm">
                Length <span className="form-sublabel">(cm)</span>
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
                <input
                  id="length-cm"
                  className="form-input"
                  inputMode="numeric"
                  value={lengthCm}
                  onChange={(event) => setLengthCm(event.target.value.replace(/\D/g, ''))}
                  placeholder="Measure or enter"
                />
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ width: 'auto', minWidth: 112 }}
                  onClick={() => startMeasurement('length')}
                >
                  AR
                </button>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="width-cm">
                Width <span className="form-sublabel">(cm)</span>
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
                <input
                  id="width-cm"
                  className="form-input"
                  inputMode="numeric"
                  value={widthCm}
                  onChange={(event) => setWidthCm(event.target.value.replace(/\D/g, ''))}
                  placeholder="Measure or enter"
                />
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ width: 'auto', minWidth: 112 }}
                  onClick={() => startMeasurement('width')}
                >
                  AR
                </button>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="height-cm">
                Height <span className="form-sublabel">(cm, manual only)</span>
              </label>
              <input
                id="height-cm"
                className="form-input"
                inputMode="numeric"
                value={heightCm}
                onChange={(event) => setHeightCm(event.target.value.replace(/\D/g, ''))}
                placeholder="Enter height"
              />
            </div>

            {arError && <p className="form-error">{arError}</p>}

            <button className="btn btn-primary" onClick={handleAddItem} disabled={!canAddItem}>
              Confirm Furniture Item
            </button>
          </div>
        )}

        <div className="spacer" />

        {items.length > 0 && (
          <button
            className="btn btn-primary"
            onClick={() => navigateTo('positionMap')}
            style={{ marginBottom: 'var(--space-sm)' }}
          >
            Done Adding Furniture
          </button>
        )}

        <button className="btn btn-secondary" onClick={() => navigateTo('dimensionVerification')}>
          Continue to Room Scan
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
          <XR store={xrMeasureStore}>
            {measureTarget && (
              <ARMeasureSession
                key={measureTarget}
                onMeasured={handleMeasured}
              />
            )}

            <XRDomOverlay>
              <div
                style={{
                  position: 'fixed',
                  inset: 0,
                  pointerEvents: 'none',
                  fontFamily: "'Inter', system-ui, sans-serif",
                }}
              >
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
                    <strong>{measurementLabel}</strong>
                    <br />
                    Tap one edge, then tap the opposite edge.
                  </div>

                  <button
                    type="button"
                    onClick={stopMeasurement}
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
