import Papa from 'papaparse';
import { 
  LightFixture, 
  Actor, 
  Camera, 
  ScheduleItem,
  ImportResult,
  Vec3
} from '../types';
import { v4 as uuidv4 } from 'uuid';

export function parseLightCsv(csvContent: string): ImportResult {
  const errors: string[] = [];
  const lights: LightFixture[] = [];

  const result = Papa.parse<any>(csvContent, {
    header: true,
    skipEmptyLines: true,
    trimHeaders: true
  });

  if (result.errors.length > 0) {
    errors.push(...result.errors.map(e => `CSV解析错误: ${e.message} (行 ${e.row})`));
  }

  for (let i = 0; i < result.data.length; i++) {
    const row = result.data[i];
    const rowNum = i + 2;

    const name = row['name'] || row['灯具名称'] || row['Name'];
    const type = row['type'] || row['类型'] || row['Type'] || '';
    
    if (!name) {
      errors.push(`行 ${rowNum}: 缺少灯具名称`);
      continue;
    }

    let power = 0;
    const powerStr = row['power'] || row['功率'] || row['Power'];
    if (powerStr !== undefined) {
      const parsed = parseFloat(powerStr);
      if (!isNaN(parsed) && parsed >= 0) {
        power = parsed;
      } else {
        errors.push(`行 ${rowNum}: 功率值无效`);
      }
    }

    let colorTemp = 5600;
    const tempStr = row['colorTemp'] || row['色温'] || row['ColorTemp'];
    if (tempStr !== undefined) {
      const parsed = parseInt(tempStr, 10);
      if (!isNaN(parsed) && parsed > 0) {
        colorTemp = parsed;
      }
    }

    let dmxChannel: number | undefined;
    const dmxStr = row['dmxChannel'] || row['DMX通道'] || row['DMX'];
    if (dmxStr !== undefined && dmxStr !== '') {
      const parsed = parseInt(dmxStr, 10);
      if (!isNaN(parsed) && parsed > 0) {
        dmxChannel = parsed;
      }
    }

    let isHighTemp = false;
    const highTempStr = row['isHighTemp'] || row['高温'] || row['HighTemp'];
    if (highTempStr !== undefined) {
      isHighTemp = highTempStr === 'true' || highTempStr === 'True' || highTempStr === '是' || highTempStr === '1';
    }

    lights.push({
      id: uuidv4(),
      name: String(name),
      type: String(type),
      power,
      colorTemp,
      dmxChannel,
      isHighTemp
    });
  }

  return {
    success: errors.length === 0 || lights.length > 0,
    data: lights,
    errors
  };
}

export function parseCameraActorJson(jsonContent: string): ImportResult {
  const errors: string[] = [];
  let data: any;

  try {
    data = JSON.parse(jsonContent);
  } catch (e) {
    return {
      success: false,
      data: null,
      errors: [`JSON解析失败: ${e instanceof Error ? e.message : String(e)}`]
    };
  }

  const actors: Actor[] = [];
  const cameras: Camera[] = [];

  if (data.actors && Array.isArray(data.actors)) {
    for (const item of data.actors) {
      if (!item.name) {
        errors.push('演员数据缺少 name 字段');
        continue;
      }
      
      const position: Vec3 = item.position || { x: 0, y: 0, z: 0 };
      const rotation: Vec3 = item.rotation || { x: 0, y: 0, z: 0 };
      
      actors.push({
        id: item.id || uuidv4(),
        name: String(item.name),
        position: {
          x: parseFloat(position.x) || 0,
          y: parseFloat(position.y) || 0,
          z: parseFloat(position.z) || 0
        },
        rotation: {
          x: parseFloat(rotation.x) || 0,
          y: parseFloat(rotation.y) || 0,
          z: parseFloat(rotation.z) || 0
        },
        walkPath: item.walkPath ? item.walkPath.map((p: any) => ({
          x: parseFloat(p.x) || 0,
          y: parseFloat(p.y) || 0,
          z: parseFloat(p.z) || 0
        })) : undefined
      });
    }
  }

  if (data.cameras && Array.isArray(data.cameras)) {
    for (const item of data.cameras) {
      if (!item.name) {
        errors.push('相机数据缺少 name 字段');
        continue;
      }
      
      const position: Vec3 = item.position || { x: 0, y: 1.5, z: 0 };
      const rotation: Vec3 = item.rotation || { x: 0, y: 0, z: 0 };
      
      cameras.push({
        id: item.id || uuidv4(),
        name: String(item.name),
        position: {
          x: parseFloat(position.x) || 0,
          y: parseFloat(position.y) || 1.5,
          z: parseFloat(position.z) || 0
        },
        rotation: {
          x: parseFloat(rotation.x) || 0,
          y: parseFloat(rotation.y) || 0,
          z: parseFloat(rotation.z) || 0
        },
        lens: String(item.lens || '50mm'),
        fov: parseFloat(item.fov) || 60
      });
    }
  }

  if (actors.length === 0 && cameras.length === 0) {
    errors.push('未找到有效的 actors 或 cameras 数据');
  }

  return {
    success: actors.length > 0 || cameras.length > 0,
    data: { actors, cameras },
    errors
  };
}

export function parseScheduleJson(jsonContent: string): ImportResult {
  const errors: string[] = [];
  let data: any;

  try {
    data = JSON.parse(jsonContent);
  } catch (e) {
    return {
      success: false,
      data: null,
      errors: [`JSON解析失败: ${e instanceof Error ? e.message : String(e)}`]
    };
  }

  const schedule: ScheduleItem[] = [];

  if (!Array.isArray(data)) {
    return {
      success: false,
      data: null,
      errors: ['日程数据应为数组格式']
    };
  }

  for (const item of data) {
    if (!item.sceneId || !item.sceneName || !item.date || !item.startTime || !item.endTime) {
      errors.push('日程项缺少必要字段 (sceneId, sceneName, date, startTime, endTime)');
      continue;
    }

    const timeRegex = /^\d{2}:\d{2}$/;
    if (!timeRegex.test(item.startTime)) {
      errors.push(`场次 "${item.sceneName}" 的 startTime 格式错误，应为 HH:MM`);
    }
    if (!timeRegex.test(item.endTime)) {
      errors.push(`场次 "${item.sceneName}" 的 endTime 格式错误，应为 HH:MM`);
    }

    schedule.push({
      id: item.id || uuidv4(),
      sceneId: String(item.sceneId),
      sceneName: String(item.sceneName),
      startTime: String(item.startTime),
      endTime: String(item.endTime),
      date: String(item.date),
      lightIds: Array.isArray(item.lightIds) ? item.lightIds : [],
      cameraIds: Array.isArray(item.cameraIds) ? item.cameraIds : [],
      actorIds: Array.isArray(item.actorIds) ? item.actorIds : [],
      notes: item.notes ? String(item.notes) : ''
    });
  }

  return {
    success: schedule.length > 0,
    data: schedule,
    errors
  };
}

export default {
  parseLightCsv,
  parseCameraActorJson,
  parseScheduleJson
};
