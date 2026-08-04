import { useMemo } from 'react';
import type { CSSProperties } from 'react';
import { useSessionStore } from '../stores/sessionStore';
import { useViolationStore } from '../stores/violationStore';
import { useFurnitureStore } from '../stores/furnitureStore';
import { CONDO_ROOMS, getRoomForCategory } from '../data/condoLayout';
import DownloadReportButton from '../components/DownloadReportButton';
import { color as t, radius } from '../components/designTokens';

type RoomStatus = 'RED' | 'YELLOW' | 'GREEN';

export default function ReportScreen() {
  const navigateTo = useSessionStore((s) => s.navigateTo);
  const recommendations = useViolationStore((s) => s.recommendations);
  const violations = useViolationStore((s) => s.violations);
  const items = useFurnitureStore((s) => s.items);

  const totalIssues = recommendations.length;
  const redRemaining = violations.some((v) => v.classification === 'RED');
  const yellowRemaining = violations.some((v) => v.classification === 'YELLOW');

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

  // ── Plain-language headline ──────────────────────────────────────────────
  const headline =
    totalIssues === 0
      ? 'Everything already fit comfortably'
      : redRemaining
        ? 'A few spots still need more room'
        : yellowRemaining
          ? 'Your layout is mostly comfortable'
          : 'Every piece now has comfortable clearance';

  const subtext =
    totalIssues === 0
      ? 'No changes were needed — your starting layout already had good clearance throughout.'
      : redRemaining
        ? 'Some furniture is still crowding a wall, a walkway, or another piece. You can go back and keep adjusting, or finish here.'
        : yellowRemaining
          ? 'A couple of spots are a little tight, but nothing urgent. You can leave them as is or fine-tune further.'
          : 'Nice work — every piece you adjusted this session now has comfortable clearance.';

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
        <p style={{ margin: 0, fontSize: 15, color: t.inkSoft, lineHeight: 1.5 }}>{subtext}</p>
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
        <span style={stepBadgeStyle}>Keep a copy</span>
        <h3 style={{ margin: '10px 0 6px', fontSize: 18, fontWeight: 700, color: t.ink }}>
          Save this to your phone
        </h3>
        <p style={{ margin: '0 0 16px', fontSize: 14, color: t.inkSoft, lineHeight: 1.5 }}>
          A one-page PDF of your room and how each piece turned out — handy to keep or share.
        </p>
        <DownloadReportButton items={items} violations={violations} variant="primary" />
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
        borderBottom: '1px solid #E2E8F0',
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
  background: '#FFFFFF',
  border: '1px solid #E2E8F0',
  borderRadius: radius.lg,
  padding: 20,
  marginBottom: 20,
  boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
};

const primaryBtnStyle: CSSProperties = {
  background: t.brand,
  color: '#FFFFFF',
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
  background: '#FFFFFF',
  border: '1px solid #CBD5E1',
  color: '#4B5563',
  padding: '14px 24px',
  borderRadius: radius.md,
  fontWeight: 600,
  fontSize: 16,
  cursor: 'pointer',
  textAlign: 'center',
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
