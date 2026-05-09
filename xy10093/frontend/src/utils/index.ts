export function formatDate(isoString: string, includeTime = false): string {
  if (!isoString) return '-';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    if (includeTime) {
      const h = String(d.getHours()).padStart(2, '0');
      const min = String(d.getMinutes()).padStart(2, '0');
      return `${y}-${m}-${day} ${h}:${min}`;
    }
    return `${y}-${m}-${day}`;
  } catch {
    return isoString || '-';
  }
}

export function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function generateOrderNo(): string {
  const d = new Date();
  const y = d.getFullYear();
  const rand = String(Math.floor(Math.random() * 9000) + 1000);
  return `RW-${y}-${rand}`;
}
