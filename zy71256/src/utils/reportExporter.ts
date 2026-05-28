import type {
  ChipPackage,
  Pin,
  VoltageDomain,
  Conflict,
  ReviewReport,
} from "@/data/types";

function formatTimestamp(): string {
  const now = new Date();
  const yyyy = now.getFullYear().toString();
  const MM = (now.getMonth() + 1).toString().padStart(2, "0");
  const dd = now.getDate().toString().padStart(2, "0");
  const HH = now.getHours().toString().padStart(2, "0");
  const mm = now.getMinutes().toString().padStart(2, "0");
  const ss = now.getSeconds().toString().padStart(2, "0");
  return `${yyyy}${MM}${dd}_${HH}${mm}${ss}`;
}

export function exportReviewReport(
  chip: ChipPackage,
  pins: Pin[],
  voltageDomains: VoltageDomain[],
  conflicts: Conflict[],
  batchId: string
): void {
  const voltageDomainSummary: Record<string, number> = {};
  for (const vd of voltageDomains) {
    const count = pins.filter((p) => p.voltageDomainId === vd.id).length;
    voltageDomainSummary[vd.name] = count;
  }

  const pinSignalMap: Record<string, string> = {};
  for (const pin of pins) {
    pinSignalMap[pin.name] = pin.signalType;
  }

  const report: ReviewReport = {
    batchId,
    timestamp: new Date().toISOString(),
    chipName: chip.name,
    conflicts,
    voltageDomainSummary,
    pinSignalMap,
  };

  const filename = `review_report_${chip.name}_${batchId}_${formatTimestamp()}.json`;
  const blob = new Blob([JSON.stringify(report, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
