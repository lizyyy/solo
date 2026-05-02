import Papa from 'papaparse';
import { BoreholeRaw, LayerRaw, Borehole, Layer } from '../types';

export function parseCsv(content: string): { boreholes: BoreholeRaw[]; layers: LayerRaw[] } {
  const result = Papa.parse(content, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header: string) => header.trim(),
    transform: (value: string) => value.trim(),
  });

  const rows = result.data as Record<string, string>[];
  
  const boreholeMap = new Map<string, BoreholeRaw>();
  const layerMap = new Map<string, LayerRaw[]>();

  rows.forEach((row, index) => {
    const boreholeId = getStringValue(row, ['钻孔编号', 'boreholeId', 'id', '钻孔ID']);
    if (!boreholeId) {
      console.warn(`行 ${index + 1}: 缺少钻孔编号`);
      return;
    }

    if (!boreholeMap.has(boreholeId)) {
      const borehole: BoreholeRaw = {
        boreholeId,
        x: getNumberValue(row, ['X坐标', 'x', 'X', '横坐标']) || 0,
        y: getNumberValue(row, ['Y坐标', 'y', 'Y', '纵坐标']) || 0,
        groundElevation: getNumberValue(row, ['地面标高', 'groundElevation', '标高', '高程']) || 0,
        waterLevel: getNumberValue(row, ['地下水位', 'waterLevel', '水位']),
      };
      boreholeMap.set(boreholeId, borehole);
      layerMap.set(boreholeId, []);
    }

    const layerIndex = getNumberValue(row, ['层号', 'layerIndex', 'index', '分层序号']) ?? 0;
    
    const layer: LayerRaw = {
      boreholeId,
      layerIndex,
      topDepth: getNumberValue(row, ['层顶深度', 'topDepth', '起始深度', 'top']) || 0,
      bottomDepth: getNumberValue(row, ['层底深度', 'bottomDepth', '终止深度', 'bottom']) || 0,
      soilType: getStringValue(row, ['土类', 'soilType', '岩土名称', '岩性']) || '未知',
      soilCode: getStringValue(row, ['土类代码', 'soilCode', '代码']),
      description: getStringValue(row, ['描述', 'description', '特征描述', '岩土特征']),
      hasSample: getBooleanValue(row, ['是否采样', 'hasSample', '采样']),
      sampleId: getStringValue(row, ['样品编号', 'sampleId', '样品ID']),
      isContaminated: getBooleanValue(row, ['是否污染', 'isContaminated', '污染']),
      contaminantType: getStringValue(row, ['污染物类型', 'contaminantType', '污染类型']),
      contaminantLevel: getNumberValue(row, ['污染浓度', 'contaminantLevel', '浓度值']),
    };

    layerMap.get(boreholeId)!.push(layer);
  });

  const boreholes = Array.from(boreholeMap.values());
  const allLayers: LayerRaw[] = [];
  
  layerMap.forEach((layers) => {
    layers.sort((a, b) => a.layerIndex - b.layerIndex);
    allLayers.push(...layers);
  });

  return { boreholes, layers: allLayers };
}

export function buildBoreholes(rawBoreholes: BoreholeRaw[], rawLayers: LayerRaw[]): Borehole[] {
  const layerByBorehole = new Map<string, LayerRaw[]>();
  
  rawLayers.forEach(layer => {
    if (!layerByBorehole.has(layer.boreholeId)) {
      layerByBorehole.set(layer.boreholeId, []);
    }
    layerByBorehole.get(layer.boreholeId)!.push(layer);
  });

  return rawBoreholes.map(raw => {
    const layers = (layerByBorehole.get(raw.boreholeId) || [])
      .sort((a, b) => a.layerIndex - b.layerIndex)
      .map((l, idx) => convertLayer(l, idx));

    const totalDepth = layers.length > 0 
      ? Math.max(...layers.map(l => l.bottomDepth))
      : 0;

    return {
      id: raw.boreholeId,
      x: raw.x,
      y: raw.y,
      groundElevation: raw.groundElevation,
      waterLevel: raw.waterLevel,
      layers,
      totalDepth,
    };
  });
}

function convertLayer(raw: LayerRaw, index: number): Layer {
  return {
    id: `${raw.boreholeId}_L${raw.layerIndex}`,
    boreholeId: raw.boreholeId,
    layerIndex: raw.layerIndex ?? index,
    topDepth: raw.topDepth,
    bottomDepth: raw.bottomDepth,
    thickness: Math.max(0, raw.bottomDepth - raw.topDepth),
    soilType: raw.soilType,
    soilCode: raw.soilCode || '',
    description: raw.description || '',
    hasSample: raw.hasSample ?? false,
    sampleId: raw.sampleId,
    isContaminated: raw.isContaminated ?? false,
    contaminantType: raw.contaminantType,
    contaminantLevel: raw.contaminantLevel,
  };
}

function getStringValue(row: Record<string, string>, keys: string[]): string {
  for (const key of keys) {
    const value = row[key] || row[key.toLowerCase()] || row[key.toUpperCase()];
    if (value !== undefined && value !== null && value !== '') {
      return value;
    }
  }
  return '';
}

function getNumberValue(row: Record<string, string>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = row[key] || row[key.toLowerCase()] || row[key.toUpperCase()];
    if (value !== undefined && value !== null && value !== '') {
      const num = parseFloat(value);
      if (!isNaN(num)) {
        return num;
      }
    }
  }
  return undefined;
}

function getBooleanValue(row: Record<string, string>, keys: string[]): boolean | undefined {
  for (const key of keys) {
    const value = row[key] || row[key.toLowerCase()] || row[key.toUpperCase()];
    if (value !== undefined && value !== null && value !== '') {
      const lower = value.toLowerCase();
      if (['是', 'yes', 'true', '1', '有'].includes(lower)) return true;
      if (['否', 'no', 'false', '0', '无'].includes(lower)) return false;
    }
  }
  return undefined;
}
