export interface DiffResult {
  field: string
  before: unknown
  after: unknown
  type: 'added' | 'removed' | 'changed'
}

export function computeDiff<T extends Record<string, unknown>>(
  before: T,
  after: T
): DiffResult[] {
  const diffs: DiffResult[] = []
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)])

  for (const key of allKeys) {
    const beforeVal = before[key]
    const afterVal = after[key]

    if (!(key in before)) {
      diffs.push({ field: key, before: undefined, after: afterVal, type: 'added' })
    } else if (!(key in after)) {
      diffs.push({ field: key, before: beforeVal, after: undefined, type: 'removed' })
    } else if (JSON.stringify(beforeVal) !== JSON.stringify(afterVal)) {
      diffs.push({ field: key, before: beforeVal, after: afterVal, type: 'changed' })
    }
  }

  return diffs
}

export function applyMask<T extends Record<string, unknown>>(
  obj: T,
  sensitiveFields: string[]
): Partial<T> {
  const result: Partial<T> = { ...obj }
  for (const field of sensitiveFields) {
    if (field in result) {
      delete result[field as keyof T]
    }
  }
  return result
}

export function maskPhone(phone: string): string {
  if (!phone || phone.length < 7) return phone
  return phone.slice(0, 3) + '****' + phone.slice(-4)
}

export function maskSensitiveData<T extends Record<string, unknown>>(
  data: T,
  fieldsToMask: { field: string; maskFn: (value: string) => string }[]
): T {
  const result = { ...data }
  for (const { field, maskFn } of fieldsToMask) {
    if (field in result && typeof result[field] === 'string') {
      result[field as keyof T] = maskFn(result[field] as string) as T[keyof T]
    }
  }
  return result
}
