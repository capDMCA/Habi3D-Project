import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { useSessionStore } from '../stores/sessionStore';
import { useViolationStore } from '../stores/violationStore';
import { useFurnitureStore } from '../stores/furnitureStore';
import { CONDO_ROOMS, getRoomForCategory } from '../data/condoLayout';
import DownloadReportButton from '../components/DownloadReportButton';
import StatusRow from '../components/StatusRow';
import { statusForClassification } from '../components/statusVocabulary';
import { describeFinding, findingConsequence, findingDetail } from '../components/findingText';
import { color as t, radius } from '../components/tokens';
import { runClearanceAnalysis } from '../engine/clearance';
import { stableViolationKey } from '../engine/violationKey';
import type { RoomDimensions } from '../types';

type RoomStatus = 'RED' | 'YELLOW' | 'GREEN';

/** Same fallback/derivation as AnalysisScreen.tsx's local copy — the PDF
 *  needs the full rule-by-rule breakdown (allClassifications), which
 *  violationStore never stores, so this recomputes it fresh from the
 *  layout's final state rather than threading a new field through the
 *  store and every screen that calls setViolations/refreshViolations. */
function getRoomDimensions(roomDimensions: RoomDimensions | null) {
  if (!roomDimensions) return { roomWidthCm: 360, roomLengthCm: 520 };
  return {
    roomWidthCm: Math.max(roomDimensions.livingWidthCm, roomDimensions.diningWidthCm),
    roomLengthCm: roomDimensions.livingDepthCm + roomDimensions.diningDepthCm,
  };
}

export default function ReportScreen() {
  const navigateTo = useSessionStore((s) => s.navigateTo);
  const roomDimensions = useSessionStore((s) => s.roomDimensions);
  const violations = useViolationStore((s) => s.violations);
  const initialFindingKeys = useViolationStore((s) => s.initialFindingKeys);
  const touchedItemIds = useViolationStore((s) => s.touchedItemIds);
  const items = useFurnitureStore((s) => s.items);
  const [expanded, setExpanded] = useState(false);

  // Recomputed here rather than read from violationStore — see the
  // getRoomDimensions comment above.
  const allClassifications = useMemo(() => {
    const { roomWidthCm, roomLengthCm } = getRoomDimensions(roomDimensions);
    return runClearanceAnalysis(items, roomWidthCm, roomLengthCm).allClassifications;
  }, [items, roomDimensions]);

  const redRemaining = violations.some((v) => v.classification === 'RED');
  const yellowRemaining = violations.some((v) => v.classification === 'YELLOW');

  // ── Session-start vs. now, by stable finding identity ────────────────────
  // initialFindingKeys is captured once, on WorkspaceScreen's first analysis
  // of the session — see violationStore.ts. It's null only if this screen is
  // somehow reached without ever visiting the workspace; treat that the same
  // as "started empty" rather than crashing on a null diff.
  const initialCount = initialFindingKeys?.size ?? 0;
  const resolvedCount = useMemo(() => {
    if (!initialFindingKeys) return 0;
    const currentKeys = new Set(violations.map(stableViolationKey));
    let count = 0;
    initialFindingKeys.forEach((key) => {
      if (!currentKeys.has(key)) count += 1;
    });
    return count;
  }, [initialFindingKeys, violations]);

  // ── Per-room qualitative status — worst classification among that room's furniture ──
  const roomStatuses = useMemo(() => {
    const roomsWithFurniture = new Set<string>();
    const worstByRoom = new Map<string, RoomStatus>();

    items.forEach((item) => {
      const roomId = item.roomId || getRoomForCategory(item.category, item.label);
      roomsWithFurniture.add(roomId);
      if (!worstByRoom.has(roomId)) worstByRoom.set(roomId, 'GREEN');
    });

    violations.forEach((v) => {
      const item = items.find((it) => it.id === v.furnitureId);
      if (!item) return;
      const roomId = item.roomId || getRoomForCategory(item.category, item.label);
      const current = worstByRoom.get(roomId) ?? 'GREEN';
      if (v.classification === 'RED') {
        worstByRoom.set(roomId, 'RED');
      } else if (v.classification === 'YELLOW' && current !== 'RED') {
        worstByRoom.set(roomId, 'YELLOW');
      }
    });

    return CONDO_ROOMS.filter((r) => roomsWithFurniture.has(r.id)).map((r) => ({
      id: r.id,
      label: r.label,
      status: worstByRoom.get(r.id) ?? 'GREEN',
    }));
  }, [items, violations]);

  // ── Plain-language headline, built from what changed this session ────────
  // Deliberately no score, percentage, or grade anywhere here — see Task 1.
  // A resident reads "you made 3 spots more comfortable," not "72%."
  const headline =
    initialCount === 0
      ? 'Everything already fit comfortably'
      : resolvedCount > 0
        ? `You made ${resolvedCount} spot${resolvedCount === 1 ? '' : 's'} more comfortable`
        : 'No tight spots were resolved this session';

  // Fixed, not conditional on outcome — a calm fact rather than a verdict,
  // shown whether the session ends comfortable, tight, or unchanged.
  const acknowledgement =
    'Some tightness is normal in a real room — you can always come back and keep adjusting.';

  return (
    <div className="screen" style={{ maxWidth: 640, padding: '24px 16px', margin: '0 auto' }}>
      <div className="screen-header" style={{ marginBottom: 24 }}>
        <button
          className="back-btn"
          onClick={() => navigateTo('analysis')}
          aria-label="Go back"
          style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', marginRight: 12 }}
        >
          ←
        </button>
        <div className="screen-header-info">
          <span style={stepBadgeStyle}>Report</span>
          <h2 style={{ margin: '4px 0 0', fontSize: 24, fontWeight: 800 }}>Session Results</h2>
        </div>
      </div>

      {/* ── Plain-language summary ────────────────────────────────────────── */}
      <section
        className="card"
        style={{
          ...cardStyle,
          ...fadeInStyle(0),
          borderLeft: `5px solid ${redRemaining ? t.attentionFg : yellowRemaining ? t.tightFg : t.comfortFg}`,
        }}
      >
        <span style={stepBadgeStyle}>Summary</span>
        <h3 style={{ margin: '10px 0 6px', fontSize: 20, fontWeight: 800, color: t.ink }}>{headline}</h3>
        <p style={{ margin: 0, fontSize: 15, color: t.inkSoft, lineHeight: 1.5 }}>{acknowledgement}</p>

        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          aria-expanded={expanded}
          style={expandBtnStyle}
        >
          {expanded ? 'Hide the details' : 'See the details'}
        </button>

        {expanded && (
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {violations.length === 0 ? (
              <StatusRow
                status="comfortable"
                title="Everything fits comfortably"
                detail="Enough space around every piece"
              />
            ) : (
              violations.map((v) => (
                <StatusRow
                  key={v.id}
                  status={statusForClassification(v.classification).key}
                  title={findingConsequence(v)}
                  detail={`${describeFinding(v, items)} — ${findingDetail(v)}`}
                  note={touchedItemIds.has(v.furnitureId) ? 'You decided this works for you' : undefined}
                />
              ))
            )}
          </div>
        )}
      </section>

      {/* ── Room by room ───────────────────────────────────────────────────── */}
      {roomStatuses.length > 0 && (
        <section className="card" style={{ ...cardStyle, ...fadeInStyle(1) }}>
          <span style={stepBadgeStyle}>Room by Room</span>
          <h3 style={{ margin: '8px 0 14px', fontSize: 18, fontWeight: 700, color: t.ink }}>
            How each space turned out
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {roomStatuses.map((r) => (
              <RoomStatusRow key={r.id} label={r.label} status={r.status} />
            ))}
          </div>
        </section>
      )}

      {/* ── Keep a copy ──────────────────────────────────────────────────── */}
      <section className="card" style={{ ...cardStyle, ...fadeInStyle(2) }}>
        <span style={stepBadgeStyle}>Full report</span>
        <h3 style={{ margin: '10px 0 6px', fontSize: 18, fontWeight: 700, color: t.ink }}>
          Get the full report
        </h3>
        <p style={{ margin: '0 0 16px', fontSize: 14, color: t.inkSoft, lineHeight: 1.5 }}>
          A PDF with every room and every finding, laid out in detail — handy to keep or share.
        </p>
        <DownloadReportButton
          items={items}
          violations={violations}
          allClassifications={allClassifications}
          variant="primary"
        />
      </section>

      {/* ── Actions ──────────────────────────────────────────────────────── */}
      <div style={{ ...fadeInStyle(3), display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
        <button
          className="btn btn-primary"
          type="button"
          onClick={() => {
            navigateTo('entry');
          }}
          style={primaryBtnStyle}
        >
          Finish and Exit
        </button>

        <button
          className="btn btn-secondary"
          type="button"
          onClick={() => navigateTo('analysis')}
          style={secondaryBtnStyle}
        >
          Back to Layout Workspace
        </button>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function RoomStatusRow({ label, status }: { label: string; status: RoomStatus }) {
  const wordFor: Record<RoomStatus, string> = {
    RED: 'Needs attention',
    YELLOW: 'A bit tight',
    GREEN: 'Comfortable',
  };
  const colorFor: Record<RoomStatus, string> = {
    RED: t.attentionFg,
    YELLOW: t.tightFg,
    GREEN: t.comfortFg,
  };
  const bgFor: Record<RoomStatus, string> = {
    RED: t.attentionBg,
    YELLOW: t.tightBg,
    GREEN: t.comfortBg,
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 0',
        borderBottom: `1px solid ${t.line}`,
      }}
    >
      <div style={{ width: 10, height: 10, borderRadius: '50%', background: colorFor[status], flexShrink: 0 }} />
      <span style={{ flex: 1, fontSize: 15, fontWeight: 600, color: t.ink }}>{label}</span>
      <span
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: colorFor[status],
          background: bgFor[status],
          padding: '4px 12px',
          borderRadius: 20,
          flexShrink: 0,
        }}
      >
        {wordFor[status]}
      </span>
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

/** Each section arrives a beat after the one before it — the results read
 *  as a sequence of moments rather than all landing on the screen at once. */
function fadeInStyle(order: number): CSSProperties {
  return {
    animation: 'screenFadeIn 0.4s ease backwards',
    animationDelay: `${order * 70}ms`,
  };
}

const cardStyle: CSSProperties = {
  background: t.surface,
  border: `1px solid ${t.line}`,
  borderRadius: radius.lg,
  padding: 20,
  marginBottom: 20,
  boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
};

const primaryBtnStyle: CSSProperties = {
  background: t.brand,
  color: t.surface,
  border: 'none',
  padding: '14px 24px',
  borderRadius: radius.md,
  fontWeight: 700,
  fontSize: 16,
  cursor: 'pointer',
  textAlign: 'center',
  boxShadow: '0 4px 12px rgba(31, 56, 100, 0.15)',
};

const secondaryBtnStyle: CSSProperties = {
  background: t.surface,
  border: `1px solid ${t.line}`,
  color: t.inkSoft,
  padding: '14px 24px',
  borderRadius: radius.md,
  fontWeight: 600,
  fontSize: 16,
  cursor: 'pointer',
  textAlign: 'center',
};

const expandBtnStyle: CSSProperties = {
  marginTop: 14,
  background: 'none',
  border: 'none',
  padding: 0,
  color: t.brand,
  fontSize: 14,
  fontWeight: 700,
  cursor: 'pointer',
};

const stepBadgeStyle: CSSProperties = {
  display: 'inline-block',
  fontSize: 11,
  fontWeight: 700,
  color: t.brand,
  backgroundColor: t.brandTint,
  padding: '4px 12px',
  borderRadius: 20,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
};
