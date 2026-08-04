import type { CSSProperties } from 'react';
import { color as t } from './designTokens';
import { bandRanges, meterMaxCm, type Band, type RuleGuidance } from '../engine/ruleGuidance';

/**
 * A measured clearance shown against the rule's own three bands.
 *
 * Red / amber / green cannot be told apart by a red-green colourblind reader —
 * measured at ΔE 2.8 between the amber and the red under deuteranopia, and no
 * substitute hue fixes it, because the traffic-light metaphor is the problem.
 * So colour is never the only channel here:
 *
 *   · position   — where the marker sits on the track (fully colour-independent)
 *   · shape      — triangle / diamond / circle per band
 *   · words      — every band is captioned, and the marker states its value
 *   · gaps       — a 2px surface gap separates bands, so the boundaries are
 *                  structural rather than a colour edge
 */

export interface ClearanceMeterProps {
  guidance: RuleGuidance;
  measuredCm: number;
  /** Compact mode drops the band captions — for dense lists. */
  compact?: boolean;
}

const BAND_COLOR: Record<Band, string> = {
  RED: t.attentionFg,
  YELLOW: t.tightFg,
  GREEN: t.comfortFg,
};

const BAND_TINT: Record<Band, string> = {
  RED: t.attentionBg,
  YELLOW: t.tightBg,
  GREEN: t.comfortBg,
};

/** Distinct silhouettes so the band survives greyscale and full CVD. */
export function BandGlyph({ band, size = 10 }: { band: Band; size?: number }) {
  const c = BAND_COLOR[band];
  const half = size / 2;

  if (band === 'RED') {
    // Triangle — the "warning" silhouette, unmistakable at small sizes.
    return (
      <svg width={size} height={size} viewBox="0 0 10 10" aria-hidden="true" style={glyphStyle}>
        <path d="M5 0.5 L9.5 9 L0.5 9 Z" fill={c} />
      </svg>
    );
  }
  if (band === 'YELLOW') {
    return (
      <svg width={size} height={size} viewBox="0 0 10 10" aria-hidden="true" style={glyphStyle}>
        <path d="M5 0.5 L9.5 5 L5 9.5 L0.5 5 Z" fill={c} />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 10 10" aria-hidden="true" style={glyphStyle}>
      <circle cx="5" cy="5" r={half - 0.5} fill={c} />
    </svg>
  );
}

export default function ClearanceMeter({ guidance, measuredCm, compact = false }: ClearanceMeterProps) {
  const maxCm = meterMaxCm(guidance);
  const ranges = bandRanges(guidance);

  const pct = (cm: number) => Math.max(0, Math.min(100, (cm / maxCm) * 100));
  const markerPct = pct(measuredCm);

  const activeBand: Band =
    measuredCm < guidance.violationThresholdCm
      ? 'RED'
      : measuredCm < guidance.warningThresholdCm
        ? 'YELLOW'
        : 'GREEN';

  return (
    <div style={{ marginTop: 10 }}>
      {/* Track — three bands, each sized to its own cm range */}
      <div style={trackStyle} role="img" aria-label={`${measuredCm} centimetres measured against this rule`}>
        {ranges.map((r) => {
          const from = pct(r.fromCm);
          const to = r.toCm === null ? 100 : pct(r.toCm);
          const width = Math.max(0, to - from);
          if (width <= 0) return null;
          return (
            <div
              key={r.band}
              style={{
                position: 'absolute',
                left: `${from}%`,
                width: `${width}%`,
                top: 0,
                bottom: 0,
                background: BAND_TINT[r.band],
                borderTop: `2px solid ${BAND_COLOR[r.band]}`,
                // 2px surface gap between bands, never a border between them
                boxShadow: `inset -2px 0 0 0 ${t.surface}`,
              }}
            />
          );
        })}

        {/* Measured marker — position carries the reading, colour only reinforces */}
        <div
          style={{
            position: 'absolute',
            left: `${markerPct}%`,
            top: -3,
            bottom: -3,
            width: 3,
            marginLeft: -1.5,
            background: t.ink,
            borderRadius: 2,
            transition: 'left 0.35s cubic-bezier(0.4,0,0.2,1)',
          }}
        />
      </div>

      {/* Reading + the threshold it is judged against */}
      <div style={readoutRow}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <BandGlyph band={activeBand} />
          <strong style={{ color: t.ink, fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
            {measuredCm} cm
          </strong>
          <span style={{ color: t.inkSoft, fontSize: 12 }}>now</span>
        </span>
        <span style={{ color: t.inkSoft, fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
          needs {guidance.warningThresholdCm} cm
        </span>
      </div>

      {/* Band captions — the colour-independent key */}
      {!compact && (
        <div style={captionRow}>
          {ranges.map((r) => (
            <span key={r.band} style={captionItem}>
              <BandGlyph band={r.band} size={8} />
              <span style={{ color: t.inkSoft }}>
                {r.label}
                <span style={{ color: t.inkMute, fontVariantNumeric: 'tabular-nums' }}>
                  {r.toCm === null ? ` ${r.fromCm}+` : ` ${r.fromCm}–${r.toCm}`}
                </span>
              </span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

const trackStyle: CSSProperties = {
  position: 'relative',
  height: 12,
  borderRadius: 4,
  overflow: 'visible',
  background: t.ground,
};

const readoutRow: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginTop: 10,
  gap: 8,
  flexWrap: 'wrap',
};

const captionRow: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '4px 12px',
  marginTop: 8,
  fontSize: 11,
  fontWeight: 600,
};

const captionItem: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  whiteSpace: 'nowrap',
};

const glyphStyle: CSSProperties = {
  flexShrink: 0,
  display: 'block',
};
