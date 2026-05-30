import type { ModalRecord } from '@/types';
import { validateImportRecord, SAMPLE_PROBLEM_RECORDS } from './sampleData';

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function parseCSV(text: string): Partial<ModalRecord>[] {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((h) => h.trim());
  const records: Partial<ModalRecord>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map((v) => v.trim());
    if (values.length < headers.length) continue;

    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx];
    });

    records.push({
      id: row.id || uid(),
      name: row.name || `导入记录 ${i}`,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      parameters: {
        id: uid(),
        recordId: row.id || uid(),
        source: 'import' as const,
        sourceDetail: `CSV导入 (第${i}行)`,
        boxDims: {
          length: parseFloat(row.length) || 0,
          width: parseFloat(row.width) || 0,
          depth: parseFloat(row.depth) || 0,
        },
        soundHole: {
          diameter: parseFloat(row.soundhole_diameter) || 0,
          position: row.soundhole_position || '面板中央',
        },
        wood: {
          name: row.wood_name || '未知木材',
          density: parseFloat(row.density) || 0,
          elasticModulus: parseFloat(row.elastic_modulus) || 0,
          isCustom: row.wood_name ? !SAMPLE_PROBLEM_RECORDS.some((s) => s.parameters?.wood.name === row.wood_name) : true,
        },
        lengthUnit: (row.length_unit as 'mm' | 'cm' | 'in') || 'mm',
        densityUnit: (row.density_unit as 'kg_m3' | 'g_cm3') || 'kg_m3',
      },
      peaks: [],
      auditLog: [],
    });
  }

  return records;
}

export function parseJSON(text: string): Partial<ModalRecord>[] {
  try {
    const data = JSON.parse(text);
    if (Array.isArray(data)) {
      return data.map((item: Partial<ModalRecord>, idx: number) => ({
        ...item,
        id: item.id || uid(),
        name: item.name || `导入记录 ${idx + 1}`,
        parameters: item.parameters
          ? {
              ...item.parameters,
              id: item.parameters.id || uid(),
              source: 'import' as const,
              sourceDetail: item.parameters.sourceDetail || 'JSON导入',
            }
          : undefined,
      }));
    }
    if (data.record) {
      return [
        {
          ...data.record,
          id: data.record.id || uid(),
          parameters: data.record.parameters
            ? {
                ...data.record.parameters,
                id: data.record.parameters.id || uid(),
                source: 'import' as const,
                sourceDetail: data.record.parameters.sourceDetail || 'JSON导入',
              }
            : undefined,
        },
      ];
    }
    return [];
  } catch {
    return [];
  }
}

export function importAndValidate(text: string, format: 'json' | 'csv'): { records: Partial<ModalRecord>[]; results: { valid: boolean; errors: string[] }[] } {
  const records = format === 'csv' ? parseCSV(text) : parseJSON(text);
  const results = records.map((r) => validateImportRecord(r));
  return { records, results };
}
