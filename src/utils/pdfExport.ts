import jsPDF from 'jspdf';
import type { Violation } from '../types';

export interface ReportData {
  participantCode: string;
  building: string;
  unitType: string;
  sessionDate: string;
  spaceScoreBefore: number;
  spaceScoreAfter: number;
  violations: Violation[];
  stepsCompleted: number;
  totalViolations: number;
  floorPlanDataUrl: string;
  floorPlanAfterDataUrl: string;
}

// ─── RGB colour tuples ────────────────────────────────────────────────────────
type RGB = [number, number, number];
const NAVY:  RGB = [31,  56,  100];
const RED:   RGB = [226, 75,  74 ];
const AMBER: RGB = [240, 165, 0  ];
const GREEN: RGB = [76,  175, 80 ];
const GRAY:  RGB = [100, 116, 139];
const LGRAY: RGB = [229, 231, 235];
const DARK:  RGB = [17,  24,  39 ];
const WHITE: RGB = [255, 255, 255];
const RBKG:  RGB = [254, 242, 242]; // light red background
const GBKG:  RGB = [240, 253, 244]; // light green background
const HBKG:  RGB = [248, 250, 252]; // table header background

function tc(doc: jsPDF, rgb: RGB)  { doc.setTextColor(rgb[0], rgb[1], rgb[2]); }
function fc(doc: jsPDF, rgb: RGB)  { doc.setFillColor(rgb[0], rgb[1], rgb[2]); }
function dc(doc: jsPDF, rgb: RGB)  { doc.setDrawColor(rgb[0], rgb[1], rgb[2]); }
function severityRgb(c: Violation['classification']): RGB {
  return c === 'RED' ? RED : c === 'YELLOW' ? AMBER : GREEN;
}

// ─── Reusable drawing helpers ─────────────────────────────────────────────────
function pageHeader(doc: jsPDF, pw: number, pageNum: number) {
  fc(doc, NAVY);
  doc.rect(0, 0, pw, 13, 'F');
  tc(doc, WHITE);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('HABI3D  ·  Furniture Clearance Report', 18, 9);
  doc.text(`Page ${pageNum}`, pw - 18, 9, { align: 'right' });
}

function drawBar(
  doc: jsPDF,
  x: number, y: number, width: number,
  value: number, fillRgb: RGB,
) {
  fc(doc, LGRAY);
  doc.roundedRect(x, y, width, 5, 1.5, 1.5, 'F');
  const filled = Math.max(0, Math.min(width, (value / 100) * width));
  if (filled > 0.5) {
    fc(doc, fillRgb);
    doc.roundedRect(x, y, filled, 5, 1.5, 1.5, 'F');
  }
}

function dot(doc: jsPDF, x: number, y: number, rgb: RGB) {
  fc(doc, rgb);
  doc.circle(x, y, 1.8, 'F');
}

// ─── Main export ──────────────────────────────────────────────────────────────
export function generateReport(data: ReportData): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const PW = doc.internal.pageSize.getWidth();   // 210 mm
  const PH = doc.internal.pageSize.getHeight();  // 297 mm
  const M  = 18;
  const CW = PW - M * 2;                         // 174 mm usable width

  const delta = data.spaceScoreAfter - data.spaceScoreBefore;
  const redCount    = data.violations.filter(v => v.classification === 'RED').length;
  const yellowCount = data.violations.filter(v => v.classification === 'YELLOW').length;

  // ── PAGE 1 ─ COVER ──────────────────────────────────────────────────────────
  fc(doc, NAVY);
  doc.rect(0, 0, PW, 52, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(34);
  tc(doc, WHITE);
  doc.text('HABI3D', M, 30);

  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text('Furniture Clearance Analysis Report', M, 42);

  // Participant details block
  let y = 70;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  tc(doc, GRAY);
  doc.text('PARTICIPANT DETAILS', M, y);

  y += 7;
  const info: [string, string][] = [
    ['Participant', data.participantCode],
    ['Building',   data.building],
    ['Unit Type',  data.unitType],
    ['Date',       data.sessionDate],
  ];
  info.forEach(([label, value]) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    tc(doc, GRAY);
    doc.text(`${label}:`, M, y);
    tc(doc, DARK);
    doc.text(value, M + 36, y);
    y += 7;
  });

  // Divider
  y += 4;
  dc(doc, LGRAY);
  doc.setLineWidth(0.3);
  doc.line(M, y, PW - M, y);
  y += 10;

  // Session summary header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  tc(doc, GRAY);
  doc.text('SESSION SUMMARY', M, y);
  y += 9;

  // Score boxes (before / after)
  const boxW = (CW - 8) / 2;
  const boxH = 34;

  // Before box
  fc(doc, RBKG);
  doc.roundedRect(M, y, boxW, boxH, 3, 3, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  tc(doc, GRAY);
  doc.text('Space Score  BEFORE', M + 5, y + 8);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  tc(doc, RED);
  doc.text(`${data.spaceScoreBefore.toFixed(1)}%`, M + 5, y + 23);
  drawBar(doc, M + 5, y + 28, boxW - 10, data.spaceScoreBefore, RED);

  // After box
  const ax = M + boxW + 8;
  fc(doc, GBKG);
  doc.roundedRect(ax, y, boxW, boxH, 3, 3, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  tc(doc, GRAY);
  doc.text('Space Score  AFTER', ax + 5, y + 8);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  tc(doc, GREEN);
  doc.text(`${data.spaceScoreAfter.toFixed(1)}%`, ax + 5, y + 23);
  drawBar(doc, ax + 5, y + 28, boxW - 10, data.spaceScoreAfter, GREEN);

  y += boxH + 12;

  // Improvement line
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  tc(doc, delta >= 0 ? GREEN : RED);
  doc.text(`${delta >= 0 ? '+' : ''}${delta.toFixed(1)} points free floor area gained`, M, y);

  y += 9;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  tc(doc, GRAY);
  doc.text(`${data.stepsCompleted} of ${data.totalViolations} clearance violations resolved`, M, y);

  y += 7;
  dot(doc, M + 2,     y, RED);
  dot(doc, M + 50,    y, AMBER);
  doc.setFontSize(9);
  tc(doc, DARK);
  doc.text(`${redCount} critical (RED)`,   M + 6,  y + 0.8);
  doc.text(`${yellowCount} moderate (YELLOW)`, M + 54, y + 0.8);

  // Footer
  doc.setFontSize(8);
  tc(doc, LGRAY);
  doc.text(
    'Generated by Habi3D  ·  Mulberry Place, Bengaline, Acacia Estates, Taguig City',
    M, PH - 10,
  );

  // ── PAGE 2 ─ BEFORE & AFTER FLOOR PLANS ─────────────────────────────────────
  doc.addPage();
  pageHeader(doc, PW, 2);

  y = 22;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  tc(doc, DARK);
  doc.text('Before & After Comparison', M, y);
  y += 13;

  // Canvas was drawn at 720×520 px → aspect ratio 720:520 = 1.3846
  const ASPECT = 720 / 520;
  const hasBoth = Boolean(data.floorPlanDataUrl && data.floorPlanAfterDataUrl);
  const imgW = hasBoth ? (CW - 10) / 2 : CW;
  const imgH = imgW / ASPECT;

  if (data.floorPlanDataUrl) {
    // ── Before ──
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    tc(doc, RED);
    doc.text('BEFORE', M, y);
    doc.setFont('helvetica', 'normal');
    tc(doc, GRAY);
    doc.text(`Free floor area: ${data.spaceScoreBefore.toFixed(1)}%`, M + 22, y);

    if (hasBoth) {
      // ── After label (right column) ──
      const cx = M + imgW + 10;
      doc.setFont('helvetica', 'bold');
      tc(doc, GREEN);
      doc.text('AFTER', cx, y);
      doc.setFont('helvetica', 'normal');
      tc(doc, GRAY);
      doc.text(`Free floor area: ${data.spaceScoreAfter.toFixed(1)}%`, cx + 20, y);
    }

    y += 4;
    doc.addImage(data.floorPlanDataUrl, 'PNG', M, y, imgW, imgH);

    if (hasBoth) {
      doc.addImage(data.floorPlanAfterDataUrl, 'PNG', M + imgW + 10, y, imgW, imgH);
    }

    y += imgH + 12;

    // Comparative progress bars
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    tc(doc, GRAY);
    doc.text('FREE FLOOR AREA COMPARISON', M, y);
    y += 7;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    tc(doc, DARK);
    doc.text('Before', M, y + 3.5);
    drawBar(doc, M + 16, y, CW - 16, data.spaceScoreBefore, RED);
    tc(doc, RED);
    doc.text(`${data.spaceScoreBefore.toFixed(1)}%`, M + CW + 2, y + 3.5);

    y += 9;
    tc(doc, DARK);
    doc.text('After', M, y + 3.5);
    drawBar(doc, M + 16, y, CW - 16, data.spaceScoreAfter, GREEN);
    tc(doc, GREEN);
    doc.text(`${data.spaceScoreAfter.toFixed(1)}%`, M + CW + 2, y + 3.5);

    y += 9;
    tc(doc, delta >= 0 ? GREEN : RED);
    doc.setFont('helvetica', 'bold');
    doc.text(
      `${delta >= 0 ? 'Improvement: +' : 'Change: '}${delta.toFixed(1)} points`,
      M + 16, y + 3.5,
    );
  }

  // ── PAGE 3 ─ CLEARANCE VIOLATIONS + RECOMMENDATIONS ─────────────────────────
  doc.addPage();
  pageHeader(doc, PW, 3);

  y = 22;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  tc(doc, DARK);
  doc.text('Clearance Violations', M, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  tc(doc, GRAY);
  doc.text(
    `${data.totalViolations} violations detected  ·  ${data.stepsCompleted} resolved  ·  ${redCount} critical  ·  ${yellowCount} moderate`,
    M, y,
  );
  y += 9;

  // Table header row
  const CX = { dot: M + 2, rule: M + 7, item: M + 26, sev: M + 84, meas: M + 114, req: M + 136, pri: M + 158 };

  fc(doc, HBKG);
  doc.rect(M, y - 3, CW, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  tc(doc, GRAY);
  doc.text('RULE',     CX.rule, y + 1.5);
  doc.text('FURNITURE', CX.item, y + 1.5);
  doc.text('SEVERITY', CX.sev,  y + 1.5);
  doc.text('MEASURED', CX.meas, y + 1.5);
  doc.text('REQUIRED', CX.req,  y + 1.5);
  doc.text('PRIORITY', CX.pri,  y + 1.5);
  y += 10;

  dc(doc, LGRAY);
  doc.setLineWidth(0.15);

  data.violations.forEach((v) => {
    if (y > 270) {
      doc.addPage();
      pageHeader(doc, PW, doc.getNumberOfPages());
      y = 22;
    }

    if (v.resolved) {
      fc(doc, GBKG);
      doc.rect(M, y - 3.5, CW, 8, 'F');
    }

    dot(doc, CX.dot, y - 0.5, severityRgb(v.classification));

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    tc(doc, DARK);
    doc.text(v.ruleCode, CX.rule, y);
    doc.text(v.furnitureLabel.slice(0, 22), CX.item, y);

    doc.setFont('helvetica', 'bold');
    tc(doc, severityRgb(v.classification));
    doc.text(v.classification, CX.sev, y);

    doc.setFont('helvetica', 'normal');
    tc(doc, DARK);
    doc.text(`${v.measuredCm} cm`, CX.meas, y);
    doc.text(`${v.requiredCm} cm`, CX.req,  y);
    doc.text(v.priorityScore.toLocaleString(), CX.pri, y);

    if (v.resolved) {
      doc.setFontSize(7.5);
      tc(doc, GREEN);
      doc.setFont('helvetica', 'bold');
      doc.text('RESOLVED', CX.pri + 18, y);
      doc.setFontSize(9);
    }

    y += 8;
    dc(doc, LGRAY);
    doc.line(M, y - 2.5, PW - M, y - 2.5);
  });

  // Recommendations list
  y += 8;
  if (y > 245) { doc.addPage(); pageHeader(doc, PW, doc.getNumberOfPages()); y = 22; }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  tc(doc, DARK);
  doc.text('Recommendations', M, y);
  y += 10;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);

  data.violations.forEach((v, i) => {
    if (y > 278) { doc.addPage(); pageHeader(doc, PW, doc.getNumberOfPages()); y = 22; }
    dot(doc, M + 2, y - 0.5, severityRgb(v.classification));
    tc(doc, DARK);
    const line = `${i + 1}.  Move ${v.furnitureLabel}:  ${v.fixDirectionCm} cm  ${v.fixDirectionLabel}`;
    doc.text(line, M + 7, y);
    if (v.resolved) {
      doc.setFont('helvetica', 'bold');
      tc(doc, GREEN);
      doc.text('  [DONE]', M + 7 + doc.getTextWidth(line), y);
      doc.setFont('helvetica', 'normal');
    }
    y += 7;
  });

  // ── PAGE 4 ─ RESEARCHER NOTES ────────────────────────────────────────────────
  doc.addPage();
  pageHeader(doc, PW, doc.getNumberOfPages());

  y = 22;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  tc(doc, DARK);
  doc.text('Researcher Notes', M, y);
  y += 7;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  tc(doc, GRAY);
  doc.text('Qualitative observations and participant verbal feedback', M, y);
  y += 14;

  dc(doc, LGRAY);
  doc.setLineWidth(0.3);
  for (let i = 0; i < 22; i++) {
    doc.line(M, y, PW - M, y);
    y += 10;
  }

  doc.save(`Habi3D-Report-${data.participantCode}.pdf`);
}
