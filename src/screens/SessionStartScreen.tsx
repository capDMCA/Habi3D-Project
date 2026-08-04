import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { useSessionStore } from '../stores/sessionStore';
import { MULBERRY_PLACE_2BR } from '../data/roomData';
import { color as t, type as typeScale, space, radius, planMark } from '../components/designTokens';

/**
 * The first thing a resident sees — replaces the old username/password
 * login. There is no account: a session is just an anonymous id generated
 * the moment someone taps in, plus which Mulberry Place unit they live in
 * (needed to size the room correctly, nothing else).
 *
 * The hero is not a logo — it's a miniature of the plan itself: a room
 * outline with furniture, one block picked up mid-move in the same visual
 * language (planMark tokens) the real interactive plan uses later. It's a
 * preview of the mechanic, not decoration.
 */

interface UnitOption {
  id: string;
  group: 'Mid Unit' | 'Inner Unit' | 'Lettered Inner Unit';
  label: string;
  grossAreaSqm: number;
}

// Every 2-bedroom unit type Mulberry Place has, carried over from the
// former unit-setup step. Actual room dimensions all resolve to the one
// measured reference floor plan (MULBERRY_PLACE_2BR) — see the design
// report for why per-type dimensions aren't available yet.
const UNIT_OPTIONS: UnitOption[] = [
  { id: 'mid-65', group: 'Mid Unit', label: '2 Bedroom Mid Unit', grossAreaSqm: 65 },
  { id: 'mid-60', group: 'Mid Unit', label: '2 Bedroom Mid Unit', grossAreaSqm: 60 },
  { id: 'mid-57-5', group: 'Mid Unit', label: '2 Bedroom Mid Unit', grossAreaSqm: 57.5 },
  { id: 'inner-65', group: 'Inner Unit', label: '2 Bedroom Inner Unit', grossAreaSqm: 65 },
  { id: 'inner-60', group: 'Inner Unit', label: '2 Bedroom Inner Unit', grossAreaSqm: 60 },
  { id: 'inner-57-5', group: 'Inner Unit', label: '2 Bedroom Inner Unit', grossAreaSqm: 57.5 },
  { id: 'a-inner-64-5', group: 'Lettered Inner Unit', label: '2 Bedroom A Inner Unit', grossAreaSqm: 64.5 },
  { id: 'b-inner-67', group: 'Lettered Inner Unit', label: '2 Bedroom B Inner Unit', grossAreaSqm: 67 },
  { id: 'd-inner-69', group: 'Lettered Inner Unit', label: '2 Bedroom D Inner Unit', grossAreaSqm: 69 },
  { id: 'e-inner-67', group: 'Lettered Inner Unit', label: '2 Bedroom E Inner Unit', grossAreaSqm: 67 },
  { id: 'f-inner-69', group: 'Lettered Inner Unit', label: '2 Bedroom F Inner Unit', grossAreaSqm: 69 },
  { id: 'g-inner-69', group: 'Lettered Inner Unit', label: '2 Bedroom G Inner Unit', grossAreaSqm: 69 },
  { id: 'h-inner-67', group: 'Lettered Inner Unit', label: '2 Bedroom H Inner Unit', grossAreaSqm: 67 },
  { id: 'i-inner-67', group: 'Lettered Inner Unit', label: '2 Bedroom I Inner Unit', grossAreaSqm: 67 },
  { id: 'j-inner-73', group: 'Lettered Inner Unit', label: '2 Bedroom J Inner Unit', grossAreaSqm: 73 },
];

const UNIT_GROUPS: UnitOption['group'][] = ['Mid Unit', 'Inner Unit', 'Lettered Inner Unit'];

function formatSqm(value: number): string {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}

function createSessionId(): string {
  if ('randomUUID' in crypto) return crypto.randomUUID();
  return `session-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/** A small top-down sketch, drawn with the same marks the real plan uses
 *  later: a room outline, two settled pieces, and one mid-drag with its
 *  ghost target. This is what the app does, shown before anything else. */
function PlanPreviewHero() {
  return (
    <svg
      viewBox="0 0 220 150"
      width="100%"
      height="auto"
      style={{ maxWidth: 280, display: 'block', margin: '0 auto' }}
      role="img"
      aria-label="A small sketch of a room with furniture, one piece being moved into place"
    >
      <rect
        x={10} y={10} width={200} height={130} rx={10}
        fill={planMark.room.fill} stroke={planMark.room.stroke} strokeWidth={planMark.room.strokeWidth}
      />
      {/* settled pieces */}
      <rect x={26} y={26} width={56} height={34} rx={6} fill={planMark.item.fill} stroke={planMark.item.stroke} strokeWidth={planMark.item.strokeWidth} />
      <rect x={26} y={92} width={40} height={34} rx={6} fill={planMark.item.fill} stroke={planMark.item.stroke} strokeWidth={planMark.item.strokeWidth} />
      {/* ghost target the moving piece is headed for */}
      <rect x={140} y={80} width={54} height={38} rx={6} fill={planMark.ghost.fill} stroke={planMark.ghost.stroke} strokeWidth={planMark.ghost.strokeWidth} strokeDasharray={planMark.ghost.dash} />
      {/* the piece being moved, mid-air over the room */}
      <rect x={116} y={26} width={54} height={38} rx={6} fill={planMark.draggable.fill} stroke={planMark.draggable.stroke} strokeWidth={planMark.draggable.strokeWidth} />
    </svg>
  );
}

export default function SessionStartScreen() {
  const navigateTo = useSessionStore((s) => s.navigateTo);
  const setSessionId = useSessionStore((s) => s.setSessionId);
  const setUnitTypeId = useSessionStore((s) => s.setUnitTypeId);
  const setRoomDimensions = useSessionStore((s) => s.setRoomDimensions);

  const [selectedUnitId, setSelectedUnitId] = useState<string>('');

  const selectedUnit = useMemo(
    () => UNIT_OPTIONS.find((u) => u.id === selectedUnitId) ?? null,
    [selectedUnitId],
  );

  function handleStart() {
    if (!selectedUnit) return;
    setSessionId(createSessionId());
    setUnitTypeId(selectedUnit.id);
    // Read silently — the one reference floor plan Mulberry Place has
    // measured dimensions for. No confirmation step, nothing to edit here.
    setRoomDimensions(MULBERRY_PLACE_2BR.defaultDimensions);
    navigateTo('furnitureInput');
  }

  return (
    <div style={rootStyle}>
      <div style={heroStyle}>
        <PlanPreviewHero />
        <h1 style={{ ...typeScale.display, fontSize: 26, margin: `${space.lg}px 0 4px`, color: t.ink, textAlign: 'center' }}>
          Habi3D
        </h1>
        <p style={{ ...typeScale.body, margin: 0, color: t.inkSoft, textAlign: 'center' }}>
          Built for Mulberry Place residents to try out furniture
          arrangements before moving anything for real.
        </p>
      </div>

      <div style={sheetStyle}>
        <p style={{ ...typeScale.label, margin: `0 0 ${space.sm}px`, color: t.inkMute }}>
          Your unit
        </p>
        <p style={{ ...typeScale.title, margin: `0 0 ${space.md}px`, color: t.ink }}>
          Which unit do you live in?
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: space.sm }}>
          {UNIT_GROUPS.map((group) => (
            <div key={group}>
              <p style={{ ...typeScale.label, margin: `${space.sm}px 0 ${space.xs}px`, color: t.inkMute }}>
                {group}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: space.xs }}>
                {UNIT_OPTIONS.filter((u) => u.group === group).map((u) => {
                  const selected = u.id === selectedUnitId;
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => setSelectedUnitId(u.id)}
                      style={selected ? optionSelectedStyle : optionStyle}
                      aria-pressed={selected}
                    >
                      <span style={{ ...typeScale.body, fontWeight: 700, color: selected ? t.brand : t.ink }}>
                        {u.label}
                      </span>
                      <span style={{ ...typeScale.body, color: t.inkSoft, fontSize: 13 }}>
                        {formatSqm(u.grossAreaSqm)} sqm
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={handleStart}
          disabled={!selectedUnit}
          style={selectedUnit ? primaryBtnStyle : primaryBtnDisabledStyle}
        >
          Start my session
        </button>

        <p style={{ ...typeScale.body, fontSize: 12, color: t.inkMute, textAlign: 'center', margin: `${space.sm}px 0 0` }}>
          No account, no sign-up — this stays on your phone.
        </p>
      </div>
    </div>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────

const rootStyle: CSSProperties = {
  minHeight: '100dvh',
  display: 'flex',
  flexDirection: 'column',
  background: t.ground,
  fontFamily: "'Inter', system-ui, sans-serif",
};

const heroStyle: CSSProperties = {
  flexShrink: 0,
  padding: `${space.xl + 8}px ${space.lg}px ${space.lg}px`,
  background: t.surface,
};

const sheetStyle: CSSProperties = {
  flex: 1,
  padding: `${space.lg}px ${space.lg}px calc(${space.xl}px + env(safe-area-inset-bottom, 0px))`,
  background: t.ground,
};

const optionStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: space.md,
  width: '100%',
  minHeight: 48,
  padding: '12px 14px',
  borderRadius: radius.md,
  border: `1px solid ${t.line}`,
  background: t.surface,
  textAlign: 'left',
  cursor: 'pointer',
};

const optionSelectedStyle: CSSProperties = {
  ...optionStyle,
  border: `2px solid ${t.brand}`,
  background: t.brandTint,
};

const primaryBtnStyle: CSSProperties = {
  width: '100%',
  minHeight: 52,
  marginTop: space.xl,
  borderRadius: radius.md,
  border: 'none',
  background: t.brand,
  color: t.surface,
  fontSize: 16,
  fontWeight: 700,
  cursor: 'pointer',
  boxShadow: '0 4px 12px rgba(31, 56, 100, 0.2)',
};

const primaryBtnDisabledStyle: CSSProperties = {
  ...primaryBtnStyle,
  background: t.line,
  color: t.inkMute,
  cursor: 'not-allowed',
  boxShadow: 'none',
};
