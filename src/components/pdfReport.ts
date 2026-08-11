import { jsPDF } from 'jspdf';
import { projectItems } from './floorPlanGeometry';
import { findingConsequence } from './findingText';
import { color as t } from './designTokens';
import { CONDO_ROOMS, getRoomForCategory } from '../data/condoLayout';
import { UNIT_WIDTH_CM, UNIT_HEIGHT_CM } from './floorPlanDrag';
import { ALL_RULE_GUIDANCE, bandLabel } from '../engine/ruleGuidance';
import type { GapClassification } from '../engine/clearance';
import type { FurnitureItem, GapClassificationLevel, Violation } from '../types';

/**
 * Client-side, one-page PDF of the resident's finished layout — a keepsake
 * record, not a technical export. No server call, no upload, no Supabase;
 * jsPDF renders straight to a browser download.
 *
 * The floor plan drawn into the PDF is the same Mulberry Place room layout
 * (CONDO_ROOMS, the unit envelope from floorPlanDrag.ts) and the same
 * per-item rectangles (projectItems() in floorPlanGeometry.ts) that the live
 * CondoFloorPlan component renders from — never a screenshot/html2canvas
 * capture — so the PDF can never show a different room than the one the
 * resident actually arranged.
 */

export interface PdfReportParams {
  items: FurnitureItem[];
  violations: Violation[];
  /** Every rule check performed — RED/YELLOW/GREEN alike — so the report can
   *  print what was cleared, not only what was violated. From
   *  `runClearanceAnalysis().allClassifications`. */
  allClassifications: GapClassification[];
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function worseOf(a: GapClassificationLevel, b: GapClassificationLevel): GapClassificationLevel {
  const rank: Record<GapClassificationLevel, number> = { RED: 2, YELLOW: 1, GREEN: 0 };
  return rank[a] >= rank[b] ? a : b;
}

interface ItemSummary {
  id: string;
  label: string;
  classification: GapClassificationLevel;
  statusWord: string;
  description: string;
}

function summariseItems(items: FurnitureItem[], violations: Violation[]): ItemSummary[] {
  return items.map((item) => {
    const own = violations.filter((v) => v.furnitureId === item.id || v.itemBId === item.id);
    const worst = own.reduce<GapClassificationLevel | null>(
      (acc, v) => (acc ? worseOf(acc, v.classification) : v.classification),
      null,
    );
    const classification: GapClassificationLevel = worst ?? 'GREEN';
    const statusWord =
      classification === 'RED' ? 'Needs attention' : classification === 'YELLOW' ? 'A little tight' : 'Comfortable';
    const leading = own.find((v) => v.furnitureId === item.id) ?? own[0];
    const description = leading ? findingConsequence(leading) : 'Good clearance on every side.';
    return { id: item.id, label: item.label, classification, statusWord, description };
  });
}

/** Names both sides of a rule check — same phrasing convention as
 *  `describeFinding` in findingText.ts, but built from a raw
 *  `GapClassification` (itemAId/itemBId/wallSide) rather than a `Violation`,
 *  since this runs over every check performed, not only the failed ones. */
function describeInstance(gc: GapClassification, items: FurnitureItem[]): string {
  const a = items.find((it) => it.id === gc.itemAId);
  const aLabel = a?.label ?? 'this piece';
  const roomZoneId = a?.roomId || (a ? getRoomForCategory(a.category, a.label) : 'living');
  const roomLabel = CONDO_ROOMS.find((r) => r.id === roomZoneId)?.label ?? 'the room';

  if (gc.itemBId === 'wall') {
    return gc.wallSide
      ? `Between your ${aLabel} and the ${gc.wallSide} wall in the ${roomLabel}`
      : `Around your ${aLabel} in the ${roomLabel}`;
  }
  const b = items.find((it) => it.id === gc.itemBId);
  return `Between your ${aLabel} and ${b?.label ?? 'another piece'} in the ${roomLabel}`;
}

const STATUS_FILL: Record<GapClassificationLevel, string> = {
  RED: t.attentionBg,
  YELLOW: t.tightBg,
  GREEN: t.comfortBg,
};
const STATUS_STROKE: Record<GapClassificationLevel, string> = {
  RED: t.attentionFg,
  YELLOW: t.tightFg,
  GREEN: t.comfortFg,
};

/** Draws the Mulberry Place room layout plus every furniture piece at its
 *  final position, scaled to fit the box given. Returns the bottom Y used. */
function drawPlan(
  doc: jsPDF,
  items: FurnitureItem[],
  classificationById: Map<string, GapClassificationLevel>,
  originXmm: number,
  originYmm: number,
  maxWmm: number,
  maxHmm: number,
) {
  const scale = Math.min(maxWmm / UNIT_WIDTH_CM, maxHmm / UNIT_HEIGHT_CM);
  const unitWmm = UNIT_WIDTH_CM * scale;
  const unitHmm = UNIT_HEIGHT_CM * scale;

  // Outer unit boundary
  const [rs1, rs2, rs3] = hexToRgb(t.roomStroke);
  doc.setDrawColor(rs1, rs2, rs3);
  doc.setLineWidth(0.6);
  doc.roundedRect(originXmm, originYmm, unitWmm, unitHmm, 1.5, 1.5);

  // Room zones — same light tint + label the live plan uses, just rendered
  // for print: a muted ink label instead of white-on-saturated (the fill
  // opacity here is too light for the live app's white room labels to read).
  CONDO_ROOMS.forEach((room) => {
    const x = originXmm + room.x * scale;
    const y = originYmm + room.y * scale;
    const w = room.width * scale;
    const h = room.height * scale;

    const [br, bg, bb] = hexToRgb(room.bgColor);
    doc.setFillColor(br, bg, bb);
    doc.setGState(doc.GState({ opacity: 0.08 }));
    doc.setDrawColor(rs1, rs2, rs3);
    doc.setLineWidth(0.25);
    doc.rect(x, y, w, h, 'FD');
    doc.setGState(doc.GState({ opacity: 1 }));

    if (w > 14 && h > 8) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(110, 118, 134);
      doc.text(room.label, x + w / 2, y + h / 2, { align: 'center', baseline: 'middle', maxWidth: w - 2 });
    }
  });

  // Furniture — coloured by final clearance status, same palette as the
  // live plan and the rest of this report.
  const rects = projectItems(items);
  rects.forEach((r) => {
    const x = originXmm + r.xCm * scale;
    const y = originYmm + r.yCm * scale;
    const w = Math.max(r.wCm * scale, 1);
    const h = Math.max(r.hCm * scale, 1);
    const classification = classificationById.get(r.id) ?? 'GREEN';

    const [fr, fg, fb] = hexToRgb(STATUS_FILL[classification]);
    const [sr, sg, sb] = hexToRgb(STATUS_STROKE[classification]);
    doc.setFillColor(fr, fg, fb);
    doc.setDrawColor(sr, sg, sb);
    doc.setLineWidth(0.35);

    if (r.shape === 'round') {
      // Same geometry source as the rect case (projectItems()) — w and h
      // are equal for a round item's square bounding box, so w/2 is exact.
      doc.circle(x + w / 2, y + h / 2, w / 2, 'FD');
    } else {
      doc.roundedRect(x, y, w, h, 0.8, 0.8, 'FD');
    }

    if (w > 10 && h > 6) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.setTextColor(60, 68, 88);
      doc.text(r.label, x + w / 2, y + h / 2, { align: 'center', baseline: 'middle', maxWidth: w - 2 });
    }
  });

  return originYmm + unitHmm;
}

const BOTTOM_MARGIN_MM = 20;

/** Starts a new A4 page with a small continuation header, returns the y to
 *  resume drawing at. */
function addContinuationPage(doc: jsPDF, margin: number, pageW: number): number {
  doc.addPage();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(150, 156, 170);
  doc.text('Habi3D — Room Assessment (continued)', margin, 14);
  doc.setDrawColor(220, 224, 232);
  doc.setLineWidth(0.3);
  doc.line(margin, 18, pageW - margin, 18);
  return 27;
}

/** If drawing `neededMm` more of content from `y` would run past the bottom
 *  margin, starts a fresh page first. Every block in the rule-detail section
 *  is guarded by this — the old one-page report had no such check and could
 *  silently overflow the page. */
function ensureSpace(doc: jsPDF, y: number, neededMm: number, margin: number, pageW: number): number {
  const pageH = doc.internal.pageSize.getHeight();
  if (y + neededMm > pageH - BOTTOM_MARGIN_MM) {
    return addContinuationPage(doc, margin, pageW);
  }
  return y;
}

/**
 * The comprehensive section: every one of the 10 rules that actually applied
 * to this layout, each with its plain-language requirement, its numeric
 * bands, and every individual check performed against it — cleared checks
 * included, not only violations. Grouped by rule (not by room) because the
 * ask is "which standards were met," which the room-by-room summary on the
 * first page doesn't answer.
 */
function drawRuleDetail(
  doc: jsPDF,
  allClassifications: GapClassification[],
  items: FurnitureItem[],
  margin: number,
  pageW: number,
  contentW: number,
  startY: number,
): number {
  let y = startY;
  const [brandR, brandG, brandB] = hexToRgb(t.brand);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(brandR, brandG, brandB);
  doc.text('Rule-by-rule detail', margin, y);
  y += 5.5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(130, 138, 154);
  doc.text(
    'Every clearance rule from Time-Saver Standards for Interior Design (DeChiara, Panero & '
      + 'Zelnik, 2001, pp. 61–90) that applied to this layout, cleared and violated alike.',
    margin,
    y,
    { maxWidth: contentW },
  );
  y += 9;

  if (allClassifications.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(140, 146, 160);
    doc.text('No rules applied — add furniture to your layout to see a full breakdown.', margin, y);
    return y + 6;
  }

  const byRule = new Map<string, GapClassification[]>();
  allClassifications.forEach((gc) => {
    const list = byRule.get(gc.ruleCode) ?? [];
    list.push(gc);
    byRule.set(gc.ruleCode, list);
  });

  const rank: Record<GapClassificationLevel, number> = { RED: 2, YELLOW: 1, GREEN: 0 };

  ALL_RULE_GUIDANCE.forEach((guidance) => {
    const instances = byRule.get(guidance.code);
    if (!instances || instances.length === 0) return; // rule wasn't applicable to this layout

    const sorted = [...instances].sort((a, b) => rank[b.classification] - rank[a.classification]);
    const worst = sorted[0].classification;

    y = ensureSpace(doc, y, 22, margin, pageW);

    const [wr, wg, wb] = hexToRgb(STATUS_STROKE[worst]);
    doc.setFillColor(wr, wg, wb);
    doc.circle(margin + 1.1, y - 1.3, 1.1, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(30, 35, 50);
    doc.text(`${guidance.code} · ${guidance.title}`, margin + 4.5, y);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(140, 146, 160);
    doc.text(guidance.area, pageW - margin, y, { align: 'right' });
    y += 4.6;

    doc.setFontSize(9);
    doc.setTextColor(90, 100, 120);
    doc.text(guidance.requirement, margin + 4.5, y, { maxWidth: contentW - 4.5 });
    y += 4.2;

    doc.setFontSize(7.5);
    doc.setTextColor(155, 161, 174);
    doc.text(
      `Too tight below ${guidance.violationThresholdCm} cm  ·  Tight ${guidance.violationThresholdCm}–${guidance.warningThresholdCm - 1} cm  ·  Comfortable ${guidance.warningThresholdCm} cm+`,
      margin + 4.5,
      y,
    );
    y += 6;

    sorted.forEach((gc) => {
      y = ensureSpace(doc, y, 9.5, margin, pageW);

      const requiredCm = gc.classification === 'RED' ? guidance.violationThresholdCm : guidance.warningThresholdCm;
      const shortfallCm = gc.classification === 'GREEN' ? 0 : Math.max(0, requiredCm - gc.measuredCm);

      const [sr, sg, sb] = hexToRgb(STATUS_STROKE[gc.classification]);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(sr, sg, sb);
      doc.text(bandLabel(gc.classification), margin + 4.5, y);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(60, 68, 88);
      doc.text(describeInstance(gc, items), margin + 26, y, { maxWidth: contentW - 26 });
      y += 4;

      doc.setFontSize(8);
      doc.setTextColor(120, 128, 144);
      const measureLine =
        gc.classification === 'GREEN'
          ? `${gc.measuredCm} cm measured`
          : `${gc.measuredCm} cm measured — needs ${shortfallCm} cm more to reach ${requiredCm} cm`;
      doc.text(measureLine, margin + 26, y, { maxWidth: contentW - 26 });
      y += 5.5;
    });

    y += 3.5;
  });

  return y;
}

/**
 * Builds and immediately downloads the report. Synchronous jsPDF work is
 * wrapped in a promise so the caller can show a brief loading state around
 * it without changing how it's invoked.
 */
export async function downloadRoomAssessmentPdf(params: PdfReportParams): Promise<void> {
  const { items, violations, allClassifications } = params;

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 16;
  const contentW = pageW - margin * 2;

  const dateStr = new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });

  // ── Header ──────────────────────────────────────────────────────────
  const [brandR, brandG, brandB] = hexToRgb(t.brand);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(brandR, brandG, brandB);
  doc.text('Your room assessment', margin, 22);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(90, 100, 120);
  doc.text('Mulberry Place', margin, 29);
  doc.setFontSize(9);
  doc.text(dateStr, pageW - margin, 29, { align: 'right' });

  // ── Rule-check stat line ────────────────────────────────────────────
  // Counts every check performed (allClassifications), not just violations
  // — so a fully comfortable layout still shows how many rules it cleared,
  // rather than only ever reporting problems.
  const redChecks = allClassifications.filter((c) => c.classification === 'RED').length;
  const yellowChecks = allClassifications.filter((c) => c.classification === 'YELLOW').length;
  const greenChecks = allClassifications.length - redChecks - yellowChecks;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 108, 124);
  doc.text(
    `${allClassifications.length} rule checks across your layout — ${greenChecks} comfortable, `
      + `${yellowChecks} tight, ${redChecks} needing attention. Full breakdown on the pages that follow.`,
    margin,
    36,
    { maxWidth: contentW },
  );

  doc.setDrawColor(220, 224, 232);
  doc.setLineWidth(0.3);
  doc.line(margin, 40, pageW - margin, 40);

  // ── Plan snapshot ───────────────────────────────────────────────────
  const summaries = summariseItems(items, violations);
  const classificationById = new Map(summaries.map((s) => [s.id, s.classification]));
  const planTop = 46;
  const planMaxH = 94;
  const planBottom = drawPlan(doc, items, classificationById, margin, planTop, contentW, planMaxH);

  // ── Per-item summary ────────────────────────────────────────────────
  let y = planBottom + 10;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(brandR, brandG, brandB);
  doc.text('Furniture in this session', margin, y);
  y += 6;

  doc.setFont('helvetica', 'normal');
  summaries.forEach((s) => {
    const [sr, sg, sb] = hexToRgb(STATUS_STROKE[s.classification]);

    doc.setFontSize(10.5);
    doc.setTextColor(30, 35, 50);
    doc.setFont('helvetica', 'bold');
    doc.text(s.label, margin, y);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(sr, sg, sb);
    doc.text(s.statusWord, pageW - margin, y, { align: 'right' });

    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(100, 108, 124);
    doc.text(s.description, margin, y, { maxWidth: contentW });
    y += 8;
  });

  // ── Rule-by-rule detail ─────────────────────────────────────────────
  // Always its own page — page 1 stays the quick visual keepsake, the
  // comprehensive per-rule breakdown (violated AND cleared) starts fresh
  // rather than competing for space with the plan and item list above.
  y = addContinuationPage(doc, margin, pageW);
  y = drawRuleDetail(doc, allClassifications, items, margin, pageW, contentW, y);

  // ── Closing line ────────────────────────────────────────────────────
  const closingY = ensureSpace(doc, y + 4, 10, margin, pageW);
  doc.setDrawColor(220, 224, 232);
  doc.line(margin, closingY - 6, pageW - margin, closingY - 6);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8.5);
  doc.setTextColor(140, 146, 160);
  doc.text(
    'This assessment is a guide to help you think about your space. Measurements are approximate.',
    margin,
    closingY,
    { maxWidth: contentW },
  );

  const filenameDate = new Date().toISOString().slice(0, 10);
  doc.save(`Habi3D-room-assessment-${filenameDate}.pdf`);
}
