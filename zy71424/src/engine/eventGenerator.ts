import { Channel, EventType, GameEvent } from '@/types';

interface EventTemplate {
  type: EventType;
  weight: number;
  generate: (channels: Channel[], timeElapsed: number) => Omit<GameEvent, 'id' | 'timestamp' | 'resolved'>;
}

const vocalDescriptions = [
  '主唱麦有啸叫前兆',
  '主声道增益过高，注意',
  '高频刺耳，请处理',
];

const guitarDescriptions = [
  '吉他声道失真',
  '吉他音量过大',
  '吉他频段冲突',
];

const monitorRequests = [
  '主唱说听不清自己',
  '鼓手要更多贝斯返听',
  '吉他手要加自己返听',
  '键盘手返听太大',
];

const imbalanceDescriptions = [
  '人声被乐队盖住',
  '低频太轰头',
  '高频不够亮',
  '整体平衡需要调整',
];

const clippingDescriptions = [
  '主输出快爆了！',
  '电平红灯！拉下来！',
  '总输出过载警告！',
];

const eventTemplates: EventTemplate[] = [
  {
    type: 'imbalance',
    weight: 40,
    generate: (channels, timeElapsed) => {
      const channel = channels[Math.floor(Math.random() * channels.length)];
      return {
        type: 'imbalance',
        severity: timeElapsed > 60 ? 'critical' : 'warning',
        channelId: channel.id,
        description: imbalanceDescriptions[Math.floor(Math.random() * imbalanceDescriptions.length)] + ` (${channel.name})`,
      };
    },
  },
  {
    type: 'monitor_request',
    weight: 30,
    generate: (channels) => {
      const vocalChannels = channels.filter(c => c.type === 'vocal');
      const channel = vocalChannels.length > 0 
        ? vocalChannels[Math.floor(Math.random() * vocalChannels.length)]
        : channels[0];
      return {
        type: 'monitor_request',
        severity: 'warning',
        channelId: channel.id,
        description: monitorRequests[Math.floor(Math.random() * monitorRequests.length)],
      };
    },
  },
  {
    type: 'feedback',
    weight: 20,
    generate: (channels, timeElapsed) => {
      const vocalChannels = channels.filter(c => c.type === 'vocal');
      const channel = vocalChannels.length > 0 
        ? vocalChannels[Math.floor(Math.random() * vocalChannels.length)]
        : channels[0];
      return {
        type: 'feedback',
        severity: 'critical',
        channelId: channel.id,
        description: vocalDescriptions[Math.floor(Math.random() * vocalDescriptions.length)],
      };
    },
  },
  {
    type: 'clipping',
    weight: 10,
    generate: () => ({
      type: 'clipping',
      severity: 'critical',
      description: clippingDescriptions[Math.floor(Math.random() * clippingDescriptions.length)],
    }),
  },
];

export const generateRandomEvent = (
  channels: Channel[],
  timeElapsed: number,
  unresolvedEvents: GameEvent[]
): Omit<GameEvent, 'id' | 'timestamp' | 'resolved'> | null => {
  const difficultyMultiplier = 1 + (timeElapsed / 180) * 0.5;
  
  const maxUnresolved = Math.floor(2 + difficultyMultiplier);
  if (unresolvedEvents.length >= maxUnresolved) {
    return null;
  }

  const totalWeight = eventTemplates.reduce((sum, t) => sum + t.weight, 0);
  let random = Math.random() * totalWeight;

  for (const template of eventTemplates) {
    random -= template.weight;
    if (random <= 0) {
      return template.generate(channels, timeElapsed);
    }
  }

  return eventTemplates[0].generate(channels, timeElapsed);
};

export const checkConditionForEvent = (
  channels: Channel[],
  masterLevel: number,
  lastEventTime: number,
  currentTime: number
): EventType | null => {
  const timeSinceLastEvent = currentTime - lastEventTime;
  
  if (masterLevel > 85) {
    return 'clipping';
  }

  const highGainChannel = channels.find(c => c.level > 90 && !c.mute);
  if (highGainChannel && timeSinceLastEvent > 8) {
    return 'feedback';
  }

  return null;
};
