import type { Device, CadPoint, DeviceType, CoordSystem, DataSource } from '@/types';

export interface ImportResult {
  devices: Device[];
  cadPoints: CadPoint[];
  warnings: string[];
}

export function parseJsonImport(content: string): ImportResult {
  const warnings: string[] = [];
  const result: ImportResult = {
    devices: [],
    cadPoints: [],
    warnings,
  };

  try {
    const data = JSON.parse(content);

    if (data.devices && Array.isArray(data.devices)) {
      result.devices = data.devices.map((d: any, idx: number) => validateDevice(d, idx, warnings));
    }

    if (data.cadPoints && Array.isArray(data.cadPoints)) {
      result.cadPoints = data.cadPoints.map((c: any, idx: number) => validateCadPoint(c, idx, warnings));
    }

    if (result.devices.length === 0 && result.cadPoints.length === 0) {
      warnings.push('JSON文件中未找到 devices 或 cadPoints 数组');
    }
  } catch (e) {
    warnings.push(`JSON解析失败: ${e instanceof Error ? e.message : '未知错误'}`);
  }

  return result;
}

export function parseCsvImport(content: string): ImportResult {
  const warnings: string[] = [];
  const result: ImportResult = {
    devices: [],
    cadPoints: [],
    warnings,
  };

  const lines = content.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) {
    warnings.push('CSV文件为空或格式不正确');
    return result;
  }

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const isDeviceCsv = headers.some(h => h.includes('photo') || h.includes('照片')) || 
                      headers.some(h => h.includes('source') || h.includes('来源'));

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    
    if (isDeviceCsv) {
      const device = parseCsvDevice(headers, values, i, warnings);
      if (device) result.devices.push(device);
    } else {
      const cad = parseCsvCadPoint(headers, values, i, warnings);
      if (cad) result.cadPoints.push(cad);
    }
  }

  if (result.devices.length === 0 && result.cadPoints.length === 0) {
    warnings.push('CSV文件中未解析到有效数据');
  }

  return result;
}

function parseCsvDevice(headers: string[], values: string[], rowIdx: number, warnings: string[]): Device | null {
  const getVal = (keywords: string[]) => {
    const idx = headers.findIndex(h => keywords.some(k => h.includes(k)));
    return idx >= 0 ? values[idx] : '';
  };

  const name = getVal(['name', '名称', '设备名']);
  if (!name) {
    warnings.push(`第${rowIdx + 1}行缺少设备名称，已跳过`);
    return null;
  }

  const now = new Date().toISOString();
  const x = parseFloat(getVal(['x', '横坐标'])) || 0;
  const y = parseFloat(getVal(['y', '纵坐标'])) || 0;

  return {
    id: `imported-dev-${Date.now()}-${rowIdx}`,
    name,
    alias: getVal(['alias', '别名']),
    type: (getVal(['type', '类型']) as DeviceType) || 'sensor',
    floor: getVal(['floor', '楼层']) || 'B1',
    x,
    y,
    coordSystem: (getVal(['coord', '坐标系', 'crs']) as CoordSystem) || 'A',
    hasPhoto: getVal(['photo', '照片', 'hasphoto']).toLowerCase() !== 'false' && 
              getVal(['photo', '照片', 'hasphoto']).toLowerCase() !== '0',
    source: (getVal(['source', '来源']) as DataSource) || 'field',
    importTime: now,
    status: 'pending',
  };
}

function parseCsvCadPoint(headers: string[], values: string[], rowIdx: number, warnings: string[]): CadPoint | null {
  const getVal = (keywords: string[]) => {
    const idx = headers.findIndex(h => keywords.some(k => h.includes(k)));
    return idx >= 0 ? values[idx] : '';
  };

  const hasName = getVal(['name', '名称', 'newname', 'oldname']);
  if (!hasName) {
    warnings.push(`第${rowIdx + 1}行缺少点位名称，已跳过`);
    return null;
  }

  const now = new Date().toISOString();
  const x = parseFloat(getVal(['x', '横坐标'])) || 0;
  const y = parseFloat(getVal(['y', '纵坐标'])) || 0;

  return {
    id: `imported-cad-${Date.now()}-${rowIdx}`,
    oldName: getVal(['oldname', '旧名称', '旧口径']),
    newName: getVal(['newname', '新名称', '新口径']) || getVal(['name', '名称']),
    layer: getVal(['layer', '图层']) || '未分类',
    floor: getVal(['floor', '楼层']) || 'B1',
    x,
    y,
    coordSystem: (getVal(['coord', '坐标系', 'crs']) as CoordSystem) || 'A',
    exportTime: now,
  };
}

function validateDevice(d: any, idx: number, warnings: string[]): Device {
  const now = new Date().toISOString();
  
  if (!d.name) {
    warnings.push(`设备[${idx}]缺少name字段，已使用默认名称`);
  }

  return {
    id: d.id || `imported-dev-${Date.now()}-${idx}`,
    name: d.name || `未命名设备-${idx + 1}`,
    alias: d.alias,
    type: (d.type as DeviceType) || 'sensor',
    floor: d.floor || 'B1',
    x: typeof d.x === 'number' ? d.x : 0,
    y: typeof d.y === 'number' ? d.y : 0,
    coordSystem: (d.coordSystem as CoordSystem) || 'A',
    hasPhoto: d.hasPhoto !== false,
    photoUrl: d.photoUrl,
    source: (d.source as DataSource) || 'field',
    importTime: d.importTime || now,
    status: d.status || 'pending',
    matchedCadId: d.matchedCadId,
  };
}

function validateCadPoint(c: any, idx: number, warnings: string[]): CadPoint {
  const now = new Date().toISOString();

  if (!c.newName && !c.oldName && !c.name) {
    warnings.push(`CAD点位[${idx}]缺少名称字段，已使用默认名称`);
  }

  return {
    id: c.id || `imported-cad-${Date.now()}-${idx}`,
    oldName: c.oldName,
    newName: c.newName || c.name,
    layer: c.layer || '未分类',
    floor: c.floor || 'B1',
    x: typeof c.x === 'number' ? c.x : 0,
    y: typeof c.y === 'number' ? c.y : 0,
    coordSystem: (c.coordSystem as CoordSystem) || 'A',
    exportTime: c.exportTime || now,
  };
}

export function generateSampleExportJson(): string {
  return JSON.stringify({
    _comment: '地下停车诱导模型 - 数据导入模板',
    devices: [
      {
        id: 'dev-sample-001',
        name: '示例摄像头-B1-01',
        type: 'camera',
        floor: 'B1',
        x: 100,
        y: 150,
        coordSystem: 'A',
        hasPhoto: true,
        source: 'field',
        matchedCadId: 'cad-sample-001',
      },
    ],
    cadPoints: [
      {
        id: 'cad-sample-001',
        oldName: 'CAM_OLD_001',
        newName: '示例摄像头-B1-01',
        layer: '设备层-摄像头',
        floor: 'B1',
        x: 100,
        y: 150,
        coordSystem: 'A',
      },
    ],
  }, null, 2);
}
