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
}

function setStatusColor(doc: jsPDF, classification: Violation['classification']) {
  if (classification === 'RED') {
    doc.setTextColor('#E24B4A');
    return;
  }
  if (classification === 'YELLOW') {
    doc.setTextColor('#F0A500');
    return;
  }
  doc.setTextColor('#4CAF50');
}

function drawBar(doc: jsPDF, x: number, y: number, width: number, value: number, color: string) {
  doc.setFillColor('#E5E7EB');
  doc.roundedRect(x, y, width, 7, 2, 2, 'F');
  doc.setFillColor(color);
  doc.roundedRect(x, y, Math.max(0, Math.min(width, (value / 100) * width)), 7, 2, 2, 'F');
}

export function generateReport(data: ReportData): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 18;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(34);
  doc.setTextColor('#1F3864');
  doc.text('HABI3D', pageWidth / 2, 54, { align: 'center' });
  doc.setFontSize(16);
  doc.setTextColor('#111827');
  doc.text('Furniture Clearance Report', pageWidth / 2, 66, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(`Participant: ${data.participantCode}`, margin, 92);
  doc.text(`Building: ${data.building}`, margin, 100);
  doc.text(`Unit: ${data.unitType}`, margin, 108);
  doc.text(`Date: ${data.sessionDate}`, margin, 116);

  doc.addPage();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor('#111827');
  doc.text('Space Utilization', margin, 24);

  doc.setFontSize(28);
  doc.setTextColor('#E24B4A');
  doc.text(`${data.spaceScoreBefore.toFixed(1)}%`, margin, 44);
  doc.setFontSize(10);
  doc.text('Before', margin, 52);

  doc.setFontSize(28);
  doc.setTextColor('#4CAF50');
  doc.text(`${data.spaceScoreAfter.toFixed(1)}%`, 112, 44);
  doc.setFontSize(10);
  doc.text('After', 112, 52);

  doc.setTextColor('#111827');
  doc.setFontSize(12);
  const delta = data.spaceScoreAfter - data.spaceScoreBefore;
  doc.text(`Improvement delta: ${delta >= 0 ? '+' : ''}${delta.toFixed(1)} points`, margin, 66);
  drawBar(doc, margin, 75, pageWidth - margin * 2, data.spaceScoreAfter, '#1F3864');

  if (data.floorPlanDataUrl) {
    doc.addImage(data.floorPlanDataUrl, 'PNG', margin, 92, pageWidth - margin * 2, 95);
  }

  doc.addPage();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor('#111827');
  doc.text('Violations Table', margin, 24);

  const headers = ['Rule', 'Furniture', 'Status', 'Measured', 'Required', 'Score'];
  const xs = [margin, 38, 82, 112, 142, 172];
  doc.setFontSize(9);
  headers.forEach((header, index) => doc.text(header, xs[index], 36));
  doc.setFont('helvetica', 'normal');

  let y = 44;
  data.violations.forEach((violation) => {
    if (y > 270) {
      doc.addPage();
      y = 24;
    }
    doc.setTextColor('#111827');
    doc.text(violation.ruleCode, xs[0], y);
    doc.text(violation.furnitureLabel.slice(0, 18), xs[1], y);
    setStatusColor(doc, violation.classification);
    doc.text(violation.classification, xs[2], y);
    doc.setTextColor('#111827');
    doc.text(`${violation.measuredCm}cm`, xs[3], y);
    doc.text(`${violation.requiredCm}cm`, xs[4], y);
    doc.text(violation.priorityScore.toLocaleString(), xs[5], y);
    y += 8;
  });

  y += 8;
  doc.setFont('helvetica', 'bold');
  doc.text(`Steps completed: ${data.stepsCompleted} of ${data.totalViolations}`, margin, y);
  y += 10;
  doc.setFont('helvetica', 'normal');
  data.violations.forEach((violation, index) => {
    if (y > 270) {
      doc.addPage();
      y = 24;
    }
    doc.text(
      `${index + 1}. Move ${violation.furnitureLabel}: ${violation.fixDirectionCm}cm ${violation.fixDirectionLabel}`,
      margin,
      y,
    );
    y += 7;
  });

  doc.addPage();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('Notes', margin, 24);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text('Participant observations:', margin, 38);

  let lineY = 50;
  for (let index = 0; index < 20; index += 1) {
    doc.line(margin, lineY, pageWidth - margin, lineY);
    lineY += 9;
  }

  doc.save(`Habi3D-Report-${data.participantCode}.pdf`);
}
