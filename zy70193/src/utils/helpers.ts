export function asString(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

export function asStringArray(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value === 'string') {
    return [value];
  }
  return [];
}

export function asNumber(value: string | string[] | undefined): number | undefined {
  const str = asString(value);
  if (str === undefined) return undefined;
  const num = Number(str);
  return isNaN(num) ? undefined : num;
}

export function asBoolean(value: string | string[] | undefined): boolean | undefined {
  const str = asString(value);
  if (str === undefined) return undefined;
  return str === 'true' || str === '1';
}
