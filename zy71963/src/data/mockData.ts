import { Task, HistoryRecord } from '../types';

const now = new Date();
const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
const threeDaysAgo = new Date(now.getTime() - 72 * 60 * 60 * 1000);

export const mockTasks: Task[] = [
  {
    id: 'TASK-001',
    title: '用户反馈模型识别率低 - 图像分类任务',
    source: 'online_feedback',
    sourceDetail: '客服工单 #20240528-001',
    status: 'in_progress',
    pendingReason: '等待配置文件更新',
    assignee: '张工',
    description: '用户反馈在特定场景下图像识别准确率下降，需要重新训练模型。线上反馈先到，配置文件后续补充。',
    trainingLog: `Epoch 1/10: loss=0.852, accuracy=0.723
Epoch 2/10: loss=0.621, accuracy=0.789
Epoch 3/10: loss=0.512, accuracy=0.823
Epoch 4/10: loss=0.445, accuracy=0.845
Epoch 5/10: loss=0.398, accuracy=0.862`,
    evaluation: '模型在验证集上准确率达到 86.2%，相比基线提升 3.5%。建议继续训练 5 个 epoch 观察是否还有提升空间。',
    createdAt: threeDaysAgo.toISOString(),
    updatedAt: dayAgo.toISOString(),
  },
  {
    id: 'TASK-002',
    title: '补充配置文件 - 语音识别模型',
    source: 'config_file',
    sourceDetail: '配置文件 v2.3 补充提交',
    status: 'pending',
    pendingReason: '补材料：配置文件晚到，无实质修改',
    assignee: '李工',
    description: '配置文件比线上反馈晚到半天，属于补材料，不需要重新训练。',
    trainingLog: `# 原有训练日志保持不变
Epoch 1/20: loss=1.23, wer=0.35
...
Epoch 20/20: loss=0.45, wer=0.12`,
    evaluation: '配置文件已补充，与原有训练参数一致，无需重新评估。',
    createdAt: twoDaysAgo.toISOString(),
    updatedAt: twoDaysAgo.toISOString(),
  },
  {
    id: 'TASK-003',
    title: '手工调整训练日志 - NLP 情感分析',
    source: 'manual_edit',
    sourceDetail: '算法负责人要求调整日志格式',
    status: 'completed',
    pendingReason: '',
    assignee: '王工',
    description: '手工修改训练日志格式，使其符合新的评估标准。修改前后的差异已记录在历史中。',
    trainingLog: `=== 训练开始 ===
模型: BERT-base
数据集: 100k 标注样本
优化器: AdamW, lr=2e-5

Epoch 1: train_loss=0.523, val_acc=0.812
Epoch 2: train_loss=0.389, val_acc=0.856
Epoch 3: train_loss=0.312, val_acc=0.878
Epoch 4: train_loss=0.267, val_acc=0.889
Epoch 5: train_loss=0.234, val_acc=0.895

=== 训练结束 ===
最终准确率: 89.5%`,
    evaluation: '手工调整后的日志格式更清晰，便于后续评估和对比。评估说明与明细一致。',
    createdAt: threeDaysAgo.toISOString(),
    updatedAt: dayAgo.toISOString(),
  },
  {
    id: 'TASK-004',
    title: '目标检测模型优化',
    source: 'online_feedback',
    sourceDetail: '用户反馈小目标漏检',
    status: 'pending',
    pendingReason: '等待数据集标注完成',
    assignee: '赵工',
    description: '用户反馈在安防场景下，小目标（如远处的行人、车辆）存在漏检问题。需要收集更多数据并重新训练。',
    trainingLog: '',
    evaluation: '',
    createdAt: dayAgo.toISOString(),
    updatedAt: dayAgo.toISOString(),
  },
  {
    id: 'TASK-005',
    title: 'OCR 模型训练 - 票据识别',
    source: 'other',
    sourceDetail: '产品需求 #PRD-2024-0515',
    status: 'archived',
    pendingReason: '',
    assignee: '陈工',
    description: '针对票据识别场景的 OCR 模型专项训练。已完成并上线。',
    trainingLog: `训练完成，指标如下:
- 字符识别准确率: 98.7%
- 字段提取准确率: 95.2%
- 平均推理时间: 120ms`,
    evaluation: '模型指标达到预期，已上线运行稳定。归档保存。',
    createdAt: threeDaysAgo.toISOString(),
    updatedAt: twoDaysAgo.toISOString(),
  },
];

export const mockHistory: HistoryRecord[] = [
  {
    id: 'HIST-001',
    taskId: 'TASK-001',
    fieldName: 'status',
    oldValue: 'pending',
    newValue: 'in_progress',
    modifiedBy: '张工',
    changeReason: '开始训练，配置文件已收到',
    createdAt: dayAgo.toISOString(),
  },
  {
    id: 'HIST-002',
    taskId: 'TASK-001',
    fieldName: 'trainingLog',
    oldValue: 'Epoch 1/10: loss=0.852, accuracy=0.723',
    newValue: `Epoch 1/10: loss=0.852, accuracy=0.723
Epoch 2/10: loss=0.621, accuracy=0.789
Epoch 3/10: loss=0.512, accuracy=0.823
Epoch 4/10: loss=0.445, accuracy=0.845
Epoch 5/10: loss=0.398, accuracy=0.862`,
    modifiedBy: '张工',
    changeReason: '更新训练进度，完成 5 个 epoch',
    createdAt: dayAgo.toISOString(),
  },
  {
    id: 'HIST-003',
    taskId: 'TASK-003',
    fieldName: 'trainingLog',
    oldValue: `Epoch 1: 0.523, 0.812
Epoch 2: 0.389, 0.856
Epoch 3: 0.312, 0.878`,
    newValue: `=== 训练开始 ===
模型: BERT-base
数据集: 100k 标注样本
优化器: AdamW, lr=2e-5

Epoch 1: train_loss=0.523, val_acc=0.812
Epoch 2: train_loss=0.389, val_acc=0.856
Epoch 3: train_loss=0.312, val_acc=0.878
Epoch 4: train_loss=0.267, val_acc=0.889
Epoch 5: train_loss=0.234, val_acc=0.895

=== 训练结束 ===
最终准确率: 89.5%`,
    modifiedBy: '王工',
    changeReason: '按照新规范调整日志格式，补充详细信息',
    createdAt: twoDaysAgo.toISOString(),
  },
  {
    id: 'HIST-004',
    taskId: 'TASK-003',
    fieldName: 'status',
    oldValue: 'in_progress',
    newValue: 'completed',
    modifiedBy: '王工',
    changeReason: '日志格式调整完成，评估通过',
    createdAt: dayAgo.toISOString(),
  },
  {
    id: 'HIST-005',
    taskId: 'TASK-002',
    fieldName: 'sourceDetail',
    oldValue: '',
    newValue: '配置文件 v2.3 补充提交',
    modifiedBy: '李工',
    changeReason: '补材料：配置文件晚到，无实质修改',
    createdAt: twoDaysAgo.toISOString(),
  },
  {
    id: 'HIST-006',
    taskId: 'TASK-005',
    fieldName: 'status',
    oldValue: 'completed',
    newValue: 'archived',
    modifiedBy: '陈工',
    changeReason: '任务完成超过 7 天，归档保存',
    createdAt: twoDaysAgo.toISOString(),
  },
];
