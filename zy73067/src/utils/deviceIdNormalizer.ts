import type { DeviceIdMapping } from "@/types";

export function normalizeDeviceId(rawId: string, mappings: DeviceIdMapping[]): string {
  const cleaned = rawId.trim().toUpperCase().replace(/[\s\-_#/]/g, "");
  for (const mapping of mappings) {
    const matched = mapping.patterns.some((p) => {
      const patternCleaned = p.trim().toUpperCase().replace(/[\s\-_#/]/g, "");
      return cleaned === patternCleaned || cleaned.includes(patternCleaned.slice(-6));
    });
    if (matched) return mapping.unifiedId;
  }
  return rawId.trim();
}

export function matchesUnifiedId(searchQuery: string, unifiedId: string, originalIds: string[]): boolean {
  if (!searchQuery.trim()) return true;
  const q = searchQuery.trim().toUpperCase();
  const normalizedQ = q.replace(/[\s\-_#/]/g, "");
  if (unifiedId.toUpperCase().replace(/[\s\-_#/]/g, "").includes(normalizedQ)) return true;
  if (unifiedId.toUpperCase().includes(q)) return true;
  return originalIds.some(
    (id) =>
      id.toUpperCase().replace(/[\s\-_#/]/g, "").includes(normalizedQ) ||
      id.toUpperCase().includes(q)
  );
}
