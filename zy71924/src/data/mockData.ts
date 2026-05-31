import { InspectionRecord, CurationNote, LightingScheme } from '../types';

export const mockRecords: InspectionRecord[] = [
  {
    id: '1',
    materialCode: 'ART-001',
    name: '无题 #23',
    location: 'A区-展墙01',
    source: 'first_entry',
    currentStatus: 'normal',
    createdBy: '张明（策展人）',
    createdAt: '2024-05-28 09:30:00',
    updatedBy: '李工（布展）',
    updatedAt: '2024-05-30 14:20:00',
    versions: [
      {
        id: 'v1',
        versionNumber: 1,
        status: 'normal',
        operator: '张明（策展人）',
        operatedAt: '2024-05-28 09:30:00',
        reason: '首次录入，作品就位',
        lightingScheme: '暖白光3000K，角度45度'
      },
      {
        id: 'v2',
        versionNumber: 2,
        status: 'normal',
        operator: '李工（布展）',
        operatedAt: '2024-05-30 14:20:00',
        reason: '灯光微调，确认正常',
        lightingScheme: '暖白光3000K，角度42度'
      }
    ]
  },
  {
    id: '2',
    materialCode: 'ART-002',
    name: '流动的时间',
    location: 'A区-展墙02',
    source: 're_entry',
    currentStatus: 'pending',
    createdBy: '王芳（画廊助理）',
    createdAt: '2024-05-27 10:15:00',
    updatedBy: '李工（布展）',
    updatedAt: '2024-05-30 16:45:00',
    versions: [
      {
        id: 'v1',
        versionNumber: 1,
        status: 'normal',
        operator: '王芳（画廊助理）',
        operatedAt: '2024-05-27 10:15:00',
        reason: '首次进场，作品安装完成',
        lightingScheme: '冷白光4000K，两侧对称'
      },
      {
        id: 'v2',
        versionNumber: 2,
        status: 'abnormal',
        operator: '李工（布展）',
        operatedAt: '2024-05-29 11:30:00',
        reason: '发现画框轻微划痕，待处理',
        lightingScheme: '冷白光4000K，两侧对称'
      },
      {
        id: 'v3',
        versionNumber: 3,
        status: 'pending',
        operator: '李工（布展）',
        operatedAt: '2024-05-30 16:45:00',
        reason: '二次进场修复，待策展人确认',
        lightingScheme: '冷白光4000K，两侧对称'
      }
    ]
  },
  {
    id: '3',
    materialCode: 'ART-003',
    name: '空间装置 #7',
    location: 'B区-中央',
    source: 'first_entry',
    currentStatus: 'abnormal',
    createdBy: '张明（策展人）',
    createdAt: '2024-05-29 08:00:00',
    updatedBy: '张明（策展人）',
    updatedAt: '2024-05-30 11:00:00',
    versions: [
      {
        id: 'v1',
        versionNumber: 1,
        status: 'normal',
        operator: '张明（策展人）',
        operatedAt: '2024-05-29 08:00:00',
        reason: '装置安装完成',
        lightingScheme: '重点照明，聚光10度'
      },
      {
        id: 'v2',
        versionNumber: 2,
        status: 'abnormal',
        operator: '张明（策展人）',
        operatedAt: '2024-05-30 11:00:00',
        reason: '灯光效果不符合预期，需要重新调试',
        lightingScheme: '重点照明，聚光10度'
      }
    ]
  },
  {
    id: '4',
    materialCode: 'ART-004',
    name: '镜像对话',
    location: 'B区-展墙05',
    source: 'manual',
    currentStatus: 'normal',
    createdBy: '王芳（画廊助理）',
    createdAt: '2024-05-28 15:30:00',
    updatedBy: '王芳（画廊助理）',
    updatedAt: '2024-05-28 15:30:00',
    versions: [
      {
        id: 'v1',
        versionNumber: 1,
        status: 'normal',
        operator: '王芳（画廊助理）',
        operatedAt: '2024-05-28 15:30:00',
        reason: '手工补录记录',
        lightingScheme: '环境光，漫反射照明'
      }
    ]
  },
  {
    id: '5',
    materialCode: 'ART-005',
    name: '静物系列',
    location: 'C区-展墙08',
    source: 're_entry',
    currentStatus: 'normal',
    createdBy: '李工（布展）',
    createdAt: '2024-05-26 14:00:00',
    updatedBy: '张明（策展人）',
    updatedAt: '2024-05-30 09:30:00',
    versions: [
      {
        id: 'v1',
        versionNumber: 1,
        status: 'normal',
        operator: '李工（布展）',
        operatedAt: '2024-05-26 14:00:00',
        reason: '首次进场',
        lightingScheme: '暖白光3500K'
      },
      {
        id: 'v2',
        versionNumber: 2,
        status: 'pending',
        operator: '王芳（画廊助理）',
        operatedAt: '2024-05-28 10:00:00',
        reason: '作品调换，需要重新确认',
        lightingScheme: '暖白光3500K'
      },
      {
        id: 'v3',
        versionNumber: 3,
        status: 'normal',
        operator: '张明（策展人）',
        operatedAt: '2024-05-30 09:30:00',
        reason: '二次进场确认，位置调整完成',
        lightingScheme: '暖白光3500K，角度微调'
      }
    ]
  },
  {
    id: '6',
    materialCode: 'ART-006',
    name: '城市记忆',
    location: 'C区-展墙09',
    source: 'first_entry',
    currentStatus: 'pending',
    createdBy: '张明（策展人）',
    createdAt: '2024-05-30 08:30:00',
    updatedBy: '李工（布展）',
    updatedAt: '2024-05-30 15:00:00',
    versions: [
      {
        id: 'v1',
        versionNumber: 1,
        status: 'normal',
        operator: '张明（策展人）',
        operatedAt: '2024-05-30 08:30:00',
        reason: '新作品进场',
        lightingScheme: '待定'
      },
      {
        id: 'v2',
        versionNumber: 2,
        status: 'pending',
        operator: '李工（布展）',
        operatedAt: '2024-05-30 15:00:00',
        reason: '电源线未隐藏，待处理',
        lightingScheme: '待定'
      }
    ]
  },
  {
    id: '7',
    materialCode: 'ART-007',
    name: '抽象三联画',
    location: 'D区-展墙12',
    source: 'first_entry',
    currentStatus: 'normal',
    createdBy: '王芳（画廊助理）',
    createdAt: '2024-05-29 16:00:00',
    updatedBy: '王芳（画廊助理）',
    updatedAt: '2024-05-29 16:00:00',
    versions: [
      {
        id: 'v1',
        versionNumber: 1,
        status: 'normal',
        operator: '王芳（画廊助理）',
        operatedAt: '2024-05-29 16:00:00',
        reason: '安装完成，检查通过',
        lightingScheme: '均匀照明，三灯独立控制'
      }
    ]
  },
  {
    id: '8',
    materialCode: 'ART-008',
    name: '光影雕塑',
    location: 'D区-空间装置区',
    source: 're_entry',
    currentStatus: 'abnormal',
    createdBy: '李工（布展）',
    createdAt: '2024-05-25 11:00:00',
    updatedBy: '张明（策展人）',
    updatedAt: '2024-05-30 12:30:00',
    versions: [
      {
        id: 'v1',
        versionNumber: 1,
        status: 'normal',
        operator: '李工（布展）',
        operatedAt: '2024-05-25 11:00:00',
        reason: '首次安装完成',
        lightingScheme: '多色渐变投影'
      },
      {
        id: 'v2',
        versionNumber: 2,
        status: 'pending',
        operator: '王芳（画廊助理）',
        operatedAt: '2024-05-27 09:00:00',
        reason: '投影设备故障，待维修',
        lightingScheme: '多色渐变投影'
      },
      {
        id: 'v3',
        versionNumber: 3,
        status: 'normal',
        operator: '李工（布展）',
        operatedAt: '2024-05-28 14:00:00',
        reason: '设备修复，二次进场',
        lightingScheme: '多色渐变投影'
      },
      {
        id: 'v4',
        versionNumber: 4,
        status: 'abnormal',
        operator: '张明（策展人）',
        operatedAt: '2024-05-30 12:30:00',
        reason: '投影角度偏差，效果不理想',
        lightingScheme: '多色渐变投影（待调整）'
      }
    ]
  }
];

export const mockCurationNotes: CurationNote[] = [
  {
    id: 'note1',
    title: '策展备注样例 - 常规展',
    content: `【策展备注模板】

一、展墙信息
- 展墙编号：A01-A12
- 承重限制：单幅不超过50kg
- 挂画高度：中心距地145cm

二、灯光规范
- 主光源：轨道射灯3000K
- 照度标准：200-300lux
- 避免：直射反光、明暗反差过大

三、安全检查
- 画钩承重测试
- 电线隐藏处理
- 紧急通道无遮挡`,
    uploadedBy: '系统预置',
    uploadedAt: '2024-05-01 00:00:00',
    isSample: true
  },
  {
    id: 'note2',
    title: '策展备注样例 - 装置展',
    content: `【装置展策展备注】

一、空间规划
- 装置间距：最小1.5米
- 观众动线：顺时针单向流动
- 互动区：地面铺设保护垫

二、电力要求
- 单装置功率：不超过2000W
- 接地保护：必须
- 应急断电：每个区域独立开关

三、应急预案
- 设备故障：备用设备清单
- 人员受伤：急救包位置
- 紧急疏散：集合点标识`,
    uploadedBy: '系统预置',
    uploadedAt: '2024-05-01 00:00:00',
    isSample: true
  }
];

export const mockLightingSchemes: LightingScheme[] = [
  {
    id: 'scheme1',
    version: 'v1.0',
    createdAt: '2024-05-20 10:00:00',
    createdBy: '张明（策展人）',
    content: `A区：全部暖白光3000K
B区：混合照明，装置用聚光
C区：冷白光4000K
D区：氛围照明为主`
  },
  {
    id: 'scheme2',
    version: 'v1.1',
    createdAt: '2024-05-25 15:30:00',
    createdBy: '李工（布展）',
    content: `A区：全部暖白光3000K，角度微调
B区：混合照明，装置用聚光10度
C区：冷白光4000K，增加辅助光源
D区：氛围照明为主，重点作品补光`
  },
  {
    id: 'scheme3',
    version: 'v2.0（当前）',
    createdAt: '2024-05-29 09:00:00',
    createdBy: '张明（策展人）',
    content: `A区：全部暖白光3200K，统一角度45度
B区：混合照明，装置用聚光15度
C区：中性光3500K，墙面均匀照明
D区：氛围照明为主，动态调光`
  }
];
