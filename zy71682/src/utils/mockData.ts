import type {
  BandRequirement,
  Channel,
  Monitor,
  VersionRecord,
  FilterSnapshot,
  ExportRecord,
  Conflict
} from '@/types';
import { RequirementStatus, ConflictType } from '@/types';
import { generateId } from './helpers';

export function createMockChannels(bandId: string, count: number): Channel[] {
  const types: Channel['type'][] = ['vocals', 'guitar', 'bass', 'drums', 'keys', 'other'];
  const names = ['主唱', '和声', '主音吉他', '节奏吉他', '贝斯', '底鼓', '军鼓', '通鼓', '镲片', '键盘', '合成器', 'DJ台'];

  return Array.from({ length: count }, (_, i) => ({
    id: generateId(),
    name: names[i % names.length],
    type: types[i % types.length],
    assignedTo: bandId,
    order: i + 1,
    notes: i % 3 === 0 ? '需要DI盒' : ''
  }));
}

export function createMockMonitors(
  channels: Channel[],
  count: number
): Monitor[] {
  const positions: Monitor['position'][] = [
    'stage_left',
    'stage_center',
    'stage_right',
    'drummer'
  ];

  return Array.from({ length: count }, (_, i) => {
    const mix: Record<string, number> = {};
    channels.slice(0, 4).forEach((ch, idx) => {
      mix[ch.id] = 60 + idx * 10;
    });
    return {
      id: generateId(),
      name: `返听 ${i + 1}`,
      position: positions[i % positions.length],
      mix,
      notes: i === 0 ? '需要提升低频' : ''
    };
  });
}

const bandNames = [
  '午夜霓虹',
  '电波干扰',
  '噪音狂欢',
  '后海冲浪',
  '银河列车',
  '迷失森林',
  '城市猎人',
  '深海回响'
];

const dates = ['2026-06-15', '2026-06-16', '2026-06-17'];
const timeSlots = [
  { start: '13:00', end: '14:00', changeOver: 20 },
  { start: '14:30', end: '15:30', changeOver: 20 },
  { start: '15:50', end: '16:50', changeOver: 20 },
  { start: '17:10', end: '18:10', changeOver: 20 },
  { start: '18:30', end: '19:30', changeOver: 20 },
  { start: '19:50', end: '20:50', changeOver: 20 },
  { start: '21:10', end: '22:10', changeOver: 20 },
  { start: '22:30', end: '23:30', changeOver: 20 }
];

const stageNotes = [
  '主唱需要无线耳返',
  '鼓组需要额外的环境麦',
  '贝斯手要站在舞台右侧',
  '键盘需要两路输出',
  '需要舞台前区的补声',
  'DJ台需要独立的监听'
];

export function generateMockRequirements(): BandRequirement[] {
  const requirements: BandRequirement[] = [];

  bandNames.forEach((bandName, bandIndex) => {
    const date = dates[Math.floor(bandIndex / 3)];
    const timeSlot = timeSlots[bandIndex % timeSlots.length];
    const channelCount = 4 + (bandIndex % 4) * 2;
    const monitorCount = 2 + (bandIndex % 3);

    const channels = createMockChannels(`band-${bandIndex}`, channelCount);
    const monitors = createMockMonitors(channels, monitorCount);

    if (bandIndex === 2) {
      channels[0].name = '主唱';
      channels[3].name = '主唱';
    }

    if (bandIndex === 5) {
      timeSlot.changeOver = 45;
    }

    if (bandIndex === 1) {
      timeSlot.start = '14:10';
    }

    const requirement: BandRequirement = {
      id: generateId(),
      bandName,
      performanceDate: date,
      startTime: timeSlot.start,
      endTime: timeSlot.end,
      changeOverTime: timeSlot.changeOver,
      channels,
      monitors,
      stageNotes: stageNotes[bandIndex % stageNotes.length],
      status: RequirementStatus.NORMAL,
      conflicts: [],
      currentVersion: 1,
      createdAt: new Date(Date.now() - bandIndex * 3600000).toISOString(),
      updatedAt: new Date(Date.now() - bandIndex * 1800000).toISOString()
    };

    requirements.push(requirement);
  });

  return requirements;
}

export function generateMockVersions(
  requirements: BandRequirement[]
): VersionRecord[] {
  const versions: VersionRecord[] = [];

  requirements.forEach((req, index) => {
    if (index % 2 === 0) {
      const v1: VersionRecord = {
        id: generateId(),
        requirementId: req.id,
        versionNumber: 1,
        snapshot: JSON.parse(JSON.stringify(req)),
        changeSummary: '初始版本',
        createdAt: req.createdAt,
        createdBy: 'admin'
      };
      versions.push(v1);

      const modifiedReq = JSON.parse(JSON.stringify(req)) as BandRequirement;
      modifiedReq.currentVersion = 2;
      modifiedReq.channels.push({
        id: generateId(),
        name: '额外人声',
        type: 'vocals',
        assignedTo: req.id,
        order: modifiedReq.channels.length + 1
      });
      modifiedReq.changeOverTime = 25;

      const v2: VersionRecord = {
        id: generateId(),
        requirementId: req.id,
        versionNumber: 2,
        snapshot: modifiedReq,
        changeSummary: '新增1个通道，换场时间调整为25分钟',
        createdAt: req.updatedAt,
        createdBy: 'admin'
      };
      versions.push(v2);
    } else {
      versions.push({
        id: generateId(),
        requirementId: req.id,
        versionNumber: 1,
        snapshot: JSON.parse(JSON.stringify(req)),
        changeSummary: '初始版本',
        createdAt: req.createdAt,
        createdBy: 'admin'
      });
    }
  });

  return versions;
}

export function generateMockFilterSnapshots(): FilterSnapshot[] {
  return [
    {
      id: generateId(),
      name: '6月15日演出清单',
      filters: {
        dateFrom: '2026-06-15',
        dateTo: '2026-06-15'
      },
      createdAt: new Date().toISOString()
    },
    {
      id: generateId(),
      name: '待处理冲突',
      filters: {
        status: [RequirementStatus.PENDING, RequirementStatus.CONFLICT]
      },
      createdAt: new Date(Date.now() - 86400000).toISOString()
    }
  ];
}

export function generateMockExportHistory(): ExportRecord[] {
  return [
    {
      id: generateId(),
      filterCriteria: { dateFrom: '2026-06-15', dateTo: '2026-06-15' },
      format: 'pdf',
      fileHash: 'A1B2C3D4',
      recordCount: 3,
      createdAt: new Date(Date.now() - 7200000).toISOString()
    },
    {
      id: generateId(),
      filterCriteria: {},
      format: 'excel',
      fileHash: 'E5F6G7H8',
      recordCount: 8,
      createdAt: new Date(Date.now() - 3600000).toISOString()
    }
  ];
}

export function generateMockGlobalChannels(): Channel[] {
  return Array.from({ length: 32 }, (_, i) => ({
    id: generateId(),
    name: `CH ${String(i + 1).padStart(2, '0')}`,
    type: 'other' as const,
    assignedTo: i < 16 ? `band-${i % 8}` : '',
    order: i + 1
  }));
}

export function generateMockGlobalMonitors(): Monitor[] {
  return Array.from({ length: 12 }, (_, i) => ({
    id: generateId(),
    name: `MON ${String(i + 1).padStart(2, '0')}`,
    position: (['stage_left', 'stage_center', 'stage_right', 'drummer'] as const)[
      i % 4
    ],
    mix: {},
    notes: ''
  }));
}

export function getFullMockData(): {
  requirements: BandRequirement[];
  versions: VersionRecord[];
  filterSnapshots: FilterSnapshot[];
  exportHistory: ExportRecord[];
  globalChannels: Channel[];
  globalMonitors: Monitor[];
} {
  const requirements = generateMockRequirements();
  const versions = generateMockVersions(requirements);

  requirements.forEach((req) => {
    const reqVersions = versions.filter((v) => v.requirementId === req.id);
    if (reqVersions.length > 0) {
      const latestVersion = reqVersions.sort(
        (a, b) => b.versionNumber - a.versionNumber
      )[0];
      Object.assign(req, latestVersion.snapshot);
    }
  });

  return {
    requirements,
    versions,
    filterSnapshots: generateMockFilterSnapshots(),
    exportHistory: generateMockExportHistory(),
    globalChannels: generateMockGlobalChannels(),
    globalMonitors: generateMockGlobalMonitors()
  };
}
