export function getQueryString(value: any): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (Array.isArray(value)) {
    return getQueryString(value[0]);
  }
  if (typeof value === 'object') {
    return undefined;
  }
  return String(value);
}

export function getQueryNumber(value: any): number | undefined {
  const str = getQueryString(value);
  if (str === undefined) {
    return undefined;
  }
  const num = parseInt(str);
  return isNaN(num) ? undefined : num;
}

export function getParamString(value: any): string {
  if (Array.isArray(value)) {
    return String(value[0]);
  }
  return String(value);
}
