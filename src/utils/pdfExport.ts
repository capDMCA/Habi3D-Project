import jsPDF from 'jspdf';

export interface ReportViolationSummary {
  ruleCode: string;
  furnitureLabel: string;
  classification: 'RED' | 'YELLOW' | 'GREEN';
  measuredCm: number;
  requiredCm: number;
  priorityScore: number;
}

export interface ReportStep {
  stepNumber: number;
  furnitureLabel: string;
  directionLabel: string;
  fixDirectionCm: number;
}

export interface ReportData {
  participantCode: string;
  building: string;
  unitType: string;
  date: string;
  scoreBefore: number;
  scoreAfter: number;
  improvementPoints: number;
  violations: ReportViolationSummary[];
  steps: ReportStep[];
  floorPlanDataUrl: string;
}

function drawScoreBar(doc: jsPDF, x: number, y: number, width: number, percent: number) {
  doc.setFillColor('#E2E8F0');
  doc.rect(x, y, width, 8, 'F');
  doc.setFillColor('#2563EB');
  doc.rect(x, y, Math.min(width, (percent / 100) * width), 8, 'F');
}

export function generateReport(data: ReportData): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFillColor('#0F172A');
  doc.rect(0, 0, pageWidth, 40, 'F');
  doc.setTextColor('#FFFFFF');
  doc.setFontSize(28);
  doc.text('Habi3D', 20, 26);
  doc.setFontSize(12);
  doc.text('Step-by-step Recommendation Report', 20, 34);

  doc.setTextColor('#111827');
  doc.setFontSize(12);
  doc.text(`Participant code: ${data.participantCode}`, 20, 52);
  doc.text(`Building: ${data.building}`, 20, 60);
  doc.text(`Unit type: ${data.unitType}`, 20, 68);
  doc.text(`Date: ${data.date}`, 20, 76);

  doc.setFontSize(14);
  doc.text('Space Utilization Score', 20, 92);
  doc.setFontSize(11);
  doc.text(`Before: ${data.scoreBefore.toFixed(1)}%`, 20, 100);
  doc.text(`After: ${data.scoreAfter.toFixed(1)}%`, 20, 106);
  doc.text(`Improvement: ${data.improvementPoints >= 0 ? '+' : ''}${data.improvementPoints.toFixed(1)} points`, 20, 112);
  drawScoreBar(doc, 20, 118, pageWidth - 40, Math.min(100, Math.max(0, data.scoreAfter)));

  doc.addPage();
  doc.setFontSize(18);
  doc.text('Violation summary', 20, 24);
  doc.setFontSize(10);
  doc.text('Rule Code', 20, 32);
  doc.text('Furniture', 50, 32);
  doc.text('Classification', 100, 32);
  doc.text('Measured', 138, 32);
  doc.text('Required', 160, 32);
  doc.text('Priority', 185, 32);

  let y = 38;
  data.violations.forEach((item) => {
    doc.setFontSize(10);
    doc.text(item.ruleCode, 20, y);
    doc.text(item.furnitureLabel, 50, y);
    doc.text(item.classification, 100, y);
    doc.text(`${item.measuredCm} cm`, 138, y);
    doc.text(`${item.requiredCm} cm`, 160, y);
    doc.text(item.priorityScore.toString(), 185, y);
    y += 8;
    if (y > 265) {
      doc.addPage();
      y = 24;
    }
  });

  doc.addPage();
  doc.setFontSize(18);
  doc.text('Recommendation steps', 20, 24);
  doc.setFontSize(11);
  data.steps.forEach((step) => {
    const line = `${step.stepNumber}. ${step.furnitureLabel} — ${step.fixDirectionCm} cm ${step.directionLabel}`;
    doc.text(line, 20, 34 + step.stepNumber * 8);
  });

  doc.addPage();
  doc.setFontSize(18);
  doc.text('Floor plan and notes', 20, 24);
  if (data.floorPlanDataUrl) {
    doc.addImage(data.floorPlanDataUrl, 'PNG', 20, 30, pageWidth - 40, 90);
  }

  doc.setFontSize(12);
  doc.text('Participant observations', 20, 132);
  let noteY = 140;
  for (let line = 0; line < 8; line += 1) {
    doc.line(20, noteY, pageWidth - 20, noteY);
    noteY += 8;
  }

  doc.save(`Habi3D-Report-${data.participantCode}.pdf`);
}
