import type { Drone, ImportPreviewItem, SourceType, StatusType, Position3D } from '@/types';

const SOURCE_TYPE_MAP: Record<string, SourceType> = {
  gis: 'GIS',
  tablet: 'TABLET',
  excel: 'EXCEL',
  screenshot: 'SCREENSHOT',
};

const STATUS_MAP: Record<string, StatusType> = {
  normal: 'NORMAL',
  正常: 'NORMAL',
  warning: 'WARNING',
  预警: 'WARNING',
  confirm: 'CONFIRM',
  待确认: 'CONFIRM',
  待人工确认: 'CONFIRM',
  history: 'HISTORY',
  历史: 'HISTORY',
  历史口径: 'HISTORY',
  error: 'ERROR',
  错误: 'ERROR',
};

const generateId = () => `UAV-${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;

const isEmptyValue = (value: string | number | undefined | null): boolean => {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string' && value.trim() === '') return true;
  if (typeof value === 'number' && isNaN(value)) return true;
  return false;
};

const isBoundaryPosition = (pos: Position3D): boolean => {
  const boundary = 100;
  return Math.abs(pos.x) > boundary || Math.abs(pos.y) > boundary || Math.abs(pos.z) > boundary;
};

const parseNumber = (value: string): number | null => {
  if (isEmptyValue(value)) return null;
  const num = parseFloat(value);
  return isNaN(num) ? null : num;
};

const parseSourceType = (value: string): SourceType => {
  const key = value.toLowerCase().trim();
  return SOURCE_TYPE_MAP[key] || 'EXCEL';
};

const parseStatus = (value: string, obstacleDistance: number): StatusType => {
  if (value) {
    const key = value.toLowerCase().trim();
    if (STATUS_MAP[key]) return STATUS_MAP[key];
  }
  if (obstacleDistance < 0) return 'ERROR';
  if (obstacleDistance < 3) return 'WARNING';
  return 'NORMAL';
};

export const parseCSV = (csvText: string): ImportPreviewItem[] => {
  const lines = csvText.split('\n').filter((line) => line.trim());
  if (lines.length === 0) return [];

  const headerLine = lines[0];
  const dataLines = lines.slice(1);

  const headers = headerLine.split(',').map((h) => h.trim().toLowerCase());
  const idIdx = headers.findIndex((h) => h.includes('id') || h.includes('编号'));
  const nameIdx = headers.findIndex((h) => h.includes('name') || h.includes('名称'));
  const xIdx = headers.findIndex((h) => h === 'x' || h.includes('x坐标'));
  const yIdx = headers.findIndex((h) => h === 'y' || h.includes('y坐标'));
  const zIdx = headers.findIndex((h) => h === 'z' || h.includes('z坐标'));
  const statusIdx = headers.findIndex((h) => h.includes('status') || h.includes('状态'));
  const sourceTypeIdx = headers.findIndex((h) => h.includes('source') || h.includes('来源'));
  const sourceRefIdx = headers.findIndex((h) => h.includes('ref') || h.includes('引用') || h.includes('行号'));
  const distanceIdx = headers.findIndex((h) => h.includes('distance') || h.includes('距离'));
  const noteIdx = headers.findIndex((h) => h.includes('note') || h.includes('备注'));

  const existingIds = new Set<string>();
  const previewItems: ImportPreviewItem[] = [];

  for (const line of dataLines) {
    const values = line.split(',').map((v) => v.trim());
    const issues: string[] = [];
    let isEmpty = false;
    let isDuplicate = false;
    let isBoundary = false;

    let id = idIdx >= 0 ? values[idIdx] : '';
    if (!id) {
      id = generateId();
      issues.push('缺少ID，已自动生成');
    }

    if (existingIds.has(id)) {
      isDuplicate = true;
      issues.push(`ID [${id}] 重复`);
    }
    existingIds.add(id);

    const name = nameIdx >= 0 ? values[nameIdx] : `无人机-${id}`;

    const x = xIdx >= 0 ? parseNumber(values[xIdx]) : null;
    const y = yIdx >= 0 ? parseNumber(values[yIdx]) : null;
    const z = zIdx >= 0 ? parseNumber(values[zIdx]) : null;

    const position: Position3D = { x: x ?? 0, y: y ?? 0, z: z ?? 0 };

    if (x === null || y === null || z === null) {
      isEmpty = true;
      issues.push('坐标信息不完整');
    }

    if (!isEmpty && isBoundaryPosition(position)) {
      isBoundary = true;
      issues.push('坐标超出正常范围(±100)');
    }

    const obstacleDistance = distanceIdx >= 0 ? parseNumber(values[distanceIdx]) ?? -1 : -1;
    if (obstacleDistance < 0 && !isEmpty) {
      issues.push('避障距离无效');
    }

    const sourceTypeValue = sourceTypeIdx >= 0 ? values[sourceTypeIdx] : 'EXCEL';
    const sourceType = parseSourceType(sourceTypeValue);
    const sourceRef = sourceRefIdx >= 0 ? values[sourceRefIdx] : `导入行: ${dataLines.indexOf(line) + 2}`;
    const sourceName = `导入文件_${new Date().toLocaleDateString()}`;

    const statusValue = statusIdx >= 0 ? values[statusIdx] : '';
    let status = parseStatus(statusValue, obstacleDistance);

    if (isEmpty) status = 'ERROR';
    if (isDuplicate) status = 'DUPLICATE';
    if (isBoundary) status = 'BOUNDARY';

    const currentNote = noteIdx >= 0 ? values[noteIdx] : '';

    const drone: Drone = {
      id,
      name,
      position,
      status,
      obstacleDistance,
      source: {
        type: sourceType,
        name: sourceName,
        reference: sourceRef,
        rawData: line,
      },
      currentNote,
      historyNotes: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isDuplicate,
      isBoundary,
    };

    previewItems.push({ drone, issues, isEmpty, isDuplicate, isBoundary });
  }

  return previewItems;
};

export const parseJSON = (jsonText: string): ImportPreviewItem[] => {
  try {
    const data = JSON.parse(jsonText);
    const drones = Array.isArray(data) ? data : data.drones || [];

    const existingIds = new Set<string>();
    const previewItems: ImportPreviewItem[] = [];

    for (const item of drones) {
      const issues: string[] = [];
      let isEmpty = false;
      let isDuplicate = false;
      let isBoundary = false;

      let id = item.id || generateId();
      if (!item.id) issues.push('缺少ID，已自动生成');

      if (existingIds.has(id)) {
        isDuplicate = true;
        issues.push(`ID [${id}] 重复`);
      }
      existingIds.add(id);

      const position: Position3D = {
        x: item.position?.x ?? 0,
        y: item.position?.y ?? 0,
        z: item.position?.z ?? 0,
      };

      if (
        item.position?.x === undefined ||
        item.position?.y === undefined ||
        item.position?.z === undefined
      ) {
        isEmpty = true;
        issues.push('坐标信息不完整');
      }

      if (!isEmpty && isBoundaryPosition(position)) {
        isBoundary = true;
        issues.push('坐标超出正常范围(±100)');
      }

      const obstacleDistance = item.obstacleDistance ?? -1;
      const sourceType = item.source?.type || 'EXCEL';
      const sourceName = item.source?.name || 'JSON导入';
      const sourceRef = item.source?.reference || 'JSON导入';

      let status = item.status || parseStatus('', obstacleDistance);
      if (isEmpty) status = 'ERROR';
      if (isDuplicate) status = 'DUPLICATE';
      if (isBoundary) status = 'BOUNDARY';

      const drone: Drone = {
        id,
        name: item.name || `无人机-${id}`,
        position,
        status,
        obstacleDistance,
        source: {
          type: sourceType,
          name: sourceName,
          reference: sourceRef,
          rawData: JSON.stringify(item, null, 2),
        },
        currentNote: item.currentNote || '',
        historyNotes: item.historyNotes || [],
        createdAt: item.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isDuplicate,
        isBoundary,
      };

      previewItems.push({ drone, issues, isEmpty, isDuplicate, isBoundary });
    }

    return previewItems;
  } catch (e) {
    console.error('JSON解析失败:', e);
    return [];
  }
};

export const readFileAsText = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsText(file);
  });
};
