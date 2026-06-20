import { v4 as uuidv4 } from 'uuid';
import {
  createMaterial,
  getMaterialByCode,
  updateMaterial,
  addHistory,
  getAllMaterialsForExport,
  getHistoryByMaterialId,
} from './materialService';
import type { Material, MaterialStatus, CsvImportResult } from '../../shared/types';
import { STATUS_LABELS } from '../../shared/types';

const STATUS_MAP: Record<string, MaterialStatus> = {
  '待确认': 'pending',
  '正常': 'normal',
  '已改判': 'rejudged',
  '变更中': 'changing',
  '已归档': 'archived',
  pending: 'pending',
  normal: 'normal',
  rejudged: 'rejudged',
  changing: 'changing',
  archived: 'archived',
};

const HEADER_MAP: Record<string, keyof Material> = {
  '材料编号': 'materialCode',
  '材料名称': 'materialName',
  '规格型号': 'specification',
  '数量': 'quantity',
  '单位': 'unit',
  '项目名称': 'projectName',
  'CAD图层号': 'layerCode',
  '图层号': 'layerCode',
  '图纸位置': 'position',
  '当前状态': 'status',
  '状态': 'status',
  '碰撞点说明': 'collisionPoint',
  '碰撞点': 'collisionPoint',
  'CAD图层备注': 'cadNote',
  'CAD改变的判断': 'cadJudgmentChange',
  '变更单号': 'changeOrderNo',
  '变更确认理由': 'changeOrderReason',
  '变更影响范围': 'changeOrderImpact',
  '人工备注': 'manualNote',
  materialCode: 'materialCode',
  materialName: 'materialName',
  specification: 'specification',
  quantity: 'quantity',
  unit: 'unit',
  projectName: 'projectName',
  layerCode: 'layerCode',
  position: 'position',
  status: 'status',
  collisionPoint: 'collisionPoint',
  cadNote: 'cadNote',
  cadJudgmentChange: 'cadJudgmentChange',
  changeOrderNo: 'changeOrderNo',
  changeOrderReason: 'changeOrderReason',
  changeOrderImpact: 'changeOrderImpact',
  manualNote: 'manualNote',
};

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result.map(s => s.trim());
}

export function parseCSV(content: string): Array<Record<string, string>> {
  const lines = content.replace(/\r\n/g, '\n').split('\n').filter(l => l.trim().length > 0);
  if (lines.length === 0) return [];
  const headers = parseCSVLine(lines[0]);
  const rows: Array<Record<string, string>> = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCSVLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = (cells[idx] ?? '').trim();
    });
    rows.push(row);
  }
  return rows;
}

function rowToMaterialRow(row: Record<string, string>): Partial<Material> & { materialCode?: string; materialName?: string } {
  const result: any = {};
  for (const [header, value] of Object.entries(row)) {
    const key = HEADER_MAP[header];
    if (key && value) {
      if (key === 'status') {
        result[key] = STATUS_MAP[value] || value;
      } else if (key === 'quantity') {
        result[key] = parseFloat(value) || 0;
      } else {
        result[key] = value;
      }
    }
  }
  return result;
}

export function importCSV(content: string, operator = '阿宁'): CsvImportResult {
  const batchNo = 'BATCH-' + Date.now().toString(36).toUpperCase();
  const rows = parseCSV(content);
  const result: CsvImportResult = {
    totalRows: rows.length,
    newCount: 0,
    updatedCount: 0,
    skippedCount: 0,
    duplicates: [],
    batchNo,
  };

  rows.forEach((row, idx) => {
    const rowNum = idx + 2;
    const parsed = rowToMaterialRow(row);
    const code = parsed.materialCode?.trim();
    if (!code) {
      result.skippedCount++;
      result.duplicates.push({ row: rowNum, materialCode: '', reason: '材料编号为空，跳过', hasManualNote: false });
      return;
    }
    if (!parsed.materialName) {
      result.skippedCount++;
      result.duplicates.push({ row: rowNum, materialCode: code, reason: '材料名称为空，跳过', hasManualNote: false });
      return;
    }

    const existing = getMaterialByCode(code);
    if (!existing) {
      createMaterial({ ...parsed, materialCode: code, importBatchNo: batchNo } as any, operator);
      result.newCount++;
    } else {
      const hasManualNote = !!existing.manualNote;
      const hasCadNote = !!existing.cadNote;
      const hasChangeOrder = !!existing.changeOrderNo;
      const updates: Partial<Material> = { importBatchNo: batchNo };
      const protectedReasons: string[] = [];

      const editableKeys: Array<keyof Material> = [
        'materialName', 'specification', 'quantity', 'unit', 'projectName',
        'layerCode', 'position', 'collisionPoint',
      ];
      for (const k of editableKeys) {
        if ((parsed as any)[k] !== undefined && (parsed as any)[k] !== '') {
          (updates as any)[k] = (parsed as any)[k];
        }
      }

      if ((parsed as any).status !== undefined && (parsed as any).status !== '') {
        if (existing.status === 'pending') {
          updates.status = (parsed as any).status;
        } else {
          protectedReasons.push(`状态${STATUS_LABELS[existing.status]}不回退`);
        }
      }

      if ((parsed as any).manualNote !== undefined && (parsed as any).manualNote !== '') {
        if (!hasManualNote) {
          updates.manualNote = (parsed as any).manualNote;
        } else {
          protectedReasons.push('人工备注已保留');
        }
      }

      if ((parsed as any).cadNote !== undefined && (parsed as any).cadNote !== '') {
        if (!hasCadNote) {
          updates.cadNote = (parsed as any).cadNote;
        } else {
          protectedReasons.push('CAD备注已保留');
        }
      }
      if ((parsed as any).cadJudgmentChange !== undefined && (parsed as any).cadJudgmentChange !== '') {
        if (!existing.cadJudgmentChange) {
          updates.cadJudgmentChange = (parsed as any).cadJudgmentChange;
        }
      }

      if ((parsed as any).changeOrderNo !== undefined && (parsed as any).changeOrderNo !== '') {
        if (!hasChangeOrder) {
          updates.changeOrderNo = (parsed as any).changeOrderNo;
        } else {
          protectedReasons.push(`变更单${existing.changeOrderNo}已保留`);
        }
      }
      if ((parsed as any).changeOrderReason !== undefined && (parsed as any).changeOrderReason !== '') {
        if (!existing.changeOrderReason) {
          updates.changeOrderReason = (parsed as any).changeOrderReason;
        }
      }
      if ((parsed as any).changeOrderImpact !== undefined && (parsed as any).changeOrderImpact !== '') {
        if (!existing.changeOrderImpact) {
          updates.changeOrderImpact = (parsed as any).changeOrderImpact;
        }
      }

      const allProtected = protectedReasons.length > 0;
      updateMaterial(existing.id, updates, operator, 'csv_update',
        `重复导入更新（批次${batchNo}）${allProtected ? '，' + protectedReasons.join('、') : ''}`);
      result.updatedCount++;
      result.duplicates.push({
        row: rowNum,
        materialCode: code,
        reason: allProtected
          ? `材料编号已存在，基础字段已更新，${protectedReasons.join('、')}不覆盖`
          : '材料编号已存在，字段已按最新值更新',
        hasManualNote,
      });
    }
  });

  return result;
}

function escapeCsvField(v: any): string {
  const s = v === null || v === undefined ? '' : String(v);
  if (/[",\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

interface ChangeNoteInfo {
  hasChange: boolean;
  description: string;
}

function computeChangeNote(material: Material): ChangeNoteInfo {
  const history = getHistoryByMaterialId(material.id);
  const notes: string[] = [];
  if (material.cadJudgmentChange) notes.push(`CAD改变判断：${material.cadJudgmentChange}`);
  if (material.status === 'rejudged') {
    const rejudge = history.find(h => h.action === 'rejudge');
    if (rejudge?.remark) notes.push(`改判：${rejudge.remark}`);
  }
  if (material.changeOrderNo) notes.push(`变更单${material.changeOrderNo}晚到补录，影响范围：${material.changeOrderImpact || '未填写'}`);
  if (history.filter(h => h.action === 'csv_update').length > 0) {
    const count = history.filter(h => h.action === 'csv_update').length;
    notes.push(`CSV重复导入更新${count}次`);
  }
  return {
    hasChange: notes.length > 0,
    description: notes.join('；'),
  };
}

export function exportCSV(): string {
  const materials = getAllMaterialsForExport();
  const headers = [
    '材料编号', '材料名称', '规格型号', '数量', '单位', '项目名称', 'CAD图层号',
    '图纸位置', '当前状态', '碰撞点说明', 'CAD图层备注', 'CAD改变的判断',
    '变更单号', '变更确认理由', '变更影响范围', '人工备注', '变化说明',
  ];
  const lines: string[] = [headers.map(escapeCsvField).join(',')];
  for (const m of materials) {
    const changeInfo = computeChangeNote(m);
    const row = [
      m.materialCode,
      m.materialName,
      m.specification,
      m.quantity,
      m.unit,
      m.projectName,
      m.layerCode,
      m.position,
      STATUS_LABELS[m.status],
      m.collisionPoint,
      m.cadNote,
      m.cadJudgmentChange,
      m.changeOrderNo,
      m.changeOrderReason,
      m.changeOrderImpact,
      m.manualNote,
      changeInfo.description,
    ];
    lines.push(row.map(escapeCsvField).join(','));
  }
  return lines.join('\r\n') + '\r\n';
}

export function sampleCSV(): string {
  const headers = [
    '材料编号', '材料名称', '规格型号', '数量', '单位', '项目名称', 'CAD图层号',
    '图纸位置', '当前状态', '碰撞点说明', 'CAD图层备注', 'CAD改变的判断',
    '变更单号', '变更确认理由', '变更影响范围', '人工备注',
  ];
  const sample = [
    headers,
    ['JG-2024-004', '碳纤维板200级', '1.4mm×50mm', 60, 'm', '滨江大厦结构加固', 'LAYER-CFRP-02', '2层顶板B2-10区', '待确认', '顶板与暖通管道冲突', '', '', '', '', '', '边界样本：顶板区域'],
    ['JG-2024-001', '碳纤维布I级300g', '300g/m², 宽100mm', 150, 'm²', '滨江大厦结构加固', 'LAYER-CFRP-01', '3层梁底B3-05', '正常', '', '', '', '', '', '', ''],
  ];
  return sample.map(r => r.map(escapeCsvField).join(',')).join('\r\n') + '\r\n';
}
