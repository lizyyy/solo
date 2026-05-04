import csvParser from 'csv-parser';
import fs from 'fs-extra';
import path from 'path';
import type { Fixture, Cue, Circuit, BannedDevice } from '../types';

export interface ColumnMapping {
  [key: string]: string | string[];
}

function safeInt(value: any, defaultValue: number = 0): number {
  const num = parseInt(String(value), 10);
  return isNaN(num) ? defaultValue : num;
}

function safeString(value: any, defaultValue: string = ''): string {
  if (value === null || value === undefined) return defaultValue;
  return String(value).trim();
}

function getValueByMapping(row: any, mapping: ColumnMapping, key: string): any {
  const mappedKeys = mapping[key];
  if (!mappedKeys) return undefined;
  
  const keys = Array.isArray(mappedKeys) ? mappedKeys : [mappedKeys];
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== null && row[k] !== '') {
      return row[k];
    }
  }
  return undefined;
}

const defaultFixtureMapping: ColumnMapping = {
  name: ['name', '灯具名称', 'device', 'fixture', '设备名'],
  type: ['type', '类型', 'model', '型号', 'fixture_type'],
  dmxStartAddress: ['dmx_start', 'dmx', '起始地址', 'address', 'start_address', 'dmx_address'],
  dmxChannelCount: ['channels', '通道数', 'channel_count', 'count'],
  universe: ['universe', '域', 'universe_id', 'u'],
  power: ['power', '功率', 'watt', 'w'],
  circuitId: ['circuit', '回路', 'power_circuit', '回路编号'],
};

const defaultCueMapping: ColumnMapping = {
  cueNumber: ['cue', 'cue_number', '号', '编号', 'cue_no'],
  name: ['name', '名称', 'cue_name', '描述'],
  description: ['description', '备注', 'note', '说明'],
  mediaReferences: ['media', '素材', 'media_files', '引用素材'],
};

const defaultCircuitMapping: ColumnMapping = {
  name: ['name', '回路名称', 'circuit', '回路编号'],
  maxPower: ['max_power', '最大功率', 'capacity', '容量', 'limit'],
  description: ['description', '备注', 'location', '位置'],
};

const defaultBannedDeviceMapping: ColumnMapping = {
  name: ['name', '设备名称', 'device', '禁止设备'],
  reason: ['reason', '原因', '备注', '说明'],
};

export async function parseFixturesCsv(
  filePath: string,
  projectId: string,
  mapping?: ColumnMapping
): Promise<Omit<Fixture, 'id'>[]> {
  const results: Omit<Fixture, 'id'>[] = [];
  const actualMapping = mapping || defaultFixtureMapping;
  
  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csvParser())
      .on('data', (row: any) => {
        const fixture: Omit<Fixture, 'id'> = {
          projectId,
          name: safeString(getValueByMapping(row, actualMapping, 'name'), path.basename(filePath)),
          type: safeString(getValueByMapping(row, actualMapping, 'type')),
          dmxStartAddress: safeInt(getValueByMapping(row, actualMapping, 'dmxStartAddress'), 1),
          dmxChannelCount: safeInt(getValueByMapping(row, actualMapping, 'dmxChannelCount'), 1),
          universe: safeInt(getValueByMapping(row, actualMapping, 'universe'), 1),
          power: safeInt(getValueByMapping(row, actualMapping, 'power')),
          circuitId: safeString(getValueByMapping(row, actualMapping, 'circuitId')) || null,
          note: null,
        };
        results.push(fixture);
      })
      .on('end', () => resolve(results))
      .on('error', reject);
  });
}

export async function parseCuesCsv(
  filePath: string,
  projectId: string,
  mapping?: ColumnMapping
): Promise<Omit<Cue, 'id'>[]> {
  const results: Omit<Cue, 'id'>[] = [];
  const actualMapping = mapping || defaultCueMapping;
  
  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csvParser())
      .on('data', (row: any) => {
        const mediaRaw = getValueByMapping(row, actualMapping, 'mediaReferences');
        let mediaReferences: string[] = [];
        if (mediaRaw) {
          mediaReferences = String(mediaRaw)
            .split(/[,;|]/)
            .map((s: string) => s.trim())
            .filter((s: string) => s.length > 0);
        }
        
        const cue: Omit<Cue, 'id'> = {
          projectId,
          cueNumber: safeString(getValueByMapping(row, actualMapping, 'cueNumber'), String(results.length + 1)),
          name: safeString(getValueByMapping(row, actualMapping, 'name')),
          description: safeString(getValueByMapping(row, actualMapping, 'description')),
          mediaReferences,
          note: null,
        };
        results.push(cue);
      })
      .on('end', () => resolve(results))
      .on('error', reject);
  });
}

export async function parseCircuitsCsv(
  filePath: string,
  projectId: string,
  mapping?: ColumnMapping
): Promise<Omit<Circuit, 'id'>[]> {
  const results: Omit<Circuit, 'id'>[] = [];
  const actualMapping = mapping || defaultCircuitMapping;
  
  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csvParser())
      .on('data', (row: any) => {
        const circuit: Omit<Circuit, 'id'> = {
          projectId,
          name: safeString(getValueByMapping(row, actualMapping, 'name'), `回路${results.length + 1}`),
          maxPower: safeInt(getValueByMapping(row, actualMapping, 'maxPower'), 2000),
          description: safeString(getValueByMapping(row, actualMapping, 'description')),
          note: null,
        };
        results.push(circuit);
      })
      .on('end', () => resolve(results))
      .on('error', reject);
  });
}

export async function parseBannedDevicesCsv(
  filePath: string,
  projectId: string,
  mapping?: ColumnMapping
): Promise<Omit<BannedDevice, 'id'>[]> {
  const results: Omit<BannedDevice, 'id'>[] = [];
  const actualMapping = mapping || defaultBannedDeviceMapping;
  
  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csvParser())
      .on('data', (row: any) => {
        const device: Omit<BannedDevice, 'id'> = {
          projectId,
          name: safeString(getValueByMapping(row, actualMapping, 'name')),
          reason: safeString(getValueByMapping(row, actualMapping, 'reason')),
        };
        if (device.name) {
          results.push(device);
        }
      })
      .on('end', () => resolve(results))
      .on('error', reject);
  });
}

export async function scanMediaFolder(
  folderPath: string,
  projectId: string
): Promise<Array<{ name: string; path: string; size: number; fileType: string }>> {
  const results: Array<{ name: string; path: string; size: number; fileType: string }> = [];
  
  if (!await fs.pathExists(folderPath)) {
    return results;
  }
  
  const items = await fs.readdir(folderPath);
  
  for (const item of items) {
    const fullPath = path.join(folderPath, item);
    const stat = await fs.stat(fullPath);
    
    if (stat.isFile()) {
      const ext = path.extname(item).toLowerCase().slice(1);
      results.push({
        name: item,
        path: fullPath,
        size: stat.size,
        fileType: ext,
      });
    } else if (stat.isDirectory()) {
      const subItems = await scanMediaFolder(fullPath, projectId);
      results.push(...subItems);
    }
  }
  
  return results;
}

export { defaultFixtureMapping, defaultCueMapping, defaultCircuitMapping, defaultBannedDeviceMapping };
