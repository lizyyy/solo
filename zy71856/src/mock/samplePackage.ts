import type { RawRecord } from '@/types/import';
import type { GateStudentOperation } from '@/types/gate';

const baseTime = Date.now() - 3600000;

export const mockRawRecords: RawRecord[] = [
  {
    id: 'rec-001',
    timestamp: baseTime,
    type: 'operation',
    title: '开机检查',
    description: '学生启动闸门控制系统，检查电源指示灯',
    operator: '张三',
    recordType: 'normal',
    metadata: {
      stepId: 'step-1',
      power: true,
      communication: 'normal'
    }
  },
  {
    id: 'rec-002',
    timestamp: baseTime + 65000,
    type: 'operation',
    title: '参数设置 - 开启高度',
    description: '设置闸门开启高度为50cm',
    operator: '张三',
    recordType: 'normal',
    metadata: {
      stepId: 'step-2',
      opening: 50,
      expectedOpening: 50
    }
  },
  {
    id: 'rec-003',
    timestamp: baseTime + 70000,
    type: 'operation',
    title: '参数设置 - 开启高度（重复）',
    description: '设置闸门开启高度为50cm（重复记录）',
    operator: '张三',
    recordType: 'normal',
    metadata: {
      stepId: 'step-2',
      opening: 50,
      expectedOpening: 50,
      duplicate: true
    }
  },
  {
    id: 'rec-004',
    timestamp: baseTime + 100000,
    type: 'operation',
    title: '参数设置 - 运行速度',
    description: '设置运行速度为10cm/s',
    operator: '张三',
    recordType: 'normal',
    metadata: {
      stepId: 'step-2',
      speed: 12,
      expectedSpeed: 10
    }
  },
  {
    id: 'rec-005',
    timestamp: baseTime + 160000,
    type: 'operation',
    title: '手动操作 - 闸门上升',
    description: '手动控制闸门上升至指定高度',
    operator: '张三',
    recordType: 'normal',
    metadata: {
      stepId: 'step-3',
      operation: 'lift',
      duration: 45,
      expectedDuration: 50,
      dragStart: { x: 100, y: 200 },
      dragEnd: { x: 102, y: 350 },
      cameraX: 15,
      cameraY: 25,
      cameraZ: 80,
      rotation: 45,
      expectedParams: {
        duration: 50
      }
    }
  },
  {
    id: 'rec-006',
    timestamp: baseTime + 220000,
    type: 'operation',
    title: '手动操作 - 闸门下降（拖拽丢失）',
    description: '手动控制闸门下降，检测到拖拽状态丢失',
    operator: '张三',
    recordType: 'normal',
    metadata: {
      stepId: 'step-3',
      operation: 'lower',
      duration: 30,
      expectedDuration: 50,
      dragStart: { x: 150, y: 300 },
      cameraX: 15,
      cameraY: 25,
      cameraZ: 80,
      rotation: 45,
      expectedParams: {
        duration: 50
      }
    }
  },
  {
    id: 'rec-007',
    timestamp: baseTime + 221000,
    type: 'attachment',
    title: '手动操作现场照片（晚到）',
    description: '现场操作照片，延迟到达',
    operator: '系统',
    attachmentDelay: 8000,
    metadata: {
      stepId: 'step-3',
      attachmentType: 'photo',
      originalEventId: 'rec-006'
    }
  },
  {
    id: 'rec-008',
    timestamp: baseTime + 280000,
    type: 'operation',
    title: '自动运行 - 模式切换',
    description: '切换至自动运行模式',
    operator: '张三',
    recordType: 'normal',
    metadata: {
      stepId: 'step-4',
      mode: 'auto',
      cameraX: 0,
      cameraY: 0,
      cameraZ: 100,
      rotation: 0
    }
  },
  {
    id: 'rec-009',
    timestamp: baseTime + 285000,
    type: 'operation',
    title: '自动运行 - 闸门自动控制',
    description: '闸门在自动模式下运行',
    operator: '张三',
    recordType: 'normal',
    metadata: {
      stepId: 'step-4',
      autoSequence: ['open', 'hold', 'close'],
      duration: 150,
      expectedDuration: 180,
      expectedParams: {
        duration: 180
      }
    }
  },
  {
    id: 'rec-010',
    timestamp: baseTime + 450000,
    type: 'operation',
    title: '故障处理 - 紧急停止',
    description: '模拟故障，学生按下紧急停止按钮',
    operator: '张三',
    recordType: 'normal',
    metadata: {
      stepId: 'step-5',
      faultType: 'overload',
      responseTime: 3,
      expectedResponseTime: 5,
      expectedParams: {
        duration: 90
      },
      duration: 85
    }
  },
  {
    id: 'rec-011',
    timestamp: baseTime + 455000,
    type: 'correction',
    title: '故障处理记录（人工更正）',
    description: '培训老师更正：故障识别正确，但处理流程有误',
    operator: '李老师',
    isCorrection: true,
    correctionOf: 'rec-010',
    metadata: {
      stepId: 'step-5',
      corrected: true,
      correctionReason: '故障识别正确，但恢复流程缺少安全确认步骤',
      correctedScore: 10
    }
  },
  {
    id: 'rec-012',
    timestamp: baseTime + 540000,
    type: 'operation',
    title: '关机整理',
    description: '学生关闭系统，整理现场',
    operator: '张三',
    recordType: 'normal',
    metadata: {
      stepId: 'step-6',
      shutdown: true,
      cleanup: true,
      documentation: true,
      duration: 55,
      expectedDuration: 60,
      expectedParams: {
        duration: 60
      }
    }
  },
  {
    id: 'rec-013',
    timestamp: baseTime + 500,
    type: 'video',
    title: '操作视频 - 开头',
    description: '培训操作视频开始',
    operator: '系统',
    metadata: {
      videoId: 'video-gate-001',
      startTime: 0
    }
  }
];

export const mockGateOperations: GateStudentOperation[] = [
  {
    stepId: 'step-1',
    timestamp: baseTime,
    duration: 58,
    parameters: {},
    rawData: {
      description: '开机检查操作记录',
      power: true,
      communication: 'normal',
      expectedParams: {
        duration: 60
      }
    }
  },
  {
    stepId: 'step-2',
    timestamp: baseTime + 65000,
    duration: 95,
    parameters: {
      opening: 50,
      speed: 12
    },
    rawData: {
      description: '参数设置操作记录',
      expectedParams: {
        opening: 50,
        speed: 10,
        duration: 90
      }
    }
  },
  {
    stepId: 'step-3',
    timestamp: baseTime + 160000,
    duration: 65,
    parameters: {
      opening: 48,
      cameraX: 15,
      cameraY: 25,
      cameraZ: 80,
      rotation: 45
    },
    rawData: {
      description: '手动操作闸门上升',
      dragStart: { x: 100, y: 200 },
      dragEnd: { x: 102, y: 350 },
      expectedParams: {
        opening: 50,
        duration: 120
      }
    }
  },
  {
    stepId: 'step-3',
    timestamp: baseTime + 220000,
    duration: 35,
    parameters: {
      opening: 25,
      cameraX: 15,
      cameraY: 25,
      cameraZ: 80,
      rotation: 45
    },
    rawData: {
      description: '手动操作闸门下降（拖拽丢失）',
      dragStart: { x: 150, y: 300 },
      expectedParams: {
        opening: 0,
        duration: 120
      }
    }
  },
  {
    stepId: 'step-4',
    timestamp: baseTime + 280000,
    duration: 160,
    parameters: {
      mode: 1,
      cameraX: 0,
      cameraY: 0,
      cameraZ: 100,
      rotation: 0
    },
    rawData: {
      description: '自动运行模式',
      autoSequence: ['open', 'hold', 'close'],
      expectedParams: {
        duration: 180
      }
    }
  },
  {
    stepId: 'step-5',
    timestamp: baseTime + 450000,
    duration: 85,
    parameters: {
      faultResponse: 3,
      recoveryTime: 45
    },
    rawData: {
      description: '故障处理',
      faultType: 'overload',
      expectedParams: {
        duration: 120
      }
    }
  },
  {
    stepId: 'step-6',
    timestamp: baseTime + 540000,
    duration: 55,
    parameters: {
      shutdown: 1,
      cleanup: 1,
      documentation: 1
    },
    rawData: {
      description: '关机整理',
      expectedParams: {
        duration: 60
      }
    }
  }
];

export function generateMockPackage(): { records: RawRecord[]; operations: GateStudentOperation[]; studentName: string } {
  return {
    records: [...mockRawRecords],
    operations: [...mockGateOperations],
    studentName: '张三'
  };
}
