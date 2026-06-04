import type { TemperatureRecord, Sensor, ExceptionRecord, OldCalibration } from '@/types'

const baseTime = new Date('2026-06-04T10:00:00').getTime()

const time = (minutes: number) => new Date(baseTime + minutes * 60000).toISOString()

export const mockSensors: Sensor[] = [
  {
    id: 'sns-001',
    sensorNo: 'SNS-BR-001',
    location: '桥面北段-第1伸缩缝',
    installDate: '2025-03-15',
    calibrationHistory: [
      { id: 'cal-001', date: '2026-01-15', value: 1.0, standard: '2025版' },
      { id: 'cal-002', date: '2026-04-01', value: 1.0, standard: '2025版' }
    ]
  },
  {
    id: 'sns-002',
    sensorNo: 'SNS-BR-002',
    location: '桥面中段-第3伸缩缝',
    installDate: '2025-03-15',
    calibrationHistory: [
      { id: 'cal-003', date: '2026-01-20', value: 1.0, standard: '2025版' },
      { id: 'cal-004', date: '2026-04-05', value: 1.0, standard: '2025版' }
    ]
  },
  {
    id: 'sns-003',
    sensorNo: 'SNS-BR-003',
    location: '桥面南段-第5伸缩缝',
    installDate: '2024-11-20',
    calibrationHistory: [
      { id: 'cal-005', date: '2026-02-10', value: 1.0, standard: '2025版' },
      { id: 'cal-006', date: '2026-05-01', value: 1.0, standard: '2025版' }
    ],
    oldCalibrationData: [
      {
        id: 'old-001',
        date: '2025-06-15',
        oldStandard: '2020版旧口径',
        value: 0.98,
        remark: '2025版标准实施前的历史校准数据，方向定义与新版不同'
      }
    ]
  }
]

export const mockOldCalibrations: Record<string, OldCalibration[]> = {
  'SNS-BR-003': mockSensors[2].oldCalibrationData || []
}

export const mockRecords: TemperatureRecord[] = [
  {
    id: 'rec-001',
    recordNo: 'REC-001',
    type: 'normal',
    startTime: time(0),
    endTime: time(30),
    startTemp: 23.5,
    endTemp: 38.2,
    tempDiff: 14.7,
    directionMark: '负方向',
    sensorId: 'SNS-BR-001',
    status: 'success',
    estimatedValue: -12.40,
    normalizedDirection: 'negative',
    operationHistory: [
      {
        id: 'op-001',
        type: 'import',
        operator: '何工',
        description: '导入温度校准记录',
        timestamp: time(0)
      },
      {
        id: 'op-002',
        type: 'calibrate',
        operator: '系统',
        description: '口径校验通过：负方向 → 负方向',
        timestamp: time(1)
      },
      {
        id: 'op-003',
        type: 'rerun',
        operator: '系统',
        description: '估算完成：伸缩量 -12.40mm',
        timestamp: time(2)
      }
    ],
    createdAt: time(0),
    updatedAt: time(2)
  },
  {
    id: 'rec-002',
    recordNo: 'REC-002',
    type: 'left',
    startTime: time(5),
    endTime: time(40),
    startTemp: 21.0,
    endTemp: 35.8,
    tempDiff: 14.8,
    directionMark: '向左',
    sensorId: 'SNS-BR-002',
    status: 'manual_corrected',
    estimatedValue: -12.50,
    normalizedDirection: 'negative',
    operationHistory: [
      {
        id: 'op-004',
        type: 'import',
        operator: '何工',
        description: '导入温度校准记录',
        timestamp: time(5)
      },
      {
        id: 'op-005',
        type: 'calibrate',
        operator: '系统',
        description: '口径校验：发现"向左"标记，标记为待复核（不自动转为负方向）',
        timestamp: time(6)
      },
      {
        id: 'op-006',
        type: 'correct',
        operator: '何工',
        description: '人工修正方向：向左 → 负方向',
        timestamp: time(20),
        oldValue: '向左',
        newValue: '负方向'
      },
      {
        id: 'op-007',
        type: 'rerun',
        operator: '何工',
        description: '重跑估算完成：伸缩量 -12.50mm',
        timestamp: time(25)
      }
    ],
    createdAt: time(5),
    updatedAt: time(25)
  },
  {
    id: 'rec-003',
    recordNo: 'REC-003',
    type: 'supplement',
    startTime: time(10),
    endTime: time(45),
    startTemp: 25.1,
    endTemp: 39.7,
    tempDiff: 14.6,
    directionMark: '负方向',
    sensorId: 'SNS-BR-003',
    status: 'supplemented',
    estimatedValue: -12.30,
    normalizedDirection: 'negative',
    operationHistory: [
      {
        id: 'op-008',
        type: 'import',
        operator: '何工',
        description: '导入温度校准记录（无传感器编号）',
        timestamp: time(10)
      },
      {
        id: 'op-009',
        type: 'supplement',
        operator: '何工',
        description: '补录传感器编号：SNS-BR-003，自动关联历史口径数据',
        timestamp: time(30),
        oldValue: null,
        newValue: 'SNS-BR-003'
      },
      {
        id: 'op-010',
        type: 'rerun',
        operator: '系统',
        description: '补录旧口径后重算完成：伸缩量 -12.30mm',
        timestamp: time(31)
      }
    ],
    oldCalibrationData: mockSensors[2].oldCalibrationData,
    createdAt: time(10),
    updatedAt: time(31)
  }
]

export const mockExceptions: ExceptionRecord[] = [
  {
    id: 'exc-001',
    recordId: 'rec-002',
    recordNo: 'REC-002',
    exceptionType: 'direction_mismatch',
    status: 'pending_review',
    sensorId: 'SNS-BR-002',
    description: '方向口径不统一：现场师傅填写"向左"，需实验老师复核是否等同于"负方向"',
    operator: '系统',
    createdAt: time(6),
    updatedAt: time(6)
  },
  {
    id: 'exc-002',
    recordId: 'rec-003',
    recordNo: 'REC-003',
    exceptionType: 'supplemented',
    status: 'supplemented',
    sensorId: 'SNS-BR-003',
    description: '缺失传感器编号后补录，已关联SNS-BR-003的2020版旧口径数据',
    operator: '何工',
    createdAt: time(10),
    updatedAt: time(30)
  }
]

export const stepDescriptions = [
  { step: 1, name: '导入温度校准记录', description: '批量导入现场师傅提交的温度校准数据' },
  { step: 2, name: '补录传感器编号', description: '何工核对并补录传感器编号，追溯历史口径' },
  { step: 3, name: '更新异常工况表', description: '异常记录联动更新，待复核记录转交实验老师' }
]
