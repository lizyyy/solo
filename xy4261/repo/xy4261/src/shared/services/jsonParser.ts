import { Fixture, FixtureChannel } from '../models/types';

export interface FixtureJsonData {
  fixtures: {
    id?: string;
    name: string;
    model?: string;
    manufacturer?: string;
    channelCount: number;
    channels?: {
      number: number;
      name: string;
      type?: FixtureChannel['type'];
      defaultValue?: number;
    }[];
    power: number;
    powerUnit?: 'W' | 'kW';
    type?: Fixture['type'];
    dmxMode?: string;
    notes?: string;
  }[];
}

export function parseFixtureJson(content: string): Fixture[] {
  const data: FixtureJsonData = JSON.parse(content);
  
  if (!data.fixtures || !Array.isArray(data.fixtures)) {
    throw new Error('JSON 格式错误：未找到 fixtures 数组');
  }
  
  return data.fixtures.map((fixtureData, index) => {
    const channelCount = fixtureData.channelCount;
    
    if (!channelCount || channelCount < 1) {
      throw new Error(`灯具 ${index} (${fixtureData.name}) 的通道数无效`);
    }
    
    if (fixtureData.power === undefined || fixtureData.power < 0) {
      throw new Error(`灯具 ${index} (${fixtureData.name}) 的功率值无效`);
    }
    
    const channels: FixtureChannel[] = fixtureData.channels 
      ? fixtureData.channels.map(ch => ({
          number: ch.number,
          name: ch.name,
          type: ch.type || 'other',
          defaultValue: ch.defaultValue
        }))
      : generateDefaultChannels(channelCount);
    
    return {
      id: fixtureData.id || `fixture-${Date.now()}-${index}`,
      name: fixtureData.name,
      model: fixtureData.model || '通用灯具',
      manufacturer: fixtureData.manufacturer || '未知厂商',
      channelCount,
      channels,
      power: fixtureData.power,
      powerUnit: fixtureData.powerUnit || 'W',
      type: fixtureData.type || 'other',
      dmxMode: fixtureData.dmxMode || '标准模式',
      notes: fixtureData.notes
    };
  });
}

function generateDefaultChannels(count: number): FixtureChannel[] {
  const channels: FixtureChannel[] = [];
  for (let i = 1; i <= count; i++) {
    channels.push({
      number: i,
      name: `通道 ${i}`,
      type: 'other'
    });
  }
  return channels;
}

export function stringifyFixtureJson(fixtures: Fixture[]): string {
  const data: FixtureJsonData = {
    fixtures: fixtures.map(fixture => ({
      id: fixture.id,
      name: fixture.name,
      model: fixture.model,
      manufacturer: fixture.manufacturer,
      channelCount: fixture.channelCount,
      channels: fixture.channels,
      power: fixture.power,
      powerUnit: fixture.powerUnit,
      type: fixture.type,
      dmxMode: fixture.dmxMode,
      notes: fixture.notes
    }))
  };
  
  return JSON.stringify(data, null, 2);
}

export interface PatchJsonData {
  patches: {
    id?: string;
    fixtureId: string;
    universe: number;
    startChannel: number;
    endChannel?: number;
    patchName?: string;
    notes?: string;
  }[];
}

export function parsePatchJson(content: string): PatchJsonData {
  const data: PatchJsonData = JSON.parse(content);
  
  if (!data.patches || !Array.isArray(data.patches)) {
    throw new Error('JSON 格式错误：未找到 patches 数组');
  }
  
  return data;
}

export function stringifyPatchJson(
  patches: {
    id: string;
    fixtureId: string;
    universe: number;
    startChannel: number;
    endChannel: number;
    patchName: string;
    notes?: string;
  }[]
): string {
  const data: PatchJsonData = {
    patches: patches.map(patch => ({
      id: patch.id,
      fixtureId: patch.fixtureId,
      universe: patch.universe,
      startChannel: patch.startChannel,
      endChannel: patch.endChannel,
      patchName: patch.patchName,
      notes: patch.notes
    }))
  };
  
  return JSON.stringify(data, null, 2);
}
