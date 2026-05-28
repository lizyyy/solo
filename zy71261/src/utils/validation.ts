import type {
  PositionRecord,
  ValidationResult,
  CrossMonthWarning,
  ClientMergeIssue,
  DuplicateMarginEntry,
} from "@/types/index";

function computeDataHash(records: PositionRecord[]): string {
  let hash = 0;
  const str = JSON.stringify(records);
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return Math.abs(hash).toString(16).padStart(8, "0").substring(0, 16);
}

function detectCrossMonthWarnings(
  records: PositionRecord[]
): CrossMonthWarning[] {
  const warnings: CrossMonthWarning[] = [];
  const grouped = new Map<string, Map<string, number>>();

  for (const r of records) {
    if (!r.contractMonth || !r.direction || r.margin == null) continue;
    const key = `${r.clientId}::${r.varietyCode}`;
    if (!grouped.has(key)) grouped.set(key, new Map());
    const monthMap = grouped.get(key)!;
    const current = monthMap.get(r.contractMonth) ?? 0;
    const delta = r.direction === "long" ? r.margin : -r.margin;
    monthMap.set(r.contractMonth, current + delta);
  }

  for (const [key, monthMap] of grouped) {
    const [clientId, varietyCode] = key.split("::");
    const months = Array.from(monthMap.keys()).sort();
    for (let i = 0; i < months.length - 1; i++) {
      const fromNet = monthMap.get(months[i])!;
      const toNet = monthMap.get(months[i + 1])!;
      if (fromNet === 0 && toNet === 0) continue;
      const base = fromNet !== 0 ? fromNet : toNet;
      const changePercent = Math.abs((toNet - fromNet) / base) * 100;
      if (changePercent > 30) {
        warnings.push({
          clientId,
          varietyCode,
          fromMonth: months[i],
          toMonth: months[i + 1],
          netChangePercent: Math.round(changePercent * 100) / 100,
        });
      }
    }
  }

  return warnings;
}

function detectClientMergeIssues(records: PositionRecord[]): ClientMergeIssue[] {
  const nameToIds = new Map<string, Set<string>>();
  for (const r of records) {
    if (!r.clientName) continue;
    if (!nameToIds.has(r.clientName)) nameToIds.set(r.clientName, new Set());
    nameToIds.get(r.clientName)!.add(r.clientId);
  }
  const issues: ClientMergeIssue[] = [];
  for (const [name, ids] of nameToIds) {
    if (ids.size > 1) {
      issues.push({ clientName: name, distinctIds: Array.from(ids) });
    }
  }
  return issues;
}

function detectDuplicateMargins(
  records: PositionRecord[]
): DuplicateMarginEntry[] {
  const groups = new Map<string, { count: number; margin: number }>();
  for (const r of records) {
    if (!r.contractMonth || !r.direction || r.margin == null) continue;
    const key = `${r.clientId}::${r.varietyCode}::${r.contractMonth}::${r.direction}::${r.margin}`;
    const existing = groups.get(key);
    if (existing) {
      existing.count++;
    } else {
      groups.set(key, { count: 1, margin: r.margin });
    }
  }

  const duplicates: DuplicateMarginEntry[] = [];
  for (const [key, val] of groups) {
    if (val.count > 1) {
      const [clientId, varietyCode, contractMonth, direction] =
        key.split("::");
      duplicates.push({
        clientId,
        varietyCode,
        contractMonth,
        direction,
        duplicateCount: val.count,
        marginAmount: val.margin,
      });
    }
  }
  return duplicates;
}

export function validatePositions(records: PositionRecord[]): ValidationResult {
  return {
    id: `val_${Date.now()}`,
    timestamp: Date.now(),
    dataHash: computeDataHash(records),
    crossMonthRollWarnings: detectCrossMonthWarnings(records),
    clientMergeIssues: detectClientMergeIssues(records),
    duplicateMarginEntries: detectDuplicateMargins(records),
  };
}
