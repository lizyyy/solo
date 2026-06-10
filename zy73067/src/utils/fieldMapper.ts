import type { FieldMapping } from "@/types";

export function mapSpareFields(
  spareData: Record<string, string>,
  mappings: FieldMapping[]
): Record<string, { systemField: string; value: string; isProtected: boolean }> {
  const result: Record<string, { systemField: string; value: string; isProtected: boolean }> = {};
  for (const [spareKey, value] of Object.entries(spareData)) {
    const mapping = mappings.find((m) => m.spareFieldName === spareKey);
    result[spareKey] = {
      systemField: mapping?.systemFieldName ?? "未映射",
      value,
      isProtected: mapping?.isProtected ?? false,
    };
  }
  return result;
}

export function getMappedValue(
  spareData: Record<string, string>,
  systemField: string,
  mappings: FieldMapping[]
): string | undefined {
  const matchedMapping = mappings.filter((m) => m.systemFieldName === systemField);
  for (const mapping of matchedMapping) {
    if (spareData[mapping.spareFieldName]) {
      return spareData[mapping.spareFieldName];
    }
  }
  return undefined;
}

export const PROTECTED_SYSTEM_FIELDS = ["source", "status"];

export function isFieldProtected(systemFieldName: string, mappings: FieldMapping[]): boolean {
  return mappings.some((m) => m.systemFieldName === systemFieldName && m.isProtected);
}
