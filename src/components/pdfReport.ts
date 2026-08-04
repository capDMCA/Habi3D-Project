import { jsPDF } from 'jspdf';
import { projectItems } from './floorPlanGeometry';
import { findingConsequence } from './findingText';
import { color as t } from './designTokens';
import type { FurnitureItem, GapClassificationLevel, Violation } from '../types';

/**
 * Client-side, one-page PDF of the resident's finished layout — a keepsake
 * record, not a technical export. No server call, no upload, no Supabase;
 * jsPDF renders straight to a browser download.
 *
 * The floor plan drawn into the PDF uses the exact same projectItems()
 * geometry the live FloorPlan2D component renders from (floorPlanGeometry.ts)
 * — never a screenshot/html2canvas capture — so the PDF can never show a
 * different room than the one the resident actually arranged.
 */

export interface PdfReportParams {
  items: FurnitureItem[];
  violations: Violation[];
  roomWidthCm: number;
  roomLengthCm: number;
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

function drawPlan(
  doc: jsPDF,
  items: FurnitureItem[],
  classificationById: Map<string, GapClassificationLevel>,
  roomWidthCm: number,
  roomLengthCm: number,
  originXmm: number,
  originYmm: number,
  maxWmm: number,
  maxHmm: number,
) {
  const rects = projectItems(items);
  const scale = Math.min(maxWmm / roomWidthCm, maxHmm / roomLengthCm);
  const roomWmm = roomWidthCm * scale;
  const roomHmm = roomLengthCm * scale;

  // Room outline
  const [rs1, rs2, rs3] = hexToRgb(t.roomStroke);
  doc.setDrawColor(rs1, rs2, rs3);
  doc.setFillColor(255, 255, 255);
  doc.setLineWidth(0.5);
  doc.roundedRect(originXmm, originYmm, roomWmm, roomHmm, 1.5, 1.5, 'FD');

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
    doc.roundedRect(x, y, w, h, 0.8, 0.8, 'FD');

    if (w > 10 && h > 6) {
      doc.setFontSize(6);
      doc.setTextColor(70, 80, 100);
      doc.text(r.label, x + w / 2, y + h / 2, { align: 'center', baseline: 'middle', maxWidth: w - 2 });
    }
  });

  return originYmm + roomHmm;
}

/**
 * Builds and immediately downloads the report. Synchronous jsPDF work is
 * wrapped in a promise so the caller can show a brief loading state around
 * it without changing how it's invoked.
 */
export async function downloadRoomAssessmentPdf(params: PdfReportParams): Promise<void> {
  const { items, violations, roomWidthCm, roomLengthCm } = params;

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

  doc.setDrawColor(220, 224, 232);
  doc.setLineWidth(0.3);
  doc.line(margin, 34, pageW - margin, 34);

  // ── Plan snapshot ───────────────────────────────────────────────────
  const summaries = summariseItems(items, violations);
  const classificationById = new Map(summaries.map((s) => [s.id, s.classification]));
  const planTop = 40;
  const planMaxH = 78;
  const planBottom = drawPlan(doc, items, classificationById, roomWidthCm, roomLengthCm, margin, planTop, contentW, planMaxH);

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

  // ── Closing line ────────────────────────────────────────────────────
  const closingY = Math.max(y + 4, 275);
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
