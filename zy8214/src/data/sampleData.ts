import { Fixture, Cue, SceneRules } from '../types';

export const sampleFixtures: Fixture[] = [
  {
    id: 'fixture-1',
    name: '主顶光 - 左',
    universe: 1,
    channels: [
      { id: 'f1-ch1', name: 'Dimmer', dmxAddress: 1, type: 'dimmer', fixtureId: 'fixture-1' },
      { id: 'f1-ch2', name: 'Red', dmxAddress: 2, type: 'red', fixtureId: 'fixture-1' },
      { id: 'f1-ch3', name: 'Green', dmxAddress: 3, type: 'green', fixtureId: 'fixture-1' },
      { id: 'f1-ch4', name: 'Blue', dmxAddress: 4, type: 'blue', fixtureId: 'fixture-1' }
    ]
  },
  {
    id: 'fixture-2',
    name: '主顶光 - 右',
    universe: 1,
    channels: [
      { id: 'f2-ch1', name: 'Dimmer', dmxAddress: 5, type: 'dimmer', fixtureId: 'fixture-2' },
      { id: 'f2-ch2', name: 'Red', dmxAddress: 6, type: 'red', fixtureId: 'fixture-2' },
      { id: 'f2-ch3', name: 'Green', dmxAddress: 7, type: 'green', fixtureId: 'fixture-2' },
      { id: 'f2-ch4', name: 'Blue', dmxAddress: 8, type: 'blue', fixtureId: 'fixture-2' }
    ]
  },
  {
    id: 'fixture-3',
    name: '面光 - 舞台',
    universe: 1,
    channels: [
      { id: 'f3-ch1', name: 'Dimmer', dmxAddress: 9, type: 'dimmer', fixtureId: 'fixture-3' },
      { id: 'f3-ch2', name: 'Red', dmxAddress: 10, type: 'red', fixtureId: 'fixture-3' },
      { id: 'f3-ch3', name: 'Green', dmxAddress: 11, type: 'green', fixtureId: 'fixture-3' },
      { id: 'f3-ch4', name: 'Blue', dmxAddress: 12, type: 'blue', fixtureId: 'fixture-3' }
    ]
  },
  {
    id: 'fixture-4',
    name: '摇头灯 - 左',
    universe: 1,
    channels: [
      { id: 'f4-ch1', name: 'Pan', dmxAddress: 13, type: 'pan', fixtureId: 'fixture-4' },
      { id: 'f4-ch2', name: 'Tilt', dmxAddress: 14, type: 'tilt', fixtureId: 'fixture-4' },
      { id: 'f4-ch3', name: 'Dimmer', dmxAddress: 15, type: 'dimmer', fixtureId: 'fixture-4' },
      { id: 'f4-ch4', name: 'Color', dmxAddress: 16, type: 'color', fixtureId: 'fixture-4' },
      { id: 'f4-ch5', name: 'Gobo', dmxAddress: 17, type: 'gobo', fixtureId: 'fixture-4' }
    ]
  },
  {
    id: 'fixture-5',
    name: '摇头灯 - 右',
    universe: 1,
    channels: [
      { id: 'f5-ch1', name: 'Pan', dmxAddress: 18, type: 'pan', fixtureId: 'fixture-5' },
      { id: 'f5-ch2', name: 'Tilt', dmxAddress: 19, type: 'tilt', fixtureId: 'fixture-5' },
      { id: 'f5-ch3', name: 'Dimmer', dmxAddress: 20, type: 'dimmer', fixtureId: 'fixture-5' },
      { id: 'f5-ch4', name: 'Color', dmxAddress: 21, type: 'color', fixtureId: 'fixture-5' },
      { id: 'f5-ch5', name: 'Gobo', dmxAddress: 22, type: 'gobo', fixtureId: 'fixture-5' }
    ]
  },
  {
    id: 'fixture-6',
    name: '安全灯 - 通道1',
    universe: 1,
    channels: [
      { id: 'f6-ch1', name: 'Safety Light', dmxAddress: 23, type: 'safety', fixtureId: 'fixture-6' }
    ]
  },
  {
    id: 'fixture-7',
    name: '安全灯 - 通道2',
    universe: 1,
    channels: [
      { id: 'f7-ch1', name: 'Safety Light', dmxAddress: 24, type: 'safety', fixtureId: 'fixture-7' }
    ]
  },
  {
    id: 'fixture-conflict',
    name: '冲突测试灯具',
    universe: 1,
    channels: [
      { id: 'fc-ch1', name: 'Dimmer', dmxAddress: 1, type: 'dimmer', fixtureId: 'fixture-conflict' }
    ]
  }
];

export const sampleCues: Cue[] = [
  {
    id: 'cue-1',
    number: '1',
    name: '开场 - 全黑',
    startTime: 0,
    fadeIn: 0,
    fadeOut: 0,
    duration: 2,
    channelValues: [
      { channelId: 'f1-ch1', value: 0 },
      { channelId: 'f2-ch1', value: 0 },
      { channelId: 'f3-ch1', value: 0 },
      { channelId: 'f4-ch3', value: 0 },
      { channelId: 'f5-ch3', value: 0 },
      { channelId: 'f6-ch1', value: 0 },
      { channelId: 'f7-ch1', value: 0 }
    ],
    notes: '开场黑场，准备开始演出'
  },
  {
    id: 'cue-2',
    number: '2',
    name: '面光亮起',
    startTime: 2,
    fadeIn: 3,
    fadeOut: 0,
    duration: 5,
    channelValues: [
      { channelId: 'f1-ch1', value: 200 },
      { channelId: 'f1-ch2', value: 255 },
      { channelId: 'f1-ch3', value: 255 },
      { channelId: 'f1-ch4', value: 255 },
      { channelId: 'f2-ch1', value: 200 },
      { channelId: 'f2-ch2', value: 255 },
      { channelId: 'f2-ch3', value: 255 },
      { channelId: 'f2-ch4', value: 255 },
      { channelId: 'f3-ch1', value: 180 },
      { channelId: 'f3-ch2', value: 255 },
      { channelId: 'f3-ch3', value: 255 },
      { channelId: 'f3-ch4', value: 255 },
      { channelId: 'f6-ch1', value: 128 },
      { channelId: 'f7-ch1', value: 128 }
    ],
    notes: '演员入场，面光渐亮'
  },
  {
    id: 'cue-3',
    number: '3',
    name: '顶光加强',
    startTime: 8,
    fadeIn: 1,
    fadeOut: 0,
    duration: 4,
    channelValues: [
      { channelId: 'f1-ch1', value: 255 },
      { channelId: 'f2-ch1', value: 255 },
      { channelId: 'f3-ch1', value: 180 },
      { channelId: 'f4-ch3', value: 150 },
      { channelId: 'f4-ch4', value: 50 },
      { channelId: 'f5-ch3', value: 150 },
      { channelId: 'f5-ch4', value: 50 },
      { channelId: 'f6-ch1', value: 128 },
      { channelId: 'f7-ch1', value: 128 }
    ],
    notes: '顶光亮度增加，摇头灯激活'
  },
  {
    id: 'cue-4',
    number: '4',
    name: '舞台蓝调',
    startTime: 12,
    fadeIn: 2,
    fadeOut: 1,
    duration: 6,
    channelValues: [
      { channelId: 'f1-ch1', value: 180 },
      { channelId: 'f1-ch2', value: 100 },
      { channelId: 'f1-ch3', value: 150 },
      { channelId: 'f1-ch4', value: 255 },
      { channelId: 'f2-ch1', value: 180 },
      { channelId: 'f2-ch2', value: 100 },
      { channelId: 'f2-ch3', value: 150 },
      { channelId: 'f2-ch4', value: 255 },
      { channelId: 'f3-ch1', value: 100 },
      { channelId: 'f3-ch2', value: 80 },
      { channelId: 'f3-ch3', value: 100 },
      { channelId: 'f3-ch4', value: 200 },
      { channelId: 'f4-ch3', value: 200 },
      { channelId: 'f4-ch4', value: 100 },
      { channelId: 'f5-ch3', value: 200 },
      { channelId: 'f5-ch4', value: 100 },
      { channelId: 'f6-ch1', value: 128 },
      { channelId: 'f7-ch1', value: 128 }
    ],
    notes: '场景转换，蓝色基调'
  },
  {
    id: 'cue-5',
    number: '5',
    name: '黑场过渡',
    startTime: 18,
    fadeIn: 0,
    fadeOut: 2,
    duration: 2,
    channelValues: [
      { channelId: 'f1-ch1', value: 0 },
      { channelId: 'f2-ch1', value: 0 },
      { channelId: 'f3-ch1', value: 0 },
      { channelId: 'f4-ch3', value: 0 },
      { channelId: 'f5-ch3', value: 0 },
      { channelId: 'f6-ch1', value: 0 },
      { channelId: 'f7-ch1', value: 0 }
    ],
    notes: '黑场，准备转场'
  },
  {
    id: 'cue-6',
    number: '6',
    name: '长黑场测试',
    startTime: 20,
    fadeIn: 0,
    fadeOut: 0,
    duration: 8,
    channelValues: [
      { channelId: 'f1-ch1', value: 0 },
      { channelId: 'f2-ch1', value: 0 },
      { channelId: 'f3-ch1', value: 0 },
      { channelId: 'f4-ch3', value: 0 },
      { channelId: 'f5-ch3', value: 0 },
      { channelId: 'f6-ch1', value: 0 },
      { channelId: 'f7-ch1', value: 0 }
    ],
    notes: '故意设置的长黑场，用于测试黑场警告'
  },
  {
    id: 'cue-7',
    number: '7',
    name: '高潮 - 全亮',
    startTime: 28,
    fadeIn: 3,
    fadeOut: 0,
    duration: 10,
    channelValues: [
      { channelId: 'f1-ch1', value: 255 },
      { channelId: 'f1-ch2', value: 255 },
      { channelId: 'f1-ch3', value: 255 },
      { channelId: 'f1-ch4', value: 255 },
      { channelId: 'f2-ch1', value: 255 },
      { channelId: 'f2-ch2', value: 255 },
      { channelId: 'f2-ch3', value: 255 },
      { channelId: 'f2-ch4', value: 255 },
      { channelId: 'f3-ch1', value: 255 },
      { channelId: 'f3-ch2', value: 255 },
      { channelId: 'f3-ch3', value: 255 },
      { channelId: 'f3-ch4', value: 255 },
      { channelId: 'f4-ch3', value: 255 },
      { channelId: 'f4-ch4', value: 80 },
      { channelId: 'f5-ch3', value: 255 },
      { channelId: 'f5-ch4', value: 80 },
      { channelId: 'f6-ch1', value: 200 },
      { channelId: 'f7-ch1', value: 200 }
    ],
    notes: '全场灯光全亮，高潮时刻'
  },
  {
    id: 'cue-8',
    number: '8',
    name: '谢幕 - 暖光',
    startTime: 38,
    fadeIn: 2,
    fadeOut: 0,
    duration: 8,
    channelValues: [
      { channelId: 'f1-ch1', value: 200 },
      { channelId: 'f1-ch2', value: 255 },
      { channelId: 'f1-ch3', value: 200 },
      { channelId: 'f1-ch4', value: 100 },
      { channelId: 'f2-ch1', value: 200 },
      { channelId: 'f2-ch2', value: 255 },
      { channelId: 'f2-ch3', value: 200 },
      { channelId: 'f2-ch4', value: 100 },
      { channelId: 'f3-ch1', value: 220 },
      { channelId: 'f3-ch2', value: 255 },
      { channelId: 'f3-ch3', value: 220 },
      { channelId: 'f3-ch4', value: 120 },
      { channelId: 'f4-ch3', value: 100 },
      { channelId: 'f5-ch3', value: 100 },
      { channelId: 'f6-ch1', value: 128 },
      { channelId: 'f7-ch1', value: 128 }
    ],
    notes: '暖色调，演员谢幕'
  },
  {
    id: 'cue-9',
    number: '9',
    name: '结束 - 黑场（无安全灯）',
    startTime: 46,
    fadeIn: 2,
    fadeOut: 0,
    duration: 5,
    channelValues: [
      { channelId: 'f1-ch1', value: 0 },
      { channelId: 'f2-ch1', value: 0 },
      { channelId: 'f3-ch1', value: 0 },
      { channelId: 'f4-ch3', value: 0 },
      { channelId: 'f5-ch3', value: 0 },
      { channelId: 'f6-ch1', value: 0 },
      { channelId: 'f7-ch1', value: 0 }
    ],
    notes: '演出结束，全黑，故意不开启安全灯用于测试'
  }
];

export const sampleRules: SceneRules = {
  blackoutThreshold: 5,
  requiresSafetyLight: true,
  safetyLightChannels: ['f6-ch1', 'f7-ch1'],
  maxFadeOverlap: 2
};

export const sampleData = {
  fixtures: sampleFixtures,
  cues: sampleCues,
  rules: sampleRules
};

export function getSampleFixturesJSON(): string {
  return JSON.stringify(sampleFixtures, null, 2);
}

export function getSampleCuesCSV(): string {
  const headers = ['id', 'number', 'name', 'startTime', 'fadeIn', 'fadeOut', 'duration', 'notes'];
  
  const allChannelIds = new Set<string>();
  sampleCues.forEach((cue) => {
    cue.channelValues.forEach((cv) => allChannelIds.add(cv.channelId));
  });
  
  allChannelIds.forEach((id) => headers.push(`channel_${id}`));

  const rows = sampleCues.map((cue) => {
    const row: Record<string, string | number> = {
      id: cue.id,
      number: cue.number,
      name: cue.name,
      startTime: cue.startTime,
      fadeIn: cue.fadeIn,
      fadeOut: cue.fadeOut,
      duration: cue.duration,
      notes: cue.notes || ''
    };

    cue.channelValues.forEach((cv) => {
      row[`channel_${cv.channelId}`] = cv.value;
    });

    return row;
  });

  return [
    headers.join(','),
    ...rows.map((row) => 
      headers.map((h) => {
        const value = row[h];
        if (value === undefined) return '';
        if (typeof value === 'string' && (value.includes(',') || value.includes('\n'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return String(value);
      }).join(',')
    )
  ].join('\n');
}

export function getSampleRulesYAML(): string {
  return `# 场景规则配置
blackoutThreshold: 5
requiresSafetyLight: true
safetyLightChannels:
  - f6-ch1
  - f7-ch1
maxFadeOverlap: 2
`;
}