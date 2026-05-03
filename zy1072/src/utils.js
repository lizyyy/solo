export function parseBoolean(value) {
  if (value === undefined || value === null || value === '') {
    return false;
  }
  const normalized = String(value).toLowerCase().trim();
  return ['是', 'yes', 'y', 'true', 't', '1'].includes(normalized);
}

export function parseArray(value, delimiter = /[,，、\s]+/) {
  if (!value) return [];
  return String(value).split(delimiter).map(s => s.trim()).filter(Boolean);
}

export function parseNumber(value, defaultValue = 0) {
  const num = Number(value);
  return isNaN(num) ? defaultValue : num;
}

export function normalizeName(name) {
  return String(name).trim();
}

export function groupBy(items, key) {
  const groups = {};
  for (const item of items) {
    const k = item[key];
    if (!groups[k]) {
      groups[k] = [];
    }
    groups[k].push(item);
  }
  return groups;
}

export function deduplicateArray(arr) {
  return [...new Set(arr)];
}
