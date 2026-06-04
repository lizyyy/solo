import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import path from 'path';
import { fileURLToPath } from 'url';
import type {
  MaintenanceScreenshot,
  SamplingInterval,
  CavitationCalculation,
  ChangeRecord,
  ExperimentReview,
  ReviewTask,
  User,
} from '../../shared/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface DatabaseSchema {
  screenshots: MaintenanceScreenshot[];
  samplingIntervals: SamplingInterval[];
  calculations: CavitationCalculation[];
  changeRecords: ChangeRecord[];
  reviews: ExperimentReview[];
  reviewTasks: ReviewTask[];
  users: User[];
}

const dbPath = path.join(__dirname, 'db.json');

const defaultData: DatabaseSchema = {
  screenshots: [],
  samplingIntervals: [],
  calculations: [],
  changeRecords: [],
  reviews: [],
  reviewTasks: [],
  users: [],
};

export const db = new Low<DatabaseSchema>(new JSONFile<DatabaseSchema>(dbPath), defaultData);

export async function initDatabase() {
  await db.read();
  
  if (db.data.screenshots.length === 0) {
    db.data = generateMockData();
    await db.write();
  }
  
  return db;
}

function generateMockData(): DatabaseSchema {
  const now = new Date();
  const users: User[] = [
    { id: 'user-1', name: '林老师', role: 'teacher', avatar: '👨‍🔬' },
    { id: 'user-2', name: '王质检员', role: 'inspector', avatar: '🔍' },
    { id: 'user-3', name: '管理员', role: 'admin', avatar: '👤' },
  ];

  const screenshots: MaintenanceScreenshot[] = [
    {
      id: 'shot-1',
      fileName: '维修群截图_20240601_1430.png',
      fileHash: 'hash-abc123',
      fileSize: 1024000,
      uploadTime: new Date(now.getTime() - 86400000 * 3).toISOString(),
      uploader: 'user-1',
      ocrData: '泵站A-01 压力: 0.32MPa 流量: 120m³/h 采样时间: 2024-06-01 14:30:00 温度: 25℃',
      imageUrl: '/mock/shot1.svg',
      extractedData: {
        pumpId: 'pump-a01',
        pressure: 0.32,
        flowRate: 120,
        sampleTime: '2024-06-01T14:30:00',
        temperature: 25,
      },
      status: 'processed',
      calculationIds: ['calc-1'],
    },
    {
      id: 'shot-2',
      fileName: '维修群截图_20240601_1500.png',
      fileHash: 'hash-def456',
      fileSize: 1056000,
      uploadTime: new Date(now.getTime() - 86400000 * 3).toISOString(),
      uploader: 'user-1',
      ocrData: '泵站A-01 压力: 0.30MPa 流量: 115m³/h 采样时间: 2024-06-01 15:00:00 温度: 26℃',
      imageUrl: '/mock/shot2.svg',
      extractedData: {
        pumpId: 'pump-a01',
        pressure: 0.30,
        flowRate: 115,
        sampleTime: '2024-06-01T15:00:00',
        temperature: 26,
      },
      status: 'processed',
      calculationIds: ['calc-1'],
    },
    {
      id: 'shot-3',
      fileName: '维修群截图_20240601_1600.png',
      fileHash: 'hash-ghi789',
      fileSize: 987000,
      uploadTime: new Date(now.getTime() - 86400000 * 3).toISOString(),
      uploader: 'user-1',
      ocrData: '泵站A-01 压力: 0.28MPa 流量: 110m³/h 采样时间: 2024-06-01 16:00:00 温度: 27℃',
      imageUrl: '/mock/shot3.svg',
      extractedData: {
        pumpId: 'pump-a01',
        pressure: 0.28,
        flowRate: 110,
        sampleTime: '2024-06-01T16:00:00',
        temperature: 27,
      },
      status: 'processed',
      calculationIds: ['calc-1', 'calc-2'],
    },
    {
      id: 'shot-4',
      fileName: '维修群截图_20240602_0900.png',
      fileHash: 'hash-jkl012',
      fileSize: 1123000,
      uploadTime: new Date(now.getTime() - 86400000 * 2).toISOString(),
      uploader: 'user-1',
      ocrData: '泵站B-02 压力: 0.45MPa 流量: 180m³/h 采样时间: 2024-06-02 09:00:00 温度: 24℃',
      imageUrl: '/mock/shot4.svg',
      extractedData: {
        pumpId: 'pump-b02',
        pressure: 0.45,
        flowRate: 180,
        sampleTime: '2024-06-02T09:00:00',
        temperature: 24,
      },
      status: 'processed',
      calculationIds: ['calc-3'],
    },
  ];

  const samplingIntervals: SamplingInterval[] = [
    {
      id: 'interval-1',
      pumpId: 'pump-a01',
      startTime: '2024-06-01T08:00:00',
      endTime: '2024-06-01T18:00:00',
      intervalMinutes: 30,
      description: '6月1日泵站A-01常规采样，每30分钟一次',
      creator: 'user-1',
      createTime: new Date(now.getTime() - 86400000 * 3).toISOString(),
      updateTime: new Date(now.getTime() - 86400000 * 3).toISOString(),
      version: 1,
      calculationIds: ['calc-1'],
    },
    {
      id: 'interval-2',
      pumpId: 'pump-b02',
      startTime: '2024-06-02T08:00:00',
      endTime: '2024-06-02T18:00:00',
      intervalMinutes: 15,
      description: '6月2日泵站B-02加密采样，每15分钟一次',
      creator: 'user-1',
      createTime: new Date(now.getTime() - 86400000 * 2).toISOString(),
      updateTime: new Date(now.getTime() - 86400000 * 2).toISOString(),
      version: 1,
      calculationIds: ['calc-3'],
    },
  ];

  const calculations: CavitationCalculation[] = [
    {
      id: 'calc-1',
      pumpId: 'pump-a01',
      name: '泵站A-01 6月1日汽蚀风险计算',
      screenshotIds: ['shot-1', 'shot-2', 'shot-3'],
      samplingIntervalIds: ['interval-1'],
      status: 'completed',
      riskLevel: 'medium',
      riskScore: 62,
      parameters: {
        pressure: [0.32, 0.30, 0.28],
        flowRate: [120, 115, 110],
        temperatures: [25, 26, 27],
        sampleTimes: [
          '2024-06-01T14:30:00',
          '2024-06-01T15:00:00',
          '2024-06-01T16:00:00',
        ],
        missingIntervals: [
          {
            start: '2024-06-01T15:30:00',
            end: '2024-06-01T16:00:00',
            duration: 30,
            source: 'screenshot',
          },
        ],
      },
      result: {
        npshAvailable: 2.8,
        npshRequired: 2.2,
        cavitationProbability: 0.35,
        affectedAreas: ['叶轮入口', '吸入室'],
        recommendations: [
          '建议检查入口过滤器是否堵塞',
          '考虑增加吸入压力',
          '下周进行复查检测',
        ],
      },
      remark: '初始计算，注意15:30缺失数据',
      createdAt: new Date(now.getTime() - 86400000 * 2).toISOString(),
      createdBy: 'user-1',
      updatedAt: new Date(now.getTime() - 86400000 * 1).toISOString(),
      updatedBy: 'user-1',
    },
    {
      id: 'calc-2',
      pumpId: 'pump-a01',
      name: '泵站A-01 补充测试计算',
      screenshotIds: ['shot-3'],
      samplingIntervalIds: [],
      status: 'pending_review',
      riskLevel: 'high',
      riskScore: 78,
      parameters: {
        pressure: [0.28, 0.25, 0.22],
        flowRate: [110, 105, 98],
        temperatures: [27, 28, 29],
        sampleTimes: [
          '2024-06-01T16:00:00',
          '2024-06-01T16:30:00',
          '2024-06-01T17:00:00',
        ],
        missingIntervals: [
          {
            start: '2024-06-01T17:00:00',
            end: '2024-06-01T17:30:00',
            duration: 30,
            source: 'screenshot',
          },
        ],
      },
      result: {
        npshAvailable: 1.8,
        npshRequired: 2.2,
        cavitationProbability: 0.72,
        affectedAreas: ['叶轮入口', '吸入室', '前盖板'],
        recommendations: [
          '立即停机检查',
          '检测入口压力管线',
          '安排维修人员现场勘查',
        ],
      },
      remark: '高压测试后补充数据，待质检员复核缺失时间',
      createdAt: new Date(now.getTime() - 86400000 * 1).toISOString(),
      createdBy: 'user-1',
      updatedAt: new Date(now.getTime() - 86400000 * 1).toISOString(),
      updatedBy: 'user-1',
      reviewAssignee: 'user-2',
    },
    {
      id: 'calc-3',
      pumpId: 'pump-b02',
      name: '泵站B-02 6月2日汽蚀风险计算',
      screenshotIds: ['shot-4'],
      samplingIntervalIds: ['interval-2'],
      status: 'draft',
      riskLevel: 'low',
      riskScore: 25,
      parameters: {
        pressure: [0.45, 0.44, 0.46],
        flowRate: [180, 178, 182],
        temperatures: [24, 24, 25],
        sampleTimes: [
          '2024-06-02T09:00:00',
          '2024-06-02T09:15:00',
          '2024-06-02T09:30:00',
        ],
        missingIntervals: [],
      },
      result: {
        npshAvailable: 4.5,
        npshRequired: 2.0,
        cavitationProbability: 0.08,
        affectedAreas: [],
        recommendations: ['运行状态良好，继续按计划监测'],
      },
      remark: '',
      createdAt: new Date(now.getTime() - 3600000).toISOString(),
      createdBy: 'user-1',
      updatedAt: new Date(now.getTime() - 3600000).toISOString(),
      updatedBy: 'user-1',
    },
  ];

  const changeRecords: ChangeRecord[] = [
    {
      id: 'change-1',
      entityType: 'calculation',
      entityId: 'calc-1',
      fieldName: 'remark',
      oldValue: '初始计算',
      newValue: '初始计算，注意15:30缺失数据',
      changeReason: '补充说明缺失数据情况，便于后续复核',
      changedBy: 'user-1',
      changedAt: new Date(now.getTime() - 86400000 * 1.5).toISOString(),
      affectedResults: ['calc-1'],
    },
    {
      id: 'change-2',
      entityType: 'calculation',
      entityId: 'calc-1',
      fieldName: 'result.recommendations',
      oldValue: JSON.stringify(['建议检查入口过滤器', '考虑增加吸入压力']),
      newValue: JSON.stringify([
        '建议检查入口过滤器是否堵塞',
        '考虑增加吸入压力',
        '下周进行复查检测',
      ]),
      changeReason: '根据最新运行数据增加复查建议',
      changedBy: 'user-1',
      changedAt: new Date(now.getTime() - 86400000 * 1).toISOString(),
      affectedResults: ['calc-1'],
    },
    {
      id: 'change-3',
      entityType: 'screenshot',
      entityId: 'shot-3',
      fieldName: 'extractedData.pressure',
      oldValue: 0.29,
      newValue: 0.28,
      changeReason: 'OCR识别修正，人工核实原始截图',
      changedBy: 'user-1',
      changedAt: new Date(now.getTime() - 86400000 * 2.5).toISOString(),
      affectedResults: ['calc-1', 'calc-2'],
    },
    {
      id: 'change-4',
      entityType: 'sampling_interval',
      entityId: 'interval-1',
      fieldName: 'intervalMinutes',
      oldValue: 60,
      newValue: 30,
      changeReason: '更正采样间隔，原始记录为每30分钟',
      changedBy: 'user-1',
      changedAt: new Date(now.getTime() - 86400000 * 2.8).toISOString(),
      affectedResults: ['calc-1'],
    },
    {
      id: 'change-5',
      entityType: 'calculation',
      entityId: 'calc-2',
      fieldName: 'status',
      oldValue: 'draft',
      newValue: 'pending_review',
      changeReason: '提交质检员复核缺失的半小时数据',
      changedBy: 'user-1',
      changedAt: new Date(now.getTime() - 86400000 * 0.8).toISOString(),
      affectedResults: ['calc-2'],
    },
  ];

  const reviewTasks: ReviewTask[] = [
    {
      id: 'task-1',
      calculationId: 'calc-2',
      type: 'missing_interval',
      description: '采样时间缺失半小时（2024-06-01 17:00-17:30），请质检员复核',
      status: 'pending',
      assignee: 'user-2',
      createdAt: new Date(now.getTime() - 86400000 * 0.8).toISOString(),
      missingInterval: {
        start: '2024-06-01T17:00:00',
        end: '2024-06-01T17:30:00',
        duration: 30,
        source: 'screenshot',
      },
    },
  ];

  const reviews: ExperimentReview[] = [
    {
      id: 'review-1',
      calculationId: 'calc-1',
      decisions: [
        {
          dataPointId: 'dp-1',
          keepReason: '数据趋势稳定，虽缺15:30但前后数据可佐证',
          missingMaterials: ['15:30原始截图'],
          nextAction: 'teacher',
          assignee: 'user-1',
        },
        {
          dataPointId: 'dp-2',
          keepReason: '压力值在正常波动范围内',
          missingMaterials: [],
          nextAction: 'none',
        },
      ],
      reportContent:
        '## 实验复盘：泵站A-01 6月1日\n\n### 数据质量评估\n本次计算共3个有效数据点，缺失1个采样点（15:30）。整体数据趋势稳定，压力从0.32MPa缓慢下降至0.28MPa，符合预期运行规律。\n\n### 风险分析\n汽蚀风险等级：**中等**（风险评分62分）\n- NPSH可用值：2.8m\n- NPSH必需值：2.2m\n- 汽蚀概率：35%\n\n### 关键决策\n1. **数据点1（14:30）**：保留。数据完整，作为基准值。\n2. **数据点2（15:00）**：保留。与趋势一致。\n3. **数据点3（16:00）**：保留。虽缺15:30但前后逻辑通顺，已标注待补。\n\n### 缺失材料\n- 15:30维修群截图 - 请林老师补充\n\n### 下一步行动\n| 责任人 | 任务 | 截止时间 |\n|--------|------|----------|\n| 👨‍🔬 林老师 | 查找15:30缺失截图或说明原因 | 2024-06-05 |\n| 🔍 王质检员 | 复核本次计算结果 | 2024-06-06 |\n\n### 建议措施\n1. 检查入口过滤器是否堵塞\n2. 考虑优化入口管线设计\n3. 下周进行超声波检测确认汽蚀情况',
      createdAt: new Date(now.getTime() - 86400000 * 0.5).toISOString(),
      createdBy: 'user-1',
    },
  ];

  return {
    screenshots,
    samplingIntervals,
    calculations,
    changeRecords,
    reviews,
    reviewTasks,
    users,
  };
}

export async function saveDb() {
  await db.write();
}
