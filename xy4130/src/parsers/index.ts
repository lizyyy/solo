import Papa from 'papaparse';
import type {
  StageProject,
  StageDimensions,
  Rig,
  LightType,
  LightFixture,
  Actor,
  ActorTimeline,
  RigTimeline,
  LightTimeline,
  RestrictedZone,
  Scene,
  Vector3,
} from '@/types';
import { generateUUID } from '@/utils/math';

export function parseJSON(data: string): Partial<StageProject> {
  try {
    return JSON.parse(data);
  } catch (e) {
    throw new Error(`JSON解析失败: ${(e as Error).message}`);
  }
}

export function parseCSV<T>(data: string): T[] {
  const result = Papa.parse<T>(data, {
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true,
  });

  if (result.errors.length > 0) {
    throw new Error(`CSV解析错误: ${result.errors[0].message}`);
  }

  return result.data;
}

export function parseStageDimensions(rows: Record<string, unknown>[]): StageDimensions {
  if (rows.length === 0) {
    throw new Error('舞台尺寸数据为空');
  }

  const row = rows[0];
  return {
    width: Number(row.width) || 16,
    depth: Number(row.depth) || 12,
    height: Number(row.height) || 10,
    prosceniumWidth: Number(row.prosceniumWidth) || 12,
    prosceniumHeight: Number(row.prosceniumHeight) || 8,
    stageType: (row.stageType as StageDimensions['stageType']) || 'proscenium',
  };
}

export function parseRigs(rows: Record<string, unknown>[]): Rig[] {
  return rows.map((row) => ({
    id: String(row.id || generateUUID()),
    name: String(row.name || '未命名吊杆'),
    type: (row.type as Rig['type']) || 'batten',
    position: {
      x: Number(row.posX || 0),
      y: Number(row.posY || 0),
      z: Number(row.posZ || 0),
    },
    length: Number(row.length) || 12,
    width: Number(row.width) || 0.1,
    currentHeight: Number(row.currentHeight) || 8,
    targetHeight: row.targetHeight ? Number(row.targetHeight) : undefined,
    weight: Number(row.weight) || 50,
    maxLoad: Number(row.maxLoad) || 200,
    motorized: Boolean(row.motorized ?? true),
  }));
}

export function parseLightTypes(rows: Record<string, unknown>[]): LightType[] {
  return rows.map((row) => ({
    id: String(row.id || generateUUID()),
    name: String(row.name || '未命名灯具类型'),
    wattage: Number(row.wattage) || 1000,
    intensity: Number(row.intensity) || 10000,
    beamAngle: Number(row.beamAngle) || 25,
    fieldAngle: Number(row.fieldAngle) || 35,
    colorTemperature: Number(row.colorTemperature) || 5600,
    dmxChannels: Number(row.dmxChannels) || 16,
  }));
}

export function parseLightFixtures(
  rows: Record<string, unknown>[],
  lightTypes: LightType[]
): LightFixture[] {
  return rows.map((row) => {
    const typeId = String(row.typeId || '');
    const type = lightTypes.find((t) => t.id === typeId) || lightTypes[0];

    if (!type) {
      throw new Error(`未找到灯具类型: ${typeId}`);
    }

    return {
      id: String(row.id || generateUUID()),
      name: String(row.name || '未命名灯具'),
      type,
      rigId: String(row.rigId || ''),
      positionOnRig: Number(row.positionOnRig) || 0,
      pan: Number(row.pan) || 0,
      tilt: Number(row.tilt) || 0,
      intensity: Number(row.intensity) || 1,
      color: {
        r: Number(row.colorR) || 255,
        g: Number(row.colorG) || 255,
        b: Number(row.colorB) || 255,
      },
      dmxAddress: Number(row.dmxAddress) || 1,
      dmxUniverse: Number(row.dmxUniverse) || 1,
    };
  });
}

export function parseActors(rows: Record<string, unknown>[]): Actor[] {
  return rows.map((row) => ({
    id: String(row.id || generateUUID()),
    name: String(row.name || '未命名演员'),
    height: Number(row.height) || 1.75,
    radius: Number(row.radius) || 0.3,
  }));
}

function parseVector3(prefix: string, row: Record<string, unknown>): Vector3 {
  return {
    x: Number(row[`${prefix}X`] || row[`${prefix}x`] || 0),
    y: Number(row[`${prefix}Y`] || row[`${prefix}y`] || 0),
    z: Number(row[`${prefix}Z`] || row[`${prefix}z`] || 0),
  };
}

export function parseActorTimelines(rows: Record<string, unknown>[]): ActorTimeline[] {
  const timelineMap = new Map<string, ActorTimeline>();

  rows.forEach((row) => {
    const actorId = String(row.actorId || '');
    if (!timelineMap.has(actorId)) {
      timelineMap.set(actorId, { actorId, keyframes: [] });
    }

    const timeline = timelineMap.get(actorId)!;
    timeline.keyframes.push({
      time: Number(row.time) || 0,
      position: parseVector3('pos', row),
      rotation: row.rotation ? Number(row.rotation) : undefined,
      note: row.note ? String(row.note) : undefined,
    });
  });

  return Array.from(timelineMap.values()).map((t) => ({
    ...t,
    keyframes: t.keyframes.sort((a, b) => a.time - b.time),
  }));
}

export function parseRigTimelines(rows: Record<string, unknown>[]): RigTimeline[] {
  const timelineMap = new Map<string, RigTimeline>();

  rows.forEach((row) => {
    const rigId = String(row.rigId || '');
    if (!timelineMap.has(rigId)) {
      timelineMap.set(rigId, { rigId, keyframes: [] });
    }

    const timeline = timelineMap.get(rigId)!;
    timeline.keyframes.push({
      time: Number(row.time) || 0,
      height: Number(row.height) || 0,
      note: row.note ? String(row.note) : undefined,
    });
  });

  return Array.from(timelineMap.values()).map((t) => ({
    ...t,
    keyframes: t.keyframes.sort((a, b) => a.time - b.time),
  }));
}

export function parseLightTimelines(rows: Record<string, unknown>[]): LightTimeline[] {
  const timelineMap = new Map<string, LightTimeline>();

  rows.forEach((row) => {
    const lightId = String(row.lightId || '');
    if (!timelineMap.has(lightId)) {
      timelineMap.set(lightId, { lightId, keyframes: [] });
    }

    const timeline = timelineMap.get(lightId)!;
    timeline.keyframes.push({
      time: Number(row.time) || 0,
      pan: row.pan !== undefined ? Number(row.pan) : undefined,
      tilt: row.tilt !== undefined ? Number(row.tilt) : undefined,
      intensity: row.intensity !== undefined ? Number(row.intensity) : undefined,
      color:
        row.colorR !== undefined
          ? {
              r: Number(row.colorR) || 255,
              g: Number(row.colorG) || 255,
              b: Number(row.colorB) || 255,
            }
          : undefined,
      note: row.note ? String(row.note) : undefined,
    });
  });

  return Array.from(timelineMap.values()).map((t) => ({
    ...t,
    keyframes: t.keyframes.sort((a, b) => a.time - b.time),
  }));
}

export function parseRestrictedZones(rows: Record<string, unknown>[]): RestrictedZone[] {
  return rows.map((row) => ({
    id: String(row.id || generateUUID()),
    name: String(row.name || '未命名禁区'),
    type: (row.type as RestrictedZone['type']) || 'noEntry',
    bounds: {
      min: {
        x: Number(row.minX) || 0,
        y: Number(row.minY) || 0,
        z: Number(row.minZ) || 0,
      },
      max: {
        x: Number(row.maxX) || 0,
        y: Number(row.maxY) || 0,
        z: Number(row.maxZ) || 0,
      },
    },
    maxHeight: row.maxHeight !== undefined ? Number(row.maxHeight) : undefined,
  }));
}

export function parseScenes(rows: Record<string, unknown>[]): Scene[] {
  return rows.map((row) => ({
    id: String(row.id || generateUUID()),
    name: String(row.name || '未命名场景'),
    startTime: Number(row.startTime) || 0,
    endTime: Number(row.endTime) || 60,
    description: String(row.description || ''),
  }));
}

export interface ImportedData {
  stage?: StageDimensions;
  rigs?: Rig[];
  lightTypes?: LightType[];
  lights?: LightFixture[];
  actors?: Actor[];
  actorTimelines?: ActorTimeline[];
  rigTimelines?: RigTimeline[];
  lightTimelines?: LightTimeline[];
  restrictedZones?: RestrictedZone[];
  scenes?: Scene[];
  targetMinLux?: number;
}

export function detectAndParse(filename: string, content: string): ImportedData {
  const lowerName = filename.toLowerCase();
  const isJSON = lowerName.endsWith('.json');
  const isCSV = lowerName.endsWith('.csv');

  if (isJSON) {
    const data = parseJSON(content);
    return data as ImportedData;
  }

  if (isCSV) {
    const rows = parseCSV<Record<string, unknown>>(content);

    if (rows.length === 0) {
      return {};
    }

    const headers = Object.keys(rows[0]).map((h) => h.toLowerCase());

    if (headers.includes('width') && headers.includes('depth') && headers.includes('height')) {
      return { stage: parseStageDimensions(rows) };
    }

    if (headers.includes('type') && headers.includes('length') && !headers.includes('beamangle')) {
      return { rigs: parseRigs(rows) };
    }

    if (headers.includes('wattage') && headers.includes('beamangle')) {
      return { lightTypes: parseLightTypes(rows) };
    }

    if (headers.includes('rigid') && headers.includes('positiononrig')) {
      return { lights: parseLightFixtures(rows, []) };
    }

    if (headers.includes('actorid') && headers.includes('posx') && !headers.includes('rigid')) {
      return { actorTimelines: parseActorTimelines(rows) };
    }

    if (headers.includes('rigid') && headers.includes('height') && headers.includes('time')) {
      return { rigTimelines: parseRigTimelines(rows) };
    }

    if (headers.includes('lightid') && headers.includes('time')) {
      return { lightTimelines: parseLightTimelines(rows) };
    }

    if (headers.includes('minx') && headers.includes('maxx')) {
      return { restrictedZones: parseRestrictedZones(rows) };
    }

    if (headers.includes('starttime') && headers.includes('endtime') && headers.includes('name')) {
      return { scenes: parseScenes(rows) };
    }

    if (headers.includes('height') && headers.includes('radius') && !headers.includes('type')) {
      return { actors: parseActors(rows) };
    }
  }

  return {};
}
