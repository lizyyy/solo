export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'archived';

export type TaskSource = 'online_feedback' | 'config_file' | 'manual_edit' | 'other';

export interface Task {
  id: string;
  title: string;
  source: TaskSource;
  sourceDetail: string;
  status: TaskStatus;
  pendingReason: string;
  assignee: string;
  description: string;
  trainingLog: string;
  evaluation: string;
  createdAt: string;
  updatedAt: string;
}

export interface HistoryRecord {
  id: string;
  taskId: string;
  fieldName: string;
  oldValue: string;
  newValue: string;
  modifiedBy: string;
  changeReason: string;
  createdAt: string;
}

export const TaskStatusLabels: Record<TaskStatus, string> = {
  pending: '待处理',
  in_progress: '进行中',
  completed: '已完成',
  archived: '已归档',
};

export const TaskSourceLabels: Record<TaskSource, string> = {
  online_feedback: '线上反馈',
  config_file: '配置文件',
  manual_edit: '手工修改',
  other: '其他',
};

export const TaskStatusColors: Record<TaskStatus, string> = {
  pending: 'bg-amber-100 text-amber-700 border-amber-200',
  in_progress: 'bg-primary-100 text-primary-700 border-primary-200',
  completed: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  archived: 'bg-gray-100 text-gray-700 border-gray-200',
};

export const TaskSourceColors: Record<TaskSource, string> = {
  online_feedback: 'bg-rose-100 text-rose-700 border-rose-200',
  config_file: 'bg-violet-100 text-violet-700 border-violet-200',
  manual_edit: 'bg-orange-100 text-orange-700 border-orange-200',
  other: 'bg-slate-100 text-slate-700 border-slate-200',
};

export const FieldLabels: Record<string, string> = {
  title: '任务标题',
  source: '来源类型',
  sourceDetail: '来源详情',
  status: '任务状态',
  pendingReason: '待处理原因',
  assignee: '负责人',
  description: '任务描述',
  trainingLog: '训练日志',
  evaluation: '评估说明',
};
