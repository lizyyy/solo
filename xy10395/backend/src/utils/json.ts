export function parseJsonArray(jsonStr: string | undefined | null): string[] {
  if (!jsonStr) return [];
  try {
    const parsed = JSON.parse(jsonStr);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function stringifyJsonArray(arr: string[] | undefined): string {
  if (!arr || !Array.isArray(arr)) return '[]';
  return JSON.stringify(arr);
}
