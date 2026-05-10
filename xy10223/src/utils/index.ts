import { FermentationStage, DoughType } from '../types';

export const generateId = (): string => {
  return `id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

export const formatDateTime = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
};

export const formatTime = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit'
  });
};

export const getStageName = (stage: FermentationStage): string => {
  const stageNames: Record<FermentationStage, string> = {
    [FermentationStage.PRE_FERMENT]: '预发酵',
    [FermentationStage.BULK_FERMENT]: '基础发酵',
    [FermentationStage.BENCH_REST]: '中间醒发',
    [FermentationStage.FINAL_PROOF]: '最终醒发',
    [FermentationStage.COMPLETED]: '已完成'
  };
  return stageNames[stage];
};

export const getDoughTypeName = (type: DoughType): string => {
  const doughTypeNames: Record<DoughType, string> = {
    [DoughType.WHITE]: '白面团',
    [DoughType.WHOLE_WHEAT]: '全麦面团',
    [DoughType.RYE]: '黑麦面团',
    [DoughType.SOURDOUGH]: '酸面团',
    [DoughType.MULTIGRAIN]: '多谷物面团'
  };
  return doughTypeNames[type];
};

export const getStageColor = (stage: FermentationStage): string => {
  const stageColors: Record<FermentationStage, string> = {
    [FermentationStage.PRE_FERMENT]: '#3B82F6',
    [FermentationStage.BULK_FERMENT]: '#10B981',
    [FermentationStage.BENCH_REST]: '#F59E0B',
    [FermentationStage.FINAL_PROOF]: '#EF4444',
    [FermentationStage.COMPLETED]: '#6B7280'
  };
  return stageColors[stage];
};

export const getNextStage = (currentStage: FermentationStage): FermentationStage | null => {
  const stageOrder: FermentationStage[] = [
    FermentationStage.PRE_FERMENT,
    FermentationStage.BULK_FERMENT,
    FermentationStage.BENCH_REST,
    FermentationStage.FINAL_PROOF,
    FermentationStage.COMPLETED
  ];
  const currentIndex = stageOrder.indexOf(currentStage);
  if (currentIndex < stageOrder.length - 1) {
    return stageOrder[currentIndex + 1];
  }
  return null;
};

export const calculateDuration = (start: string, end: string): string => {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const diffMs = endDate.getTime() - startDate.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  return `${diffHours}小时${diffMinutes}分钟`;
};
