import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { Canvas } from '@react-three/fiber';
import { createXRStore, XR, XRDomOverlay } from '@react-three/xr';
import { useFurnitureStore, getDefaultRoomPosition } from '../stores/furnitureStore';
import { useSessionStore } from '../stores/sessionStore';
import { useAutosaveLayout } from '../stores/useAutosaveLayout';
import ARMeasureSession, { type MeasurePhase } from '../ar/ARMeasureSession';
import { createFurnitureShape } from '../ar/shapeLibrary';
import Spinner from '../components/Spinner';
import BackIcon from '../components/BackIcon';
import { fontFamily, numeric } from '../components/tokens';
import { CONDO_ROOMS } from '../data/condoLayout';
import {
  CATALOG_DOMAINS,
  CATALOG_PRESETS,
  type CatalogDomain,
  type FurnitureCatalogPreset,
} from '../data/furnitureCatalog';
import type { FurnitureCategory, FurnitureItem, FurnitureShape, PlacementType } from '../types';

const xrMeasureStore = createXRStore({
  offerSession: false,
  emulate: false,
  hitTest: true,
  domOverlay: true,
});

const CATEGORIES: Array<{
  key: FurnitureCategory;
  label: string;
  shapes: FurnitureShape[];
}> = [
  { key: 'sofa', label: 'Sofa & Sectional', shapes: ['rectangle', 'l-shape'] },
  { key: 'armchair', label: 'Armchair & Accent Chair', shapes: ['rectangle', 'round'] },
  { key: 'coffee_table', label: 'Coffee Table', shapes: ['rectangle', 'round', 'oval'] },
  { key: 'side_table', label: 'Side & End Table', shapes: ['rectangle', 'round', 'oval'] },
  { key: 'tv_stand', label: 'TV Stand & Media Console', shapes: ['rectangle'] },
  { key: 'cabinet', label: 'Cabinet, Dresser & Bookshelf', shapes: ['rectangle'] },
  { key: 'bed', label: 'Bed (Queen, Double, Single)', shapes: ['rectangle'] },
  { key: 'wardrobe', label: 'Wardrobe & Closet', shapes: ['rectangle'] },
  { key: 'dining_table', label: 'Dining Table', shapes: ['rectangle', 'round', 'oval'] },
  { key: 'dining_chair', label: 'Dining Chair & Stool', shapes: ['rectangle', 'round'] },
  { key: 'work_desk', label: 'Work Desk & Study Table', shapes: ['rectangle', 'l-shape'] },
  { key: 'appliance', label: 'Household Appliance', shapes: ['rectangle'] },
  { key: 'electrical', label: 'Electrical, Fan, Lamp & TV', shapes: ['rectangle', 'round'] },
  { key: 'mirror', label: 'Mirror (Standing / Wall)', shapes: ['rectangle', 'round', 'oval'] },
  { key: 'plant', label: 'Decorative Plant & Pot', shapes: ['round', 'rectangle'] },
  { key: 'bathroom_fixture', label: 'Bathroom Vanity & Hamper', shapes: ['rectangle', 'round'] },
  { key: 'storage_rack', label: 'Shoe Rack & Utility Shelf', shapes: ['rectangle'] },
  { key: 'other', label: 'Other Furniture / Object', shapes: ['rectangle', 'l-shape', 'round', 'oval'] },
];

const SHAPES: Array<{ value: FurnitureShape; label: string; hint: string }> = [
  { value: 'rectangle', label: 'Rectangle / Square', hint: 'Sofas, beds, cabinets, desks, appliances' },
  { value: 'round', label: 'Round / Circular', hint: 'Round tables, pedestal fans, lamps, stools, plant pots' },
  { value: 'l-shape', label: 'L-Shape (Sectional)', hint: 'Sectional corner sofas, L-shaped desks' },
  { value: 'oval', label: 'Oval', hint: 'Oval dining tables, coffee tables' },
];

type MeasureTarget = 'length' | 'width' | 'diameter';

function createFurnitureId(): string {
  if ('randomUUID' in crypto) return crypto.randomUUID();
  return `furniture-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function toPositiveNumber(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? Number(parsed.toFixed(1)) : 0;
}

function sanitizeDecimal(value: string): string {
  const digitsAndDot = value.replace(/[^0-9.]/g, '');
  const parts = digitsAndDot.split('.');
  return parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : digitsAndDot;
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
        lengthCm: Math.max(lengthCm, 40),
        widthCm: Math.max(widthCm, 30),
        heightCm: Math.max(heightCm, 25),
      }).geometry,
    [heightCm, lengthCm, shape, widthCm],
  );

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <Canvas
      style={{
        width: '100%',
        height: 170,
        background: 'linear-gradient(180deg, rgba(31, 56, 100, 0.03) 0%, rgba(31, 56, 100, 0.08) 100%)',
        borderRadius: 12,
        border: '1px solid rgba(0,0,0,0.06)',
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

function getCategoryLabel(category: FurnitureCategory) {
  return CATEGORIES.find((option) => option.key === category)?.label ?? 'Furniture';
}

function getShapeLabel(shape: FurnitureShape) {
  return SHAPES.find((option) => option.value === shape)?.label ?? shape;
}

function getRoomName(roomId?: string): string {
  if (!roomId) return 'Living Room';
  return CONDO_ROOMS.find((r) => r.id === roomId)?.label ?? roomId;
}

function FurnitureAddedPanel({
  items,
  onRemove,
}: {
  items: FurnitureItem[];
  onRemove: (id: string) => void;
}) {
  return (
    <div className="card card-sm" style={addedPanelStyle}>
      <div style={addedHeaderStyle}>
        <div>
          <p className="card-title">Configured Furniture & Objects</p>
          <p className="card-subtitle">
            {items.length} item{items.length === 1 ? '' : 's'} ready for whole-condo placement
          </p>
        </div>
        <span style={countBadgeStyle}>{items.length}</span>
      </div>

      <div style={addedListStyle}>
        {items.map((item) => (
          <div key={item.id} style={addedItemStyle}>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <p style={addedItemTitleStyle}>{item.label}</p>
                <span style={roomTagStyle}>{getRoomName(item.roomId)}</span>
                {item.placementType === 'wall' && (
                  <span style={wallBadgeStyle}>Wall ({item.mountHeightCm ?? 120} cm)</span>
                )}
              </div>
              <p style={addedItemMetaStyle}>
                {getCategoryLabel(item.category)} · {getShapeLabel(item.shape)}
              </p>
              <p style={addedItemDimsStyle}>
                {item.lengthCm} × {item.widthCm} × {item.heightCm} cm
                {item.quantity && item.quantity > 1 ? ` · Qty: ${item.quantity}` : ''}
              </p>
            </div>
            <button type="button" style={removeButtonStyle} onClick={() => onRemove(item.id)}>
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function FurnitureInputScreen() {
  const navigateTo = useSessionStore((s) => s.navigateTo);
  const roomDimensions = useSessionStore((s) => s.roomDimensions);
  const items = useFurnitureStore((s) => s.items);
  const addItem = useFurnitureStore((s) => s.addItem);
  const removeItem = useFurnitureStore((s) => s.removeItem);

  useAutosaveLayout(items);

  // Catalog Domain & Preset Selection State
  const [selectedDomain, setSelectedDomain] = useState<CatalogDomain | 'all'>('living');
  const [searchQuery, setSearchQuery] = useState('');
  const [activePresetId, setActivePresetId] = useState<string | null>(null);

  // Form Fields State
  const [category, setCategory] = useState<FurnitureCategory | ''>('sofa');
  const [shape, setShape] = useState<FurnitureShape | ''>('rectangle');
  const [label, setLabel] = useState('');
  const [selectedRoomId, setSelectedRoomId] = useState<string>('living');
  const [placementType, setPlacementType] = useState<PlacementType>('floor');
  const [mountHeightCm, setMountHeightCm] = useState<string>('120');
  const [rotationDeg, setRotationDeg] = useState<number>(0);
  const [lengthCm, setLengthCm] = useState('210');
  const [widthCm, setWidthCm] = useState('90');
  const [heightCm, setHeightCm] = useState('85');
  const [quantity, setQuantity] = useState<number>(1);
  const [isCustomEntry, setIsCustomEntry] = useState(false);

  // AR Measurement State
  const [measureTarget, setMeasureTarget] = useState<MeasureTarget | null>(null);
  const [arActive, setArActive] = useState(false);
  const [arError, setArError] = useState('');
  const [measurePhase, setMeasurePhase] = useState<MeasurePhase>('scanning');
  const [liveCm, setLiveCm] = useState(0);
  const [arInitializing, setArInitializing] = useState(false);
  const [measurementReview, setMeasurementReview] = useState<{
    rawCm: number;
    valueToUse: string;
    error: string;
  } | null>(null);
  const [retakeTrigger, setRetakeTrigger] = useState(0);

  useEffect(() => {
    return xrMeasureStore.subscribe((state, prevState) => {
      if (state.session === prevState.session) return;
      setArActive(state.session != null);
    });
  }, []);

  // Filter presets based on selected domain and search query
  const filteredPresets = useMemo(() => {
    return CATALOG_PRESETS.filter((preset) => {
      const matchesDomain = selectedDomain === 'all' || preset.domain === selectedDomain;
      const matchesQuery =
        !searchQuery.trim() ||
        preset.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        preset.notes?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        getRoomName(preset.defaultRoomId).toLowerCase().includes(searchQuery.toLowerCase());
      return matchesDomain && matchesQuery;
    });
  }, [searchQuery, selectedDomain]);

  // Load a preset into form state
  function handleSelectPreset(preset: FurnitureCatalogPreset) {
    setActivePresetId(preset.id);
    setIsCustomEntry(false);
    setLabel(preset.label);
    setCategory(preset.category);
    setShape(preset.shape);
    setSelectedRoomId(preset.defaultRoomId);
    setLengthCm(String(preset.lengthCm));
    setWidthCm(String(preset.widthCm));
    setHeightCm(String(preset.heightCm));
    setQuantity(preset.quantity ?? 1);
    setPlacementType(preset.placementType ?? 'floor');
    setMountHeightCm(preset.mountHeightCm ? String(preset.mountHeightCm) : '120');
    setRotationDeg(0);
  }

  // Handle switching to custom item mode
  function handleCustomItemMode() {
    setIsCustomEntry(true);
    setActivePresetId(null);
    setLabel('');
    setCategory('other');
    setShape('rectangle');
    setSelectedRoomId('living');
    setLengthCm('100');
    setWidthCm('60');
    setHeightCm('75');
    setQuantity(1);
    setPlacementType('floor');
    setMountHeightCm('120');
  }

  const selectedCategoryDef = CATEGORIES.find((option) => option.key === category);
  const availableShapes = selectedCategoryDef
    ? SHAPES.filter((s) => selectedCategoryDef.shapes.includes(s.value))
    : SHAPES;

  const canAddItem = useMemo(
    () =>
      category !== '' &&
      shape !== '' &&
      label.trim().length > 0 &&
      toPositiveNumber(lengthCm) > 0 &&
      toPositiveNumber(widthCm) > 0 &&
      toPositiveNumber(heightCm) > 0,
    [category, heightCm, label, lengthCm, shape, widthCm],
  );

  const measurementTitle =
    measureTarget === 'length'
      ? 'Measuring length'
      : measureTarget === 'width'
      ? 'Measuring width'
      : measureTarget === 'diameter'
      ? 'Measuring diameter'
      : 'Measuring';

  function handlePhaseChange(phase: MeasurePhase, cm?: number) {
    setMeasurePhase(phase);
    if (cm !== undefined) setLiveCm(cm);
  }

  async function startMeasurement(target: MeasureTarget) {
    setArError('');
    setMeasurePhase('scanning');
    setLiveCm(0);
    setMeasureTarget(target);
    setMeasurementReview(null);
    setArInitializing(true);
    try {
      await xrMeasureStore.enterAR();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setArError(message);
      setMeasureTarget(null);
    } finally {
      setArInitializing(false);
    }
  }

  function stopMeasurement() {
    xrMeasureStore.getState().session?.end();
    setArActive(false);
    setMeasureTarget(null);
    setMeasurePhase('scanning');
    setLiveCm(0);
    setMeasurementReview(null);
  }

  function handleMeasured(distanceCm: number) {
    setMeasurementReview({
      rawCm: distanceCm,
      valueToUse: String(distanceCm),
      error: '',
    });
  }

  function handleRetakeMeasurement() {
    setMeasurementReview(null);
    setRetakeTrigger((c) => c + 1);
  }

  function handleConfirmMeasurement() {
    if (!measurementReview) return;
    const num = Number.parseFloat(measurementReview.valueToUse);
    if (!Number.isFinite(num) || num <= 0) {
      setMeasurementReview((prev) =>
        prev ? { ...prev, error: 'Please enter a valid positive measurement (e.g. 97.4).' } : null,
      );
      return;
    }

    const roundedVal = Number(num.toFixed(1));
    const valStr = String(roundedVal);

    if (measureTarget === 'length') {
      setLengthCm(valStr);
    } else if (measureTarget === 'width') {
      setWidthCm(valStr);
    } else if (measureTarget === 'diameter') {
      setLengthCm(valStr);
      setWidthCm(valStr);
    }

    setMeasurementReview(null);
    stopMeasurement();
  }

  function resetForm() {
    setLabel('');
    setActivePresetId(null);
    setIsCustomEntry(false);
    setCategory('sofa');
    setShape('rectangle');
    setSelectedRoomId('living');
    setLengthCm('210');
    setWidthCm('90');
    setHeightCm('85');
    setQuantity(1);
    setPlacementType('floor');
    setMountHeightCm('120');
    setRotationDeg(0);
    setMeasureTarget(null);
    setMeasurementReview(null);
    setArError('');
  }

  function handleAddItem() {
    if (!canAddItem || category === '' || shape === '') return;

    const parsedLength = toPositiveNumber(lengthCm);
    const parsedWidth = toPositiveNumber(widthCm);
    const parsedHeight = toPositiveNumber(heightCm);
    const targetRoom = selectedRoomId || getDefaultRoomPosition(category, label).roomId;
    const rotRad = (rotationDeg * Math.PI) / 180;
    const parsedMountHeight = placementType === 'wall' ? toPositiveNumber(mountHeightCm) : undefined;

    addItem({
      id: createFurnitureId(),
      label: label.trim(),
      category,
      shape,
      lengthCm: parsedLength,
      widthCm: parsedWidth,
      heightCm: parsedHeight,
      posX: 0,
      posZ: 0,
      rotationY: rotRad,
      roomId: targetRoom,
      quantity: Math.max(1, quantity),
      placementType,
      mountHeightCm: parsedMountHeight,
    });

    resetForm();
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  return (
    <>
      <div className="screen">
        {/* Header */}
        <div className="screen-header">
          <button className="back-btn" onClick={() => navigateTo('entry')} aria-label="Go back">
            <BackIcon />
          </button>
          <div className="screen-header-info">
            <span className="step-label">Step 1 of 2</span>
            <h2>Furniture & Appliances Catalog</h2>
          </div>
        </div>

        {/* Progress */}
        <div className="progress-bar">
          <div className="progress-step active" />
          <div className="progress-step" />
        </div>

        {/* Room dims summary */}
        {roomDimensions && (
          <div className="card card-sm">
            <div className="card-header" style={{ marginBottom: 0 }}>
              <div className="card-icon card-icon-success">OK</div>
              <div>
                <p className="card-title">Mulberry Place — 2-Bedroom Unit</p>
                <p className="card-subtitle">
                  Whole-condo layout: Living, Dining, 2 Bedrooms, Kitchen, Bath, Balcony & Storage
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Added Items Panel */}
        {items.length > 0 && <FurnitureAddedPanel items={items} onRemove={removeItem} />}

        {/* STEP 1: CATALOG BROWSER */}
        <div className="card">
          <div className="card-header">
            <div className="card-icon card-icon-primary">1</div>
            <div>
              <p className="card-title">Browse Catalog & Presets</p>
              <p className="card-subtitle">
                Select predefined furniture, appliances, or electrical fixtures
              </p>
            </div>
          </div>

          {/* Search bar */}
          <div style={{ marginBottom: 12 }}>
            <input
              type="text"
              className="form-input"
              placeholder="🔍 Search items (e.g. Refrigerator, Sofa, Fan, Mirror, Bed)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>

          {/* Domain tabs */}
          <div style={domainTabsScrollStyle}>
            <button
              type="button"
              style={selectedDomain === 'all' ? selectedDomainTabStyle : domainTabStyle}
              onClick={() => setSelectedDomain('all')}
            >
              🌐 All Items
            </button>
            {CATALOG_DOMAINS.map((domain) => (
              <button
                key={domain.key}
                type="button"
                style={selectedDomain === domain.key ? selectedDomainTabStyle : domainTabStyle}
                onClick={() => setSelectedDomain(domain.key)}
              >
                {domain.icon} {domain.shortLabel}
              </button>
            ))}
          </div>

          {/* Presets Grid */}
          <div style={presetGridStyle}>
            {filteredPresets.map((preset) => {
              const isSelected = activePresetId === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  style={isSelected ? selectedPresetCardStyle : presetCardStyle}
                  onClick={() => handleSelectPreset(preset)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: isSelected ? 'var(--primary)' : 'var(--text-primary)' }}>
                      {preset.label}
                    </span>
                    <span style={badgeShapeStyle}>{preset.shape}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                    <span style={badgeDimsStyle}>
                      {preset.lengthCm} × {preset.widthCm} × {preset.heightCm} cm
                    </span>
                    <span style={badgeRoomStyle}>{getRoomName(preset.defaultRoomId)}</span>
                    {preset.placementType === 'wall' && (
                      <span style={badgeWallStyle}>Wall-Mounted</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          <div style={{ marginTop: 12, textAlign: 'center' }}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ width: '100%', fontSize: 13, fontWeight: 700 }}
              onClick={handleCustomItemMode}
            >
              ✏️ Add Custom / Non-Catalog Item
            </button>
          </div>
        </div>

        {/* STEP 2: CONFIGURE ITEM DETAILS */}
        <div className="card">
          <div className="card-header">
            <div className="card-icon card-icon-primary">2</div>
            <div>
              <p className="card-title">Configure Item & Room Assignment</p>
              <p className="card-subtitle">
                {isCustomEntry ? 'Define your custom piece' : 'Adjust preset dimensions and assign to any condo room'}
              </p>
            </div>
          </div>

          {/* Item Name */}
          <div className="form-group">
            <label className="form-label" htmlFor="furniture-label">
              Item Name / Label
            </label>
            <input
              id="furniture-label"
              className="form-input"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. 3-Seater Sofa, Refrigerator, Floor Lamp"
            />
          </div>

          {/* Category Dropdown */}
          <div className="form-group">
            <label className="form-label" htmlFor="furniture-category">
              Category
            </label>
            <select
              id="furniture-category"
              className="form-input"
              value={category}
              onChange={(e) => {
                const nextCategory = e.target.value as FurnitureCategory;
                setCategory(nextCategory);
                const def = CATEGORIES.find((c) => c.key === nextCategory);
                if (def && !def.shapes.includes(shape as FurnitureShape)) {
                  setShape(def.shapes[0]);
                }
              }}
            >
              {CATEGORIES.map((cat) => (
                <option key={cat.key} value={cat.key}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          {/* Target Room Selector (All 8 Condo Rooms) */}
          <div className="form-group">
            <label className="form-label" htmlFor="furniture-room">
              Intended Condo Room
            </label>
            <p className="form-sublabel" style={{ margin: '-2px 0 8px' }}>
              Assign to any of the 8 modeled rooms in the Mulberry Place unit
            </p>
            <select
              id="furniture-room"
              className="form-input"
              value={selectedRoomId}
              onChange={(e) => setSelectedRoomId(e.target.value)}
            >
              {CONDO_ROOMS.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.label} ({room.validationNote})
                </option>
              ))}
            </select>
          </div>

          {/* Placement Type: Floor vs Wall-Mounted */}
          <div className="form-group">
            <label className="form-label">Placement Type</label>
            <div style={placementTypeGridStyle}>
              <button
                type="button"
                style={placementType === 'floor' ? selectedPlacementBtnStyle : placementBtnStyle}
                onClick={() => setPlacementType('floor')}
              >
                🏠 Floor-Standing
              </button>
              <button
                type="button"
                style={placementType === 'wall' ? selectedPlacementBtnStyle : placementBtnStyle}
                onClick={() => setPlacementType('wall')}
              >
                🧱 Wall-Mounted
              </button>
            </div>
          </div>

          {/* Wall-Mounted Elevation Height */}
          {placementType === 'wall' && (
            <div className="form-group" style={wallNoticeBoxStyle}>
              <label className="form-label" htmlFor="mount-height-cm">
                Mounting Height Above Floor <span className="form-sublabel">(cm)</span>
              </label>
              <p className="form-sublabel" style={{ margin: '-2px 0 8px' }}>
                Wall objects (e.g. wall TV, air conditioner, wall mirror) elevate above floor clearance zones.
              </p>
              <input
                id="mount-height-cm"
                className="form-input"
                style={numeric}
                inputMode="decimal"
                value={mountHeightCm}
                onChange={(e) => setMountHeightCm(sanitizeDecimal(e.target.value))}
                placeholder="e.g. 120 (TV) or 200 (AC)"
              />
            </div>
          )}

          {/* Shape Selector */}
          <div className="form-group">
            <label className="form-label">Shape & Geometry</label>
            <div style={shapeGridStyle}>
              {availableShapes.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  style={shape === opt.value ? selectedShapeStyle : shapeChoiceStyle}
                  onClick={() => setShape(opt.value)}
                >
                  <strong style={choiceLabelStyle}>{opt.label}</strong>
                  <span className="form-sublabel">{opt.hint}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Dimensions Header & Notice */}
          <div className="form-group" style={{ marginBottom: 8 }}>
            <label className="form-label">Dimensions</label>
            <p style={dimNoticeStyle}>
              💡 Preset dimensions are standard defaults. Adjust length, width, and height in centimetres to match your actual furniture.
            </p>
          </div>

          {/* Dimensions Input Rows */}
          {shape === 'round' ? (
            <div className="form-group">
              <label className="form-label" htmlFor="diameter-cm">
                Diameter <span className="form-sublabel">(cm)</span>
              </label>
              <div style={measureRowStyle}>
                <input
                  id="diameter-cm"
                  className="form-input"
                  style={numeric}
                  inputMode="decimal"
                  value={lengthCm}
                  onChange={(event) => {
                    const sanitized = sanitizeDecimal(event.target.value);
                    setLengthCm(sanitized);
                    setWidthCm(sanitized);
                  }}
                  placeholder="e.g. 110"
                />
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={measureButtonStyle}
                  onClick={() => startMeasurement('diameter')}
                  disabled={arInitializing}
                >
                  {arInitializing && measureTarget === 'diameter' ? <Spinner /> : 'AR Measure'}
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="form-group">
                <label className="form-label" htmlFor="length-cm">
                  Length <span className="form-sublabel">(cm)</span>
                </label>
                <div style={measureRowStyle}>
                  <input
                    id="length-cm"
                    className="form-input"
                    style={numeric}
                    inputMode="decimal"
                    value={lengthCm}
                    onChange={(event) => setLengthCm(sanitizeDecimal(event.target.value))}
                    placeholder="e.g. 210"
                  />
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={measureButtonStyle}
                    onClick={() => startMeasurement('length')}
                    disabled={arInitializing}
                  >
                    {arInitializing && measureTarget === 'length' ? <Spinner /> : 'AR Measure'}
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="width-cm">
                  Width / Depth <span className="form-sublabel">(cm)</span>
                </label>
                <div style={measureRowStyle}>
                  <input
                    id="width-cm"
                    className="form-input"
                    style={numeric}
                    inputMode="decimal"
                    value={widthCm}
                    onChange={(event) => setWidthCm(sanitizeDecimal(event.target.value))}
                    placeholder="e.g. 90"
                  />
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={measureButtonStyle}
                    onClick={() => startMeasurement('width')}
                    disabled={arInitializing}
                  >
                    {arInitializing && measureTarget === 'width' ? <Spinner /> : 'AR Measure'}
                  </button>
                </div>
              </div>
            </>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="height-cm">
              Height <span className="form-sublabel">(cm, manual entry)</span>
            </label>
            <input
              id="height-cm"
              className="form-input"
              style={numeric}
              inputMode="decimal"
              value={heightCm}
              onChange={(event) => setHeightCm(sanitizeDecimal(event.target.value))}
              placeholder="e.g. 85"
            />
          </div>

          {/* Initial Rotation */}
          <div className="form-group">
            <label className="form-label">Initial Placement Orientation</label>
            <div style={rotationGridStyle}>
              {[0, 90, 180, 270].map((deg) => (
                <button
                  key={deg}
                  type="button"
                  style={rotationDeg === deg ? selectedRotationBtnStyle : rotationBtnStyle}
                  onClick={() => setRotationDeg(deg)}
                >
                  {deg}° {deg === 0 ? '(North)' : deg === 90 ? '(East)' : deg === 180 ? '(South)' : '(West)'}
                </button>
              ))}
            </div>
          </div>

          {/* Quantity Selector */}
          <div className="form-group">
            <label className="form-label" htmlFor="item-quantity">
              Quantity
            </label>
            <p className="form-sublabel" style={{ margin: '-2px 0 8px' }}>
              Specify quantity for chairs, stools, tables, plants, or household objects
            </p>
            <div style={stepperContainerStyle}>
              <button
                type="button"
                style={{
                  ...stepperBtnStyle,
                  opacity: quantity <= 1 ? 0.4 : 1,
                  cursor: quantity <= 1 ? 'not-allowed' : 'pointer',
                }}
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                disabled={quantity <= 1}
                aria-label="Decrease quantity"
              >
                −
              </button>
              <span style={stepperValueStyle}>{quantity}</span>
              <button
                type="button"
                style={{
                  ...stepperBtnStyle,
                  opacity: quantity >= 10 ? 0.4 : 1,
                  cursor: quantity >= 10 ? 'not-allowed' : 'pointer',
                }}
                onClick={() => setQuantity((q) => Math.min(10, q + 1))}
                disabled={quantity >= 10}
                aria-label="Increase quantity"
              >
                +
              </button>
              <span style={stepperHintStyle}>(1–10 items)</span>
            </div>
          </div>

          {/* Live 3D Shape Preview */}
          <div className="form-group" style={previewPanelStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label className="form-label" style={{ margin: 0 }}>
                Interactive 3D Geometry Preview
              </label>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>
                {getShapeLabel(shape as FurnitureShape)}
              </span>
            </div>
            <ShapePreview
              shape={(shape as FurnitureShape) || 'rectangle'}
              lengthCm={toPositiveNumber(lengthCm)}
              widthCm={toPositiveNumber(widthCm)}
              heightCm={toPositiveNumber(heightCm)}
            />
          </div>

          {/* Review Summary Before Adding */}
          <div style={reviewCardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#1e3a8a' }}>
                Summary Review
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#2563eb' }}>
                Qty: {quantity}
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px 12px', fontSize: 13 }}>
              <div>
                <span style={{ color: '#64748b' }}>Item:</span> <strong>{label.trim() || 'Untitled'}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b' }}>Room:</span> <strong>{getRoomName(selectedRoomId)}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b' }}>Category:</span> <strong>{getCategoryLabel(category as FurnitureCategory)}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b' }}>Shape:</span> <strong>{getShapeLabel(shape as FurnitureShape)}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b' }}>Dimensions:</span>{' '}
                <strong>
                  {lengthCm || '0'} × {widthCm || '0'} × {heightCm || '0'} cm
                </strong>
              </div>
              <div>
                <span style={{ color: '#64748b' }}>Placement:</span>{' '}
                <strong>
                  {placementType === 'wall' ? `Wall (${mountHeightCm} cm)` : 'Floor-standing'}
                </strong>
              </div>
            </div>
          </div>

          {arError && <p className="form-error">{arError}</p>}

          <button className="btn btn-primary" onClick={handleAddItem} disabled={!canAddItem} style={{ marginTop: 12 }}>
            ➕ Add Item to Condo Layout
          </button>
        </div>

        <div className="spacer" />

        {/* Navigation to AR Positioning or 2D Workspace */}
        {items.length > 0 && (
          <div style={{ display: 'grid', gap: 10, marginBottom: 'var(--space-sm)' }}>
            <button className="btn btn-primary" onClick={() => navigateTo('positionMap')}>
              📷 Position Furniture in AR ({items.length} item{items.length === 1 ? '' : 's'})
            </button>
            <button className="btn btn-secondary" onClick={() => navigateTo('workspace')}>
              Open 2D Workspace Directly
            </button>
          </div>
        )}
      </div>

      {/* AR Fullscreen Overlay for Measurement Session */}
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
                retakeTrigger={retakeTrigger}
                onMeasured={handleMeasured}
                onPhaseChange={handlePhaseChange}
              />
            )}

            <XRDomOverlay>
              <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', fontFamily }}>
                {/* Top bar — title + exit */}
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
                      background: 'rgba(10,22,44,0.92)',
                      backdropFilter: 'blur(8px)',
                      borderRadius: 12,
                      padding: '12px 14px',
                    }}
                  >
                    <p style={{ margin: 0, color: '#ffffff', fontSize: 14, fontWeight: 700, lineHeight: 1.3 }}>
                      {measurementTitle}
                    </p>
                    <p style={{ margin: '4px 0 0', color: 'rgba(255,255,255,0.7)', fontSize: 12, lineHeight: 1.4 }}>
                      {measurementReview
                        ? 'Review or adjust the measurement before saving.'
                        : measurePhase === 'scanning'
                        ? 'Move your camera slowly over the floor to detect the surface.'
                        : measurePhase === 'ready'
                        ? 'Floor detected. Tap to place the first point.'
                        : measurePhase === 'placed'
                        ? 'First point set. Tap to place the second point.'
                        : measurePhase === 'done'
                        ? 'Measurement complete!'
                        : 'Hit-test unavailable. Ensure ARCore is installed and lighting is good.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={stopMeasurement}
                    style={{
                      background: 'rgba(239,68,68,0.92)',
                      color: 'white',
                      border: 0,
                      borderRadius: 12,
                      minHeight: 44,
                      padding: '0 16px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: 14,
                      backdropFilter: 'blur(8px)',
                    }}
                  >
                    Exit
                  </button>
                </div>

                {/* Phase status pill */}
                {!measurementReview && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 90,
                      left: 0,
                      right: 0,
                      display: 'flex',
                      justifyContent: 'center',
                      pointerEvents: 'none',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        background: 'rgba(10,22,44,0.88)',
                        backdropFilter: 'blur(8px)',
                        borderRadius: 99,
                        padding: '7px 16px',
                      }}
                    >
                      <div
                        style={{
                          width: 9,
                          height: 9,
                          borderRadius: '50%',
                          flexShrink: 0,
                          background:
                            measurePhase === 'scanning'
                              ? '#f59e0b'
                              : measurePhase === 'ready'
                              ? '#22c55e'
                              : measurePhase === 'placed'
                              ? '#3b82f6'
                              : measurePhase === 'done'
                              ? '#22c55e'
                              : '#ef4444',
                        }}
                      />
                      <span style={{ color: '#ffffff', fontSize: 13, fontWeight: 600 }}>
                        {measurePhase === 'scanning' && 'Scanning…'}
                        {measurePhase === 'ready' && 'Floor detected'}
                        {measurePhase === 'placed' && (liveCm > 0 ? `${liveCm} cm` : 'Point 1 placed')}
                        {measurePhase === 'done' && 'Done'}
                        {measurePhase === 'error' && 'Not available'}
                      </span>
                    </div>
                  </div>
                )}

                {/* Measurement Review & Confirmation Dialog */}
                {measurementReview && (
                  <div
                    style={{
                      position: 'absolute',
                      left: 16,
                      right: 16,
                      bottom: 24,
                      background: 'rgba(10, 22, 44, 0.95)',
                      backdropFilter: 'blur(12px)',
                      color: '#ffffff',
                      borderRadius: 16,
                      padding: 18,
                      boxShadow: '0 12px 36px rgba(0,0,0,0.45)',
                      pointerEvents: 'auto',
                      border: '1px solid rgba(255,255,255,0.15)',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: 10,
                      }}
                    >
                      <span style={{ fontSize: 15, fontWeight: 800, color: '#38bdf8' }}>
                        Measurement Complete
                      </span>
                      <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)' }}>
                        AR: {measurementReview.rawCm} cm
                      </span>
                    </div>

                    {measureTarget === 'diameter' && (
                      <p style={{ margin: '0 0 12px', fontSize: 12, color: '#fbbf24', lineHeight: 1.4 }}>
                        Diameter measurement will be used for both length and width.
                      </p>
                    )}

                    <div style={{ marginBottom: 14 }}>
                      <label
                        htmlFor="review-measurement-val"
                        style={{
                          display: 'block',
                          fontSize: 13,
                          fontWeight: 600,
                          marginBottom: 6,
                          color: 'rgba(255,255,255,0.9)',
                        }}
                      >
                        Value to use (cm):
                      </label>
                      <input
                        id="review-measurement-val"
                        inputMode="decimal"
                        value={measurementReview.valueToUse}
                        onChange={(e) => {
                          const val = sanitizeDecimal(e.target.value);
                          setMeasurementReview((prev) => (prev ? { ...prev, valueToUse: val, error: '' } : null));
                        }}
                        style={{
                          width: '100%',
                          minHeight: 44,
                          padding: '0 12px',
                          borderRadius: 10,
                          border: '1px solid rgba(255,255,255,0.25)',
                          background: 'rgba(255,255,255,0.1)',
                          color: '#ffffff',
                          fontSize: 16,
                          fontWeight: 700,
                          boxSizing: 'border-box',
                        }}
                        placeholder="e.g. 97.4"
                      />
                      {measurementReview.error && (
                        <p style={{ margin: '6px 0 0', color: '#ef4444', fontSize: 12 }}>
                          {measurementReview.error}
                        </p>
                      )}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: 10 }}>
                      <button
                        type="button"
                        onClick={handleRetakeMeasurement}
                        style={{
                          minHeight: 46,
                          borderRadius: 12,
                          border: '1px solid rgba(255,255,255,0.25)',
                          background: 'rgba(255,255,255,0.12)',
                          color: '#ffffff',
                          fontWeight: 700,
                          fontSize: 14,
                        }}
                      >
                        Retake
                      </button>
                      <button
                        type="button"
                        onClick={handleConfirmMeasurement}
                        style={{
                          minHeight: 46,
                          borderRadius: 12,
                          border: 'none',
                          background: '#0284c7',
                          color: '#ffffff',
                          fontWeight: 800,
                          fontSize: 14,
                        }}
                      >
                        Confirm Measurement
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </XRDomOverlay>
          </XR>
        </Canvas>
      </div>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const domainTabsScrollStyle: CSSProperties = {
  display: 'flex',
  gap: 8,
  overflowX: 'auto',
  paddingBottom: 8,
  marginBottom: 12,
  scrollbarWidth: 'none',
};

const domainTabStyle: CSSProperties = {
  whiteSpace: 'nowrap',
  padding: '8px 14px',
  borderRadius: 99,
  border: '1px solid var(--border)',
  background: 'var(--card)',
  color: 'var(--text-secondary)',
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
  transition: 'all 0.15s ease',
};

const selectedDomainTabStyle: CSSProperties = {
  ...domainTabStyle,
  background: 'var(--primary)',
  color: '#ffffff',
  borderColor: 'var(--primary)',
  boxShadow: '0 2px 8px rgba(37,99,235,0.25)',
};

const presetGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
  gap: 10,
  maxHeight: 340,
  overflowY: 'auto',
  padding: 4,
};

const presetCardStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  padding: '10px 12px',
  borderRadius: 12,
  border: '1px solid var(--border)',
  background: 'var(--card)',
  textAlign: 'left',
  cursor: 'pointer',
  transition: 'all 0.15s ease',
  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
};

const selectedPresetCardStyle: CSSProperties = {
  ...presetCardStyle,
  borderColor: 'var(--primary)',
  background: 'var(--primary-tint)',
  boxShadow: '0 2px 8px rgba(37,99,235,0.18)',
};

const badgeShapeStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  padding: '2px 6px',
  borderRadius: 6,
  background: 'rgba(0,0,0,0.06)',
  color: 'var(--text-secondary)',
  textTransform: 'capitalize',
};

const badgeDimsStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: 'var(--primary)',
};

const badgeRoomStyle: CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  padding: '1px 5px',
  borderRadius: 4,
  background: '#f1f5f9',
  color: '#475569',
};

const badgeWallStyle: CSSProperties = {
  fontSize: 10,
  fontWeight: 800,
  padding: '1px 5px',
  borderRadius: 4,
  background: '#eff6ff',
  color: '#2563eb',
  border: '1px solid #bfdbfe',
};

const placementTypeGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 10,
};

const placementBtnStyle: CSSProperties = {
  minHeight: 46,
  borderRadius: 12,
  border: '1px solid var(--border)',
  background: 'var(--card)',
  color: 'var(--text-primary)',
  fontSize: 14,
  fontWeight: 700,
  cursor: 'pointer',
};

const selectedPlacementBtnStyle: CSSProperties = {
  ...placementBtnStyle,
  border: '2px solid var(--primary)',
  background: 'var(--primary-tint)',
  color: 'var(--primary)',
};

const wallNoticeBoxStyle: CSSProperties = {
  padding: 12,
  borderRadius: 12,
  background: '#eff6ff',
  border: '1px solid #bfdbfe',
};

const shapeGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
  gap: 8,
};

const shapeChoiceStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  padding: '10px 12px',
  borderRadius: 12,
  border: '1px solid var(--border)',
  background: 'var(--card)',
  textAlign: 'left',
  cursor: 'pointer',
};

const selectedShapeStyle: CSSProperties = {
  ...shapeChoiceStyle,
  border: '2px solid var(--primary)',
  background: 'var(--primary-tint)',
};

const choiceLabelStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
};

const dimNoticeStyle: CSSProperties = {
  margin: '2px 0 10px',
  fontSize: 12,
  lineHeight: 1.4,
  color: 'var(--text-muted)',
  padding: '6px 10px',
  borderRadius: 8,
  background: 'rgba(0,0,0,0.03)',
};

const previewPanelStyle: CSSProperties = {
  border: '1px solid var(--border)',
  borderRadius: 14,
  padding: 12,
  background: 'var(--bg-alt)',
};

const measureRowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr auto',
  gap: 10,
  alignItems: 'stretch',
};

const measureButtonStyle: CSSProperties = {
  width: 'auto',
  minWidth: 116,
  borderRadius: 12,
  fontWeight: 700,
};

const rotationGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, 1fr)',
  gap: 6,
};

const rotationBtnStyle: CSSProperties = {
  padding: '8px 4px',
  borderRadius: 10,
  border: '1px solid var(--border)',
  background: 'var(--card)',
  fontSize: 12,
  fontWeight: 700,
  cursor: 'pointer',
  textAlign: 'center',
};

const selectedRotationBtnStyle: CSSProperties = {
  ...rotationBtnStyle,
  borderColor: 'var(--primary)',
  background: 'var(--primary-tint)',
  color: 'var(--primary)',
};

const reviewCardStyle: CSSProperties = {
  padding: '12px 14px',
  borderRadius: 12,
  background: 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)',
  border: '1px solid #cbd5e1',
  marginTop: 14,
  marginBottom: 10,
};

const addedPanelStyle: CSSProperties = {
  border: '1px solid #dbeafe',
  background: 'linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)',
};

const addedHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 12,
  marginBottom: 12,
};

const countBadgeStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: 32,
  height: 32,
  borderRadius: 999,
  background: 'var(--primary)',
  color: '#ffffff',
  fontWeight: 800,
  fontSize: 13,
};

const addedListStyle: CSSProperties = {
  display: 'grid',
  gap: 10,
};

const addedItemStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr auto',
  alignItems: 'center',
  gap: 10,
  padding: 12,
  borderRadius: 14,
  border: '1px solid var(--border)',
  background: 'var(--card)',
};

const addedItemTitleStyle: CSSProperties = {
  margin: 0,
  color: 'var(--text-primary)',
  fontSize: 14,
  fontWeight: 800,
};

const roomTagStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  padding: '1px 6px',
  borderRadius: 6,
  background: '#e0e7ff',
  color: '#3730a3',
};

const wallBadgeStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  padding: '1px 6px',
  borderRadius: 6,
  background: '#eff6ff',
  color: '#1d4ed8',
  border: '1px solid #bfdbfe',
};

const addedItemMetaStyle: CSSProperties = {
  margin: '3px 0 0',
  color: 'var(--text-muted)',
  fontSize: 12,
  fontWeight: 600,
};

const addedItemDimsStyle: CSSProperties = {
  margin: '2px 0 0',
  color: 'var(--primary)',
  fontSize: 12,
  fontWeight: 800,
};

const removeButtonStyle: CSSProperties = {
  minHeight: 40,
  borderRadius: 10,
  border: '1px solid var(--danger-border)',
  background: 'var(--danger-bg)',
  color: 'var(--danger)',
  padding: '0 12px',
  fontWeight: 800,
  fontSize: 13,
  cursor: 'pointer',
};

const stepperContainerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  marginTop: 4,
};

const stepperBtnStyle: CSSProperties = {
  width: 42,
  height: 42,
  borderRadius: 10,
  border: '1px solid var(--border)',
  background: 'var(--card)',
  color: 'var(--text-primary)',
  fontSize: 20,
  fontWeight: 700,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  userSelect: 'none',
  transition: 'all 0.15s ease',
};

const stepperValueStyle: CSSProperties = {
  fontSize: 18,
  fontWeight: 800,
  minWidth: 32,
  textAlign: 'center',
  color: 'var(--primary)',
};

const stepperHintStyle: CSSProperties = {
  fontSize: 13,
  color: 'var(--text-muted)',
  fontWeight: 550,
};
