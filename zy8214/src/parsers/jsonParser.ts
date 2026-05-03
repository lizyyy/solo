import { Fixture, Channel, ChannelType, ParsingError } from '../types';

const VALID_CHANNEL_TYPES: Set<ChannelType> = new Set([
  'dimmer',
  'red', 'green', 'blue', 'white', 'amber', 'uv',
  'pan', 'tilt',
  'gobo', 'color', 'strobe',
  'safety',
  'other'
]);

function isValidChannelType(type: unknown): type is ChannelType {
  return typeof type === 'string' && VALID_CHANNEL_TYPES.has(type as ChannelType);
}

export function parseFixtures(jsonString: string): { fixtures: Fixture[]; errors: ParsingError[] } {
  const errors: ParsingError[] = [];
  let fixtures: Fixture[] = [];

  try {
    const data = JSON.parse(jsonString);
    
    if (!Array.isArray(data)) {
      errors.push({
        type: 'json',
        message: '灯具数据必须是数组格式'
      });
      return { fixtures: [], errors };
    }

    fixtures = data.map((item: unknown, index: number) => {
      const fixture = item as Record<string, unknown>;
      const fixtureErrors = validateFixture(fixture, index);
      errors.push(...fixtureErrors);
      
      return {
        id: String(fixture.id || `fixture-${index}`),
        name: String(fixture.name || `灯具 ${index + 1}`),
        universe: fixture.universe ? Number(fixture.universe) : undefined,
        channels: parseChannels(fixture.channels, String(fixture.id || `fixture-${index}`), errors)
      };
    });

  } catch (e) {
    errors.push({
      type: 'json',
      message: `JSON 解析错误: ${e instanceof Error ? e.message : '未知错误'}`
    });
  }

  return { fixtures, errors };
}

function validateFixture(fixture: Record<string, unknown>, index: number): ParsingError[] {
  const errors: ParsingError[] = [];

  if (!fixture.id) {
    errors.push({
      type: 'json',
      message: `灯具 ${index + 1} 缺少 id 字段`,
      row: index + 1
    });
  }

  if (!fixture.name) {
    errors.push({
      type: 'json',
      message: `灯具 ${index + 1} 缺少 name 字段`,
      row: index + 1
    });
  }

  if (!fixture.channels) {
    errors.push({
      type: 'json',
      message: `灯具 ${index + 1} 缺少 channels 字段`,
      row: index + 1
    });
  }

  return errors;
}

function parseChannels(
  channelsData: unknown, 
  fixtureId: string,
  errors: ParsingError[]
): Channel[] {
  if (!Array.isArray(channelsData)) {
    return [];
  }

  return channelsData.map((channel: unknown, index: number) => {
    const ch = channel as Record<string, unknown>;
    
    if (!ch.dmxAddress) {
      errors.push({
        type: 'json',
        message: `灯具 ${fixtureId} 的通道 ${index + 1} 缺少 dmxAddress 字段`,
        row: index + 1
      });
    }

    let channelType: ChannelType = 'other';
    if (isValidChannelType(ch.type)) {
      channelType = ch.type;
    }

    return {
      id: String(ch.id || `${fixtureId}-channel-${index}`),
      name: String(ch.name || `通道 ${index + 1}`),
      dmxAddress: Number(ch.dmxAddress || 0),
      type: channelType,
      fixtureId
    };
  });
}