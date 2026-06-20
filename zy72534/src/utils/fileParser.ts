export interface ParsedSampleRow {
  sampleNo: string;
  currentModelVersion: string;
  category: string;
  style: string;
  scene: string;
}

export function parseCsv(content: string): ParsedSampleRow[] {
  const lines = content.trim().split('\n');
  if (lines.length < 2) return [];

  const headerLine = lines[0];
  const headers = headerLine.split(',').map(h => h.trim().toLowerCase());

  const sampleNoIdx = headers.indexOf('sampleno');
  const modelVersionIdx = headers.indexOf('currentmodelversion');
  const categoryIdx = headers.indexOf('category');
  const styleIdx = headers.indexOf('style');
  const sceneIdx = headers.indexOf('scene');

  if (sampleNoIdx === -1) {
    throw new Error('CSV 缺少必填字段：sampleNo（样本编号）');
  }
  if (modelVersionIdx === -1) {
    throw new Error('CSV 缺少必填字段：currentModelVersion（模型版本）');
  }

  const rows: ParsedSampleRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = line.split(',').map(v => v.trim());
    if (values.length < 2) continue;

    rows.push({
      sampleNo: values[sampleNoIdx] || '',
      currentModelVersion: values[modelVersionIdx] || '',
      category: categoryIdx !== -1 ? values[categoryIdx] || '' : '',
      style: styleIdx !== -1 ? values[styleIdx] || '' : '',
      scene: sceneIdx !== -1 ? values[sceneIdx] || '' : '',
    });
  }

  return rows;
}

export function parseJson(content: string): ParsedSampleRow[] {
  const parsed = JSON.parse(content);

  if (!Array.isArray(parsed)) {
    throw new Error('JSON 文件必须是样本数组');
  }

  const rows: ParsedSampleRow[] = [];

  for (const item of parsed) {
    if (item.versions && Array.isArray(item.versions)) {
      for (const v of item.versions) {
        rows.push({
          sampleNo: item.sampleNo || '',
          currentModelVersion: v.modelVersion || '',
          category: v.tags?.category || '',
          style: v.tags?.style || '',
          scene: v.tags?.scene || '',
        });
      }
    } else {
      rows.push({
        sampleNo: item.sampleNo || '',
        currentModelVersion: item.currentModelVersion || item.modelVersion || '',
        category: item.category || item.tags?.category || '',
        style: item.style || item.tags?.style || '',
        scene: item.scene || item.tags?.scene || '',
      });
    }
  }

  return rows;
}

export async function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

export async function parseFile(file: File): Promise<ParsedSampleRow[]> {
  const name = file.name.toLowerCase();
  const text = await readFileAsText(file);

  if (name.endsWith('.csv')) {
    return parseCsv(text);
  }
  if (name.endsWith('.json')) {
    return parseJson(text);
  }

  throw new Error(`不支持的文件格式：${file.name}，仅支持 .csv 和 .json`);
}
