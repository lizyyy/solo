import CryptoJS from 'crypto-js';
import { Material, MaterialType, DiffResult, ChangeItem, RowChange, FieldChange } from '@/types';
import Papa from 'papaparse';

export function generateFileHash(content: string): string {
  return CryptoJS.MD5(content).toString();
}

export function parseCSVContent(content: string): Record<string, any>[] {
  const result = Papa.parse(content, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: true,
  });
  return result.data as Record<string, any>[];
}

export function normalizeRow(row: Record<string, any>): Record<string, any> {
  const normalized: Record<string, any> = {};
  for (const key of Object.keys(row)) {
    const normalizedKey = key.trim().toLowerCase().replace(/[\s_-]/g, '');
    normalized[normalizedKey] = row[key];
  }
  return normalized;
}

export function compareRows(
  row1: Record<string, any>,
  row2: Record<string, any>
): FieldChange[] {
  const changes: FieldChange[] = [];
  const norm1 = normalizeRow(row1);
  const norm2 = normalizeRow(row2);
  const allKeys = new Set([...Object.keys(norm1), ...Object.keys(norm2)]);

  for (const key of allKeys) {
    const val1 = norm1[key];
    const val2 = norm2[key];
    
    if (val1 !== val2) {
      if (typeof val1 === 'number' && typeof val2 === 'number') {
        if (Math.abs(val1 - val2) > 0.0001) {
          changes.push({ field: key, oldValue: val1, newValue: val2 });
        }
      } else {
        changes.push({ field: key, oldValue: val1, newValue: val2 });
      }
    }
  }

  return changes;
}

export function findRowByKey(
  rows: Record<string, any>[],
  key: string,
  value: any
): { row: Record<string, any>; index: number } | null {
  const normalizedValue = String(value).trim().toLowerCase();
  for (let i = 0; i < rows.length; i++) {
    const normRow = normalizeRow(rows[i]);
    if (String(normRow[key] || '').trim().toLowerCase() === normalizedValue) {
      return { row: rows[i], index: i };
    }
  }
  return null;
}

export function getPrimaryKeyField(materialType: MaterialType): string {
  switch (materialType) {
    case 'holding':
      return 'symbol';
    case 'target':
      return 'symbol';
    case 'price':
      return 'symbol';
    default:
      return 'symbol';
  }
}

export function diffMaterialContent(
  oldContent: string,
  newContent: string,
  materialType: MaterialType
): { fieldChanges: FieldChange[]; rowChanges: RowChange[] } {
  const oldRows = parseCSVContent(oldContent);
  const newRows = parseCSVContent(newContent);
  const primaryKey = getPrimaryKeyField(materialType);

  const rowChanges: RowChange[] = [];
  const allFieldChanges: FieldChange[] = [];
  const normPrimaryKey = primaryKey.toLowerCase().replace(/[\s_-]/g, '');

  const oldKeys = new Set<string>();
  for (const row of oldRows) {
    const normRow = normalizeRow(row);
    const key = String(normRow[normPrimaryKey] || '').trim();
    if (key) oldKeys.add(key);
  }

  const newKeys = new Set<string>();
  for (const row of newRows) {
    const normRow = normalizeRow(row);
    const key = String(normRow[normPrimaryKey] || '').trim();
    if (key) newKeys.add(key);
  }

  for (const row of newRows) {
    const normRow = normalizeRow(row);
    const key = String(normRow[normPrimaryKey] || '').trim();
    
    if (!oldKeys.has(key)) {
      const newIndex = newRows.findIndex(r => {
        const nr = normalizeRow(r);
        return String(nr[normPrimaryKey] || '').trim() === key;
      });
      rowChanges.push({
        rowIndex: newIndex,
        type: 'added',
        newData: row,
      });
    } else {
      const oldMatch = findRowByKey(oldRows, normPrimaryKey, key);
      if (oldMatch) {
        const fieldChanges = compareRows(oldMatch.row, row);
        if (fieldChanges.length > 0) {
          const newIndex = newRows.findIndex(r => {
            const nr = normalizeRow(r);
            return String(nr[normPrimaryKey] || '').trim() === key;
          });
          rowChanges.push({
            rowIndex: newIndex,
            type: 'modified',
            oldData: oldMatch.row,
            newData: row,
          });
          allFieldChanges.push(...fieldChanges);
        }
      }
    }
  }

  for (const row of oldRows) {
    const normRow = normalizeRow(row);
    const key = String(normRow[normPrimaryKey] || '').trim();
    
    if (!newKeys.has(key)) {
      const oldIndex = oldRows.findIndex(r => {
        const nr = normalizeRow(r);
        return String(nr[normPrimaryKey] || '').trim() === key;
      });
      rowChanges.push({
        rowIndex: oldIndex,
        type: 'deleted',
        oldData: row,
      });
    }
  }

  return {
    fieldChanges: allFieldChanges,
    rowChanges,
  };
}

export function compareVersions(
  materialsV1: Material[],
  materialsV2: Material[]
): DiffResult {
  const result: DiffResult = {
    isDuplicate: true,
    changes: [],
  };

  for (const material of materialsV2) {
    const prev = materialsV1.find(m => m.type === material.type);
    if (!prev) {
      result.isDuplicate = false;
      result.changes.push({
        type: 'added',
        materialType: material.type,
      });
      continue;
    }

    if (material.fileHash !== prev.fileHash) {
      result.isDuplicate = false;

      const diff = diffMaterialContent(prev.rawContent, material.rawContent, material.type);
      
      result.changes.push({
        type: 'modified',
        materialType: material.type,
        fieldChanges: diff.fieldChanges,
        rowChanges: diff.rowChanges,
      });
    }
  }

  for (const prev of materialsV1) {
    const curr = materialsV2.find(m => m.type === prev.type);
    if (!curr) {
      result.isDuplicate = false;
      result.changes.push({
        type: 'deleted',
        materialType: prev.type,
      });
    }
  }

  return result;
}

export function generateDiffSummary(changes: ChangeItem[]): string {
  if (changes.length === 0) {
    return '无变化';
  }

  const summaries: string[] = [];
  
  for (const change of changes) {
    const typeLabel = {
      added: '新增',
      modified: '修改',
      deleted: '删除',
    }[change.type];
    
    const materialLabel = {
      holding: '持仓表',
      target: '目标权重表',
      price: '买卖报价表',
    }[change.materialType];

    if (change.type === 'added') {
      summaries.push(`${typeLabel}了${materialLabel}`);
    } else if (change.type === 'deleted') {
      summaries.push(`${typeLabel}了${materialLabel}`);
    } else if (change.rowChanges && change.rowChanges.length > 0) {
      const added = change.rowChanges.filter(r => r.type === 'added').length;
      const modified = change.rowChanges.filter(r => r.type === 'modified').length;
      const deleted = change.rowChanges.filter(r => r.type === 'deleted').length;
      
      const parts: string[] = [];
      if (added > 0) parts.push(`新增${added}行`);
      if (modified > 0) parts.push(`修改${modified}行`);
      if (deleted > 0) parts.push(`删除${deleted}行`);
      
      summaries.push(`${materialLabel}：${parts.join('，')}`);
    }
  }

  return summaries.join('；');
}

export function createMaterial(
  batchId: string,
  type: MaterialType,
  content: string,
  fileName: string,
  source: string,
  uploadedBy: string,
  version: number = 1
): Material {
  return {
    id: `mat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    batchId,
    type,
    source,
    fileName,
    fileHash: generateFileHash(content),
    uploadedBy,
    uploadedAt: new Date(),
    rawContent: content,
    version,
  };
}
