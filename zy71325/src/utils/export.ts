import { jsPDF } from "jspdf"
import { saveAs } from "file-saver"
import type { AlignmentVersion, AnomalyFragment, TrackAlignmentState } from "@/types"
import { ANOMALY_TYPE_LABELS, CHANNEL_TYPE_LABELS } from "@/types"
import { formatDuration, formatDateTime, generateId } from "./hash"

export function exportAsJSON(version: AlignmentVersion, tracks: { id: string; fileName: string; channelType: string }[]): string {
  const report = {
    versionId: version.id,
    createdAt: version.createdAt,
    summary: version.summary,
    tracks: version.trackStates.map((ts) => {
      const trackInfo = tracks.find((t) => t.id === ts.trackId)
      return {
        fileName: trackInfo?.fileName || "unknown",
        channelType: CHANNEL_TYPE_LABELS[trackInfo?.channelType as keyof typeof CHANNEL_TYPE_LABELS] || trackInfo?.channelType,
        offsetMs: ts.offsetMs,
        bpm: ts.bpm,
        driftSegments: ts.driftSegments.map((d) => ({
          timeRange: `${formatDuration(d.startTime)} - ${formatDuration(d.endTime)}`,
          bpmDelta: d.bpmDelta,
        })),
      }
    }),
    anomalies: version.anomalies.map((a) => ({
      type: ANOMALY_TYPE_LABELS[a.type],
      timeRange: `${formatDuration(a.startTime)} - ${formatDuration(a.endTime)}`,
      severity: a.severity === "error" ? "严重" : "警告",
      note: a.note,
      resolved: a.resolved ? "已处理" : "待处理",
    })),
  }
  return JSON.stringify(report, null, 2)
}

export function exportAsPDF(version: AlignmentVersion, tracks: { id: string; fileName: string; channelType: string }[]): jsPDF {
  const doc = new jsPDF()
  let y = 20

  doc.setFontSize(18)
  doc.text("Rehearsal Track Alignment Report", 20, y)
  y += 10

  doc.setFontSize(10)
  doc.text(`Version: ${version.id}`, 20, y)
  y += 6
  doc.text(`Created: ${formatDateTime(version.createdAt)}`, 20, y)
  y += 6
  doc.text(`Summary: ${version.summary}`, 20, y)
  y += 12

  doc.setFontSize(14)
  doc.text("Track States", 20, y)
  y += 8

  doc.setFontSize(9)
  for (const ts of version.trackStates) {
    const trackInfo = tracks.find((t) => t.id === ts.trackId)
    const label = trackInfo ? `${trackInfo.fileName} (${CHANNEL_TYPE_LABELS[trackInfo.channelType as keyof typeof CHANNEL_TYPE_LABELS]})` : ts.trackId
    doc.text(`  ${label}`, 20, y)
    y += 5
    doc.text(`    Offset: ${ts.offsetMs}ms | BPM: ${ts.bpm}`, 25, y)
    y += 5
    for (const d of ts.driftSegments) {
      doc.text(`    Drift: ${formatDuration(d.startTime)}-${formatDuration(d.endTime)} delta=${d.bpmDelta}BPM`, 25, y)
      y += 5
    }
    y += 3
    if (y > 270) { doc.addPage(); y = 20 }
  }

  y += 5
  doc.setFontSize(14)
  doc.text("Anomalies", 20, y)
  y += 8

  doc.setFontSize(9)
  for (const a of version.anomalies) {
    doc.text(`  [${ANOMALY_TYPE_LABELS[a.type]}] ${a.severity === "error" ? "ERROR" : "WARN"}`, 20, y)
    y += 5
    doc.text(`    ${a.note}`, 25, y)
    y += 5
    doc.text(`    Time: ${formatDuration(a.startTime)} - ${formatDuration(a.endTime)} | ${a.resolved ? "Resolved" : "Pending"}`, 25, y)
    y += 7
    if (y > 270) { doc.addPage(); y = 20 }
  }

  return doc
}

export function downloadJSON(content: string, filename: string): void {
  const blob = new Blob([content], { type: "application/json" })
  saveAs(blob, filename)
}

export function downloadPDF(doc: jsPDF, filename: string): void {
  doc.save(filename)
}

export function computeExportHash(content: string): string {
  let hash = 0
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash |= 0
  }
  return Math.abs(hash).toString(36) + generateId()
}
