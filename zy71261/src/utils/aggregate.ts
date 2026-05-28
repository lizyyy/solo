import type {
  PositionRecord,
  AggregatedBlock,
  FilterState,
  FieldFlags,
} from "@/types/index";

export function aggregatePositions(records: PositionRecord[]): AggregatedBlock[] {
  const groups = new Map<string, AggregatedBlock>();

  for (const r of records) {
    if (!r.contractMonth || !r.direction) continue;

    const key = `${r.varietyCode}::${r.contractMonth}::${r.direction}::${r.clientId}`;
    const existing = groups.get(key);

    if (existing) {
      existing.totalMargin += r.margin ?? 0;
      existing.totalQuantity += r.quantity ?? 0;
      existing.recordIds.push(r.id);
      existing.hasMissingFields =
        existing.hasMissingFields || hasAnyMissing(r.fieldFlags);
      existing.fieldFlags = mergeFieldFlags(existing.fieldFlags, r.fieldFlags);
    } else {
      groups.set(key, {
        varietyCode: r.varietyCode,
        varietyName: r.varietyName ?? "",
        contractMonth: r.contractMonth,
        direction: r.direction,
        clientId: r.clientId,
        clientName: r.clientName ?? "",
        totalMargin: r.margin ?? 0,
        totalQuantity: r.quantity ?? 0,
        recordIds: [r.id],
        hasMissingFields: hasAnyMissing(r.fieldFlags),
        fieldFlags: { ...r.fieldFlags },
      });
    }
  }

  return Array.from(groups.values());
}

function hasAnyMissing(flags: FieldFlags): boolean {
  return (
    flags.clientIdMissing ||
    flags.varietyCodeMissing ||
    flags.contractMonthMissing ||
    flags.directionMissing ||
    flags.marginMissing ||
    flags.riskReportMissing
  );
}

function mergeFieldFlags(a: FieldFlags, b: FieldFlags): FieldFlags {
  return {
    clientIdMissing: a.clientIdMissing || b.clientIdMissing,
    varietyCodeMissing: a.varietyCodeMissing || b.varietyCodeMissing,
    contractMonthMissing: a.contractMonthMissing || b.contractMonthMissing,
    directionMissing: a.directionMissing || b.directionMissing,
    marginMissing: a.marginMissing || b.marginMissing,
    riskReportMissing: a.riskReportMissing || b.riskReportMissing,
  };
}

export function filterPositions(
  records: PositionRecord[],
  filter: FilterState
): PositionRecord[] {
  return records.filter((r) => {
    if (
      filter.varieties.length > 0 &&
      !filter.varieties.includes(r.varietyCode)
    )
      return false;
    if (
      filter.months.length > 0 &&
      (r.contractMonth == null || !filter.months.includes(r.contractMonth))
    )
      return false;
    if (
      filter.directions.length > 0 &&
      (r.direction == null || !filter.directions.includes(r.direction))
    )
      return false;
    if (
      filter.clientSearch &&
      r.clientName &&
      !r.clientName.toLowerCase().includes(filter.clientSearch.toLowerCase())
    )
      return false;
    return true;
  });
}

export function getVarietySummary(
  blocks: AggregatedBlock[]
): {
  varietyCode: string;
  varietyName: string;
  longMargin: number;
  shortMargin: number;
  netMargin: number;
}[] {
  const map = new Map<
    string,
    {
      varietyCode: string;
      varietyName: string;
      longMargin: number;
      shortMargin: number;
    }
  >();

  for (const b of blocks) {
    const existing = map.get(b.varietyCode);
    if (existing) {
      if (b.direction === "long") existing.longMargin += b.totalMargin;
      else existing.shortMargin += b.totalMargin;
    } else {
      map.set(b.varietyCode, {
        varietyCode: b.varietyCode,
        varietyName: b.varietyName,
        longMargin: b.direction === "long" ? b.totalMargin : 0,
        shortMargin: b.direction === "short" ? b.totalMargin : 0,
      });
    }
  }

  return Array.from(map.values()).map((v) => ({
    ...v,
    netMargin: v.longMargin - v.shortMargin,
  }));
}

export function getMonthSlice(
  blocks: AggregatedBlock[],
  month: string
): AggregatedBlock[] {
  return blocks.filter((b) => b.contractMonth === month);
}

export function computeDataHash(records: PositionRecord[]): string {
  let hash = 0;
  const str = JSON.stringify(records);
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return Math.abs(hash).toString(16).padStart(8, "0").substring(0, 16);
}
