import store from '../store.js';
import { v4 as uuidv4 } from 'uuid';

const STAGES = {
  IDLE: 'idle',
  DATA_IMPORT: 'data_import',
  EXHIBITION_GROUPING: 'exhibition_grouping',
  HEATMAP_CALCULATION: 'heatmap_calculation',
  SECURITY_RECOMMENDATION: 'security_recommendation',
  COMPLETED: 'completed'
};

const STAGE_DESCRIPTIONS = {
  [STAGES.IDLE]: '系统空闲，等待数据导入',
  [STAGES.DATA_IMPORT]: '正在导入观众停留点数据',
  [STAGES.EXHIBITION_GROUPING]: '正在进行展区分组',
  [STAGES.HEATMAP_CALCULATION]: '正在计算热区数据',
  [STAGES.SECURITY_RECOMMENDATION]: '正在生成安保巡逻建议',
  [STAGES.COMPLETED]: '处理流程已完成'
};

function updateBusinessStatus(stage, block = null, suggestions = []) {
  store.businessStatus.currentStage = stage;
  store.businessStatus.currentBlock = block;
  store.businessStatus.suggestions = suggestions;
  store.businessStatus.stageHistory.push({
    id: uuidv4(),
    stage,
    description: STAGE_DESCRIPTIONS[stage],
    timestamp: new Date().toISOString(),
    block,
    suggestions
  });
}

function updateDataSummary() {
  const validPoints = store.stopPoints.filter(p => p.status === 'valid');
  const invalidPoints = store.stopPoints.filter(p => p.status === 'invalid');
  
  store.businessStatus.dataSummary = {
    totalStopPoints: store.stopPoints.length,
    validStopPoints: validPoints.length,
    invalidStopPoints: invalidPoints.length,
    totalExhibitions: store.exhibitions.length,
    heatmapGenerations: store.heatmapHistory.length
  };
}

function addProblem(type, severity, source, message, rawData = null) {
  const problem = {
    id: uuidv4(),
    type,
    severity,
    source,
    message,
    rawData,
    status: 'open',
    createdAt: new Date().toISOString(),
    resolvedAt: null,
    resolution: null
  };
  
  store.problems.push(problem);
  return problem;
}

function getStageDescription(stage) {
  return STAGE_DESCRIPTIONS[stage] || '未知状态';
}

export {
  STAGES,
  STAGE_DESCRIPTIONS,
  updateBusinessStatus,
  updateDataSummary,
  addProblem,
  getStageDescription
};
