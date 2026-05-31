import type { Classroom, Record, ScoreSheet } from '@/types';

export const mockClassrooms: Classroom[] = [
  {
    id: 'class-001',
    name: '2024春-医学图像处理公开课',
    createdAt: '2024-03-15T09:00:00Z',
    status: 'active',
  },
  {
    id: 'class-002',
    name: '2024春-骨骼解剖实验课',
    createdAt: '2024-03-10T14:00:00Z',
    status: 'archived',
  },
];

export const mockRecords: Record[] = [
  {
    id: 'rec-001',
    classroomId: 'class-001',
    type: 'operation',
    content: '学生A提交：误操作记录 - 早到15分钟，提前启动了标注软件',
    materialType: 'supplement',
    timestamp: '2024-03-15T08:45:00Z',
    operator: '学生A',
  },
  {
    id: 'rec-002',
    classroomId: 'class-001',
    type: 'operation',
    content: '操作记录：第3组演示时执行了视角重置操作',
    materialType: 'conclusion_change',
    timestamp: '2024-03-15T10:20:00Z',
    operator: '助教B',
    annotation: {
      id: 'ann-001',
      recordId: 'rec-002',
      anomalyType: 'view_reset',
      explanation: '视角重置属于演示误操作，但不影响最终评分，因为是在练习环节发生。操作人已重新完成正确流程。',
      annotatedAt: '2024-03-15T10:25:00Z',
      annotator: '王老师',
    },
  },
  {
    id: 'rec-003',
    classroomId: 'class-001',
    type: 'script',
    content: '演示脚本变更：第5步增加了"确认标注结果"环节',
    materialType: 'conclusion_change',
    timestamp: '2024-03-15T11:00:00Z',
    operator: '助教C',
  },
  {
    id: 'rec-004',
    classroomId: 'class-001',
    type: 'score',
    content: '补传评分表：第2组评分表晚补，评分无变更',
    materialType: 'supplement',
    timestamp: '2024-03-15T12:30:00Z',
    operator: '助教B',
    annotation: {
      id: 'ann-002',
      recordId: 'rec-004',
      anomalyType: 'normal',
      explanation: '评分表为课后补传，分数与现场记录一致，属于材料补充，不影响结论。',
      annotatedAt: '2024-03-15T12:35:00Z',
      annotator: '王老师',
    },
  },
  {
    id: 'rec-005',
    classroomId: 'class-001',
    type: 'note',
    content: '演示脚本手工改动：第3组的脚本第4行有修改痕迹',
    materialType: 'supplement',
    timestamp: '2024-03-15T14:00:00Z',
    operator: '学生D',
  },
];

export const mockScoreSheets: ScoreSheet[] = [
  {
    id: 'sheet-001',
    classroomId: 'class-001',
    name: '第2组评分表',
    versions: [
      {
        id: 'ver-001',
        version: 1,
        content: `第2组评分表
==========
成员：张三、李四、王五
项目1：骨骼定位 - 85分
项目2：标注精度 - 90分
项目3：操作规范 - 80分
总分：255分
结论：合格`,
        uploadedAt: '2024-03-15T12:30:00Z',
        uploader: '助教B',
      },
      {
        id: 'ver-002',
        version: 2,
        content: `第2组评分表（修正版）
==========
成员：张三、李四、王五
项目1：骨骼定位 - 85分
项目2：标注精度 - 92分
项目3：操作规范 - 80分
备注：项目2分数修正，原因为漏计一个标注点
总分：257分
结论：合格`,
        uploadedAt: '2024-03-15T14:30:00Z',
        uploader: '王老师',
      },
    ],
  },
  {
    id: 'sheet-002',
    classroomId: 'class-001',
    name: '第3组评分表',
    versions: [
      {
        id: 'ver-003',
        version: 1,
        content: `第3组评分表
==========
成员：赵六、钱七、孙八
项目1：骨骼定位 - 78分
项目2：标注精度 - 85分
项目3：操作规范 - 70分
备注：演示期间发生视角重置
总分：233分
结论：合格`,
        uploadedAt: '2024-03-15T11:30:00Z',
        uploader: '助教C',
      },
    ],
  },
];
