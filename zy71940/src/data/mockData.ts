import type { ImportData } from '@/types';

export const mockOrbitData: ImportData = {
  type: 'ORBIT_ELEMENTS',
  name: '卫星轨道预报数据-20240601',
  timeSystem: 'UTC',
  windows: [
    {
      satelliteId: 'SAT-001',
      satelliteName: '天宫一号',
      startTime: new Date(Date.now() + 1 * 60 * 60 * 1000).toISOString(),
      endTime: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
      description: '数据接收窗口 - 轨道根数计算',
      priority: 1
    },
    {
      satelliteId: 'SAT-002',
      satelliteName: '北斗三号',
      startTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      endTime: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(),
      description: '测控通信窗口 - 轨道根数计算',
      priority: 2
    },
    {
      satelliteId: 'SAT-003',
      satelliteName: '高分七号',
      startTime: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
      endTime: new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString(),
      description: '图像传输窗口 - 轨道根数计算',
      priority: 3
    },
    {
      satelliteId: 'SAT-004',
      satelliteName: '风云四号',
      startTime: new Date(Date.now() + 10 * 60 * 60 * 1000).toISOString(),
      endTime: new Date(Date.now() + 13 * 60 * 60 * 1000).toISOString(),
      description: '气象数据下行 - 轨道根数计算',
      priority: 2
    },
    {
      satelliteId: 'SAT-005',
      satelliteName: '墨子号',
      startTime: new Date(Date.now() + 14 * 60 * 60 * 1000).toISOString(),
      endTime: new Date(Date.now() + 17 * 60 * 60 * 1000).toISOString(),
      description: '量子密钥分发 - 轨道根数计算',
      priority: 1
    }
  ]
};

export const mockTelemetryData: ImportData = {
  type: 'TELEMETRY',
  name: '遥测实时数据-20240601',
  timeSystem: 'LOCAL',
  windows: [
    {
      satelliteId: 'SAT-006',
      satelliteName: '实践二十号',
      startTime: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
      endTime: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
      description: '姿态遥测接收 - 实时遥测片段',
      priority: 2
    },
    {
      satelliteId: 'SAT-007',
      satelliteName: '鹊桥号',
      startTime: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
      endTime: new Date(Date.now() + 11 * 60 * 60 * 1000).toISOString(),
      description: '中继通信监控 - 实时遥测片段',
      priority: 1
    }
  ]
};

export function getMockImportDataString(): string {
  return JSON.stringify(mockOrbitData, null, 2);
}
