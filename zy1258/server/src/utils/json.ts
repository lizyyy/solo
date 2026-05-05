export function jsonStringify(obj: any): string {
  return JSON.stringify(obj)
}

export function jsonParse<T = any>(str: string | null | undefined, defaultValue: T | null = null): T | null {
  if (!str) return defaultValue
  try {
    return JSON.parse(str) as T
  } catch {
    return defaultValue
  }
}

export function jsonStringifyOptional(obj: any): string | null {
  if (obj === undefined || obj === null) return null
  return JSON.stringify(obj)
}
