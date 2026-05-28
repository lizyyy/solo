import type { MissionConfig, DataPacket, Command, VisibilityWindow } from '../../types/mission';
import { generateId } from '../../utils/time';
import { generateVisibilityWindows } from '../../utils/orbit';
import { GROUND_STATIONS } from '../groundStations';
import { PROBES } from '../orbits';

const BASE_TIME = Date.now();
const MISSION_DURATION = 30 * 60 * 1000;

const probe = PROBES[0];
const stations = [GROUND_STATIONS[0], GROUND_STATIONS[1], GROUND_STATIONS[2]];

function generateWindows(): VisibilityWindow[] {
  const windows: VisibilityWindow[] = [];
  
  stations.forEach(station => {
    const stationWindows = generateVisibilityWindows(
      probe.orbitParams,
      station.location,
      BASE_TIME,
      MISSION_DURATION,
      5
    );
    
    stationWindows.forEach(w => {
      windows.push({
        id: generateId(),
        groundStationId: station.id,
        probeId: probe.id,
        startTime: w.startTime,
        endTime: w.endTime,
        maxElevation: w.maxElevation,
        predictedDuration: w.endTime - w.startTime,
        duration: w.endTime - w.startTime,
        bands: station.bands,
        status: 'predicted',
      });
    });
  });
  
  return windows.sort((a, b) => a.startTime - b.startTime);
}

function generatePackets(): DataPacket[] {
  const packets: DataPacket[] = [];
  const types: Array<'science' | 'engineering' | 'telemetry'> = ['science', 'engineering', 'telemetry'];
  const priorities: Array<'critical' | 'high' | 'medium' | 'low'> = ['critical', 'high', 'medium', 'low'];
  
  for (let i = 0; i < 12; i++) {
    const priority = priorities[i % 4];
    const priorityLevel = { critical: 1, high: 2, medium: 3, low: 4 }[priority];
    const descriptions = [
      '火星表面高分辨率图像数据',
      '探测器工程遥测数据',
      '科学载荷实验数据',
      '地面站通信状态数据',
    ];
    packets.push({
      id: `packet-${i + 1}`,
      probeId: probe.id,
      priority,
      priorityLevel,
      size: 200 + Math.floor(Math.random() * 500),
      dataType: types[i % 3],
      description: descriptions[i % 4],
      deadline: BASE_TIME + MISSION_DURATION - 5 * 60 * 1000,
      createdAt: BASE_TIME - 3600000,
      isDownloaded: false,
      lossPenalty: [300, 200, 100, 50][i % 4],
    });
  }
  
  return packets;
}

function generateCommands(): Command[] {
  const priorityLabels: Record<number, 'critical' | 'high' | 'medium' | 'low'> = {
    1: 'critical',
    2: 'high',
    3: 'medium',
    4: 'low',
    5: 'low',
  };
  
  const commands: Command[] = [
    {
      id: 'cmd-1',
      name: '姿态控制校准',
      priority: 1,
      priorityLabel: 'critical',
      size: 512,
      timeout: BASE_TIME + 15 * 60 * 1000,
      timeToLive: 300000,
      description: '校准探测器姿态控制系统，确保轨道精度',
      failureImpact: '后续轨道机动可能出现偏差，影响数据采集质量',
      isSent: false,
      status: 'pending',
      transmittedPercent: 0,
    },
    {
      id: 'cmd-2',
      name: '载荷开机指令',
      priority: 2,
      priorityLabel: 'high',
      size: 256,
      timeout: BASE_TIME + 20 * 60 * 1000,
      timeToLive: 360000,
      description: '启动科学载荷，开始数据采集',
      failureImpact: '科学数据采集将延迟，可能错过关键观测窗口',
      isSent: false,
      status: 'pending',
      transmittedPercent: 0,
    },
    {
      id: 'cmd-3',
      name: '数据存储分区切换',
      priority: 2,
      priorityLabel: 'high',
      size: 128,
      timeout: BASE_TIME + 10 * 60 * 1000,
      timeToLive: 240000,
      description: '切换数据存储到备用分区',
      failureImpact: '新数据可能覆盖未下载的历史数据',
      isSent: false,
      status: 'pending',
      transmittedPercent: 0,
    },
    {
      id: 'cmd-4',
      name: '热控参数调整',
      priority: 3,
      priorityLabel: 'medium',
      size: 384,
      timeout: BASE_TIME + 25 * 60 * 1000,
      timeToLive: 420000,
      description: '调整探测器热控系统参数',
      failureImpact: '设备温度可能超出安全范围',
      isSent: false,
      status: 'pending',
      transmittedPercent: 0,
    },
    {
      id: 'cmd-5',
      name: '软件补丁上传',
      priority: 3,
      priorityLabel: 'medium',
      size: 2048,
      timeout: BASE_TIME + 28 * 60 * 1000,
      timeToLive: 480000,
      description: '上传测控软件补丁，修复已知问题',
      failureImpact: '软件bug可能影响后续指令执行',
      isSent: false,
      status: 'pending',
      transmittedPercent: 0,
    },
    {
      id: 'cmd-6',
      name: '遥测参数配置',
      priority: 4,
      priorityLabel: 'low',
      size: 640,
      timeout: BASE_TIME + MISSION_DURATION,
      timeToLive: 600000,
      description: '更新遥测参数采样频率',
      failureImpact: '遥测数据更新频率降低',
      isSent: false,
      status: 'pending',
      transmittedPercent: 0,
    },
  ];
  
  return commands;
}

export const MISSION1_CONFIG: MissionConfig = {
  id: 'mission-1',
  name: '天问一号数据回传任务',
  description: '在30分钟内完成天问一号探测器的数据下载和指令补发。合理安排地面站窗口，优先下载关键科学数据并发送高优先级指令。',
  difficulty: 'normal',
  duration: MISSION_DURATION,
  maxScore: 1000,
  scoreMultiplier: 1.0,
  errorMultiplier: 1.0,
  groundStationIds: stations.map(s => s.id),
  probeId: probe.id,
  probes: [probe],
  visibilityWindows: [],
  dataPackets: [],
  commands: [],
  initialPackets: [],
  initialCommands: [],
};

export const MISSION1_WINDOWS = generateWindows();
export const MISSION1_PACKETS = generatePackets();
export const MISSION1_COMMANDS = generateCommands();
