import type { CargoItem, ParsingError } from '@/types';

export async function parseCargoCsv(content: string): Promise<{ cargoItems: CargoItem[]; errors: ParsingError[] }> {
  const errors: ParsingError[] = [];
  const cargoItems: CargoItem[] = [];
  const containerNos = new Set<string>();

  const lines = content.trim().split('\n');
  if (lines.length === 0) {
    errors.push({ field: 'content', message: 'Empty CSV content' });
    return { cargoItems: [], errors };
  }

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const headerMap: Record<string, number> = {};
  headers.forEach((h, i) => { headerMap[h] = i; });

  const requiredFields = ['containerno', 'weight', 'category'];
  for (const field of requiredFields) {
    if (!(field in headerMap)) {
      errors.push({ field: field, message: `Missing required column: ${field}` });
    }
  }

  if (errors.length > 0) {
    return { cargoItems: [], errors };
  }

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    const values = line.split(',');
    const containerNo = values[headerMap['containerno']]?.trim() || '';
    
    if (!containerNo) {
      errors.push({ field: 'containerNo', message: 'Container number is empty', rowIndex: i });
      continue;
    }

    if (containerNos.has(containerNo)) {
      errors.push({ field: 'containerNo', message: `Duplicate container number: ${containerNo}`, rowIndex: i });
    }
    containerNos.add(containerNo);

    const weightStr = values[headerMap['weight']]?.trim() || '';
    const weight = weightStr ? parseFloat(weightStr) : null;
    if (weight !== null && (isNaN(weight) || weight <= 0)) {
      errors.push({ field: 'weight', message: `Invalid weight: ${weightStr}`, rowIndex: i });
    }

    const category = values[headerMap['category']]?.trim() || 'general';
    const isDangerous = category.toLowerCase().includes('dangerous') || category.toLowerCase().includes('dg');
    const dangerousClass = isDangerous ? values[headerMap['dangerousclass']]?.trim() || '' : undefined;

    const length = parseFloat(values[headerMap['length']]?.trim() || '12');
    const width = parseFloat(values[headerMap['width']]?.trim() || '2.4');
    const height = parseFloat(values[headerMap['height']]?.trim() || '2.6');

    cargoItems.push({
      id: `cargo-${i}`,
      containerNo,
      weight: weight ?? null,
      category,
      isDangerous,
      dangerousClass,
      length: isNaN(length) ? 12 : length,
      width: isNaN(width) ? 2.4 : width,
      height: isNaN(height) ? 2.6 : height,
    });
  }

  return { cargoItems, errors };
}