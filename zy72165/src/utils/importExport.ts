import * as XLSX from 'xlsx';
import type { Point, Photo, SchemeVersion, Conflict, PointSource, PointStatus } from '../types';

const SOURCE_MAP: Record<string, PointSource> = {
  street: 'street',
  onsite: 'onsite',
  approval: 'approval',
  other: 'other',
  '街道表格': 'street',
  '街道': 'street',
  '现场巡检': 'onsite',
  '现场': 'onsite',
  '巡检': 'onsite',
  '审批记录': 'approval',
  '审批': 'approval',
};

const STATUS_MAP: Record<string, PointStatus> = {
  pending: 'pending',
  processing: 'processing',
  conflict: 'conflict',
  completed: 'completed',
  '待处理': 'pending',
  '处理中': 'processing',
  '有冲突': 'conflict',
  '已完成': 'completed',
};

export const normalizeSource = (raw: string): PointSource => {
  return SOURCE_MAP[raw.trim()] || 'other';
};

export const normalizeStatus = (raw: string): PointStatus => {
  return STATUS_MAP[raw.trim()] || 'pending';
};

export const sourceToLabel = (source: PointSource): string => {
  const labels: Record<PointSource, string> = {
    street: '街道表格',
    onsite: '现场巡检',
    approval: '审批记录',
    other: '其他来源',
  };
  return labels[source];
};

export const statusToLabel = (status: PointStatus): string => {
  const labels: Record<PointStatus, string> = {
    pending: '待处理',
    processing: '处理中',
    conflict: '有冲突',
    completed: '已完成',
  };
  return labels[status];
};

export interface ImportPointData {
  name: string;
  location: string;
  hospital: string;
  source: PointSource;
  sourceDesc?: string;
  rawNote: string;
  status: PointStatus;
  createdBy: string;
}

export const parseExcelFile = (file: File): Promise<ImportPointData[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet) as Record<string, unknown>[];
        
        const points: ImportPointData[] = jsonData.map((row) => {
          const rawSource = String(row['来源'] || row['source'] || 'other');
          const rawStatus = String(row['状态'] || row['status'] || 'pending');
          const sourceDesc = row['来源说明'] ? String(row['来源说明']) : undefined;
          return {
            name: String(row['点位名称'] || row['name'] || ''),
            location: String(row['位置'] || row['location'] || ''),
            hospital: String(row['所属医院'] || row['hospital'] || ''),
            source: normalizeSource(rawSource),
            sourceDesc: sourceDesc || (rawSource !== normalizeSource(rawSource) ? `原始来源: ${rawSource}` : undefined),
            rawNote: String(row['原始备注'] || row['备注'] || row['rawNote'] || ''),
            status: normalizeStatus(rawStatus),
            createdBy: String(row['创建人'] || row['createdBy'] || '老曹'),
          };
        });
        
        resolve(points);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
};

export const exportToExcel = (
  points: Point[],
  photos: Photo[],
  schemes: SchemeVersion[],
  conflicts: Conflict[],
  filename: string = '医院周边停车诱导报告'
) => {
  const wb = XLSX.utils.book_new();
  
  const pointsData = points.map((p) => ({
    ID: p.id,
    点位名称: p.name,
    位置: p.location,
    所属医院: p.hospital,
    来源: sourceToLabel(p.source),
    来源说明: p.sourceDesc || '',
    原始备注: p.rawNote,
    状态: statusToLabel(p.status),
    创建时间: new Date(p.createdAt).toLocaleString('zh-CN'),
    更新时间: new Date(p.updatedAt).toLocaleString('zh-CN'),
    创建人: p.createdBy,
  }));
  const pointsSheet = XLSX.utils.json_to_sheet(pointsData);
  XLSX.utils.book_append_sheet(wb, pointsSheet, '点位');
  
  const photosData = photos.map((p) => ({
    ID: p.id,
    点位ID: p.pointId,
    文件名: p.fileName,
    原始备注: p.rawRemark,
    来源: p.source,
    拍摄时间: p.takenAt ? new Date(p.takenAt).toLocaleString('zh-CN') : '',
    上传时间: new Date(p.uploadedAt).toLocaleString('zh-CN'),
  }));
  const photosSheet = XLSX.utils.json_to_sheet(photosData);
  XLSX.utils.book_append_sheet(wb, photosSheet, '照片记录');
  
  const schemesData = schemes.map((s) => ({
    ID: s.id,
    点位ID: s.pointId,
    版本: s.version,
    方案内容: s.content,
    历史意见: s.opinion,
    状态: s.status,
    创建时间: new Date(s.createdAt).toLocaleString('zh-CN'),
    创建人: s.createdBy,
    审批记录: s.approvalRecord || '',
  }));
  const schemesSheet = XLSX.utils.json_to_sheet(schemesData);
  XLSX.utils.book_append_sheet(wb, schemesSheet, '方案版本');
  
  const conflictsData = conflicts.map((c) => ({
    ID: c.id,
    点位ID: c.pointId,
    冲突类型: c.type,
    照片证据: c.photoEvidence,
    数据证据: c.dataEvidence,
    建议动作: c.suggestedAction,
    是否已解决: c.resolved ? '是' : '否',
    解决说明: c.resolution || '',
    创建时间: new Date(c.createdAt).toLocaleString('zh-CN'),
  }));
  const conflictsSheet = XLSX.utils.json_to_sheet(conflictsData);
  XLSX.utils.book_append_sheet(wb, conflictsSheet, '冲突记录');
  
  XLSX.writeFile(wb, `${filename}_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')}.xlsx`);
};

export const exportToJSON = (
  points: Point[],
  photos: Photo[],
  schemes: SchemeVersion[],
  conflicts: Conflict[],
  filename: string = '医院周边停车诱导数据'
) => {
  const data = {
    exportTime: new Date().toISOString(),
    points,
    photos: photos.map((p) => ({ ...p, dataUrl: '[PHOTO_DATA]' })),
    schemes,
    conflicts,
  };
  
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const readFileAsDataURL = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};
