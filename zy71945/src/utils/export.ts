import type { OcclusionEvent, MissingFrameAlert, ReviewRecord, ReviewHistory } from "@/types";
import { formatTime } from "./timeFormat";
import Papa from "papaparse";

export function exportEventsToJSON(events: OcclusionEvent[]): void {
  const blob = new Blob([JSON.stringify(events, null, 2)], { type: "application/json" });
  downloadBlob(blob, `遮挡事件_${formatTime(Date.now()).replace(/[:\s]/g, "_")}.json`);
}

export function exportEventsToCSV(events: OcclusionEvent[]): void {
  const rows = events.map((e) => ({
    遮挡开始: formatTime(e.startTime),
    遮挡结束: formatTime(e.endTime),
    判断理由: e.reason,
    数据来源: e.dataSource,
    置信度: e.confidence,
    状态: e.status,
    处理口径: e.handlingGuideline,
    分析时间: formatTime(e.analyzedAt),
  }));
  const csv = Papa.unparse(rows);
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  downloadBlob(blob, `遮挡事件_${formatTime(Date.now()).replace(/[:\s]/g, "_")}.csv`);
}

export async function exportBriefingToPDF(
  events: OcclusionEvent[],
  alerts: MissingFrameAlert[],
  reviews: ReviewRecord[],
  histories: ReviewHistory[]
): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  doc.setFont("helvetica");
  doc.setFontSize(16);
  doc.text("Star Sensor Occlusion Briefing", 20, 20);
  doc.setFontSize(10);
  doc.text(`Generated: ${formatTime(Date.now())}`, 20, 28);

  const confirmed = events.filter((e) => e.status === "confirmed");
  const pending = events.filter((e) => e.status === "pending");
  const modified = events.filter((e) => e.status === "modified");

  let y = 40;

  const drawSection = (title: string, items: OcclusionEvent[]) => {
    if (y > 260) {
      doc.addPage();
      y = 20;
    }
    doc.setFontSize(12);
    doc.text(`${title} (${items.length})`, 20, y);
    y += 8;
    doc.setFontSize(8);
    for (const item of items) {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      doc.text(`${formatTime(item.startTime)} - ${formatTime(item.endTime)}`, 22, y);
      y += 5;
      const reasonLines = doc.splitTextToSize(`Reason: ${item.reason}`, 160);
      doc.text(reasonLines, 22, y);
      y += reasonLines.length * 4;
      doc.text(`Guideline: ${item.handlingGuideline}`, 22, y);
      y += 5;
      y += 3;
    }
  };

  drawSection("Confirmed", confirmed);
  drawSection("Pending (needs data)", pending);
  drawSection("Manually Modified", modified);

  if (alerts.length > 0) {
    if (y > 250) {
      doc.addPage();
      y = 20;
    }
    y += 5;
    doc.setFontSize(12);
    doc.text(`Missing Frame Alerts (${alerts.length})`, 20, y);
    y += 8;
    doc.setFontSize(8);
    for (const alert of alerts) {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      doc.text(`[${alert.source}] ${alert.description}`, 22, y);
      y += 5;
      doc.text(`Next: ${alert.nextStep} | Contact: ${alert.responsible}`, 22, y);
      y += 7;
    }
  }

  doc.save(`briefing_${formatTime(Date.now()).replace(/[:\s]/g, "_")}.pdf`);
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
