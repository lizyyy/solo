import express from 'express';
import store from '../store.js';
import { STAGES, STAGE_DESCRIPTIONS } from '../utils/status.js';

const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    success: true,
    data: {
      currentStage: store.businessStatus.currentStage,
      currentStageDescription: STAGE_DESCRIPTIONS[store.businessStatus.currentStage],
      currentBlock: store.businessStatus.currentBlock,
      currentSuggestions: store.businessStatus.suggestions,
      dataSummary: store.businessStatus.dataSummary,
      stages: STAGES,
      stageDescriptions: STAGE_DESCRIPTIONS
    }
  });
});

router.get('/history', (req, res) => {
  const { limit } = req.query;
  let history = [...store.businessStatus.stageHistory];
  
  history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  
  if (limit) {
    history = history.slice(0, parseInt(limit));
  }
  
  res.json({
    success: true,
    data: history
  });
});

router.get('/pipeline/status', (req, res) => {
  const validPoints = store.stopPoints.filter(p => p.status === 'valid');
  
  const pipelineStatus = [
    {
      stage: STAGES.IDLE,
      name: '系统初始化',
      status: 'completed',
      required: [],
      satisfied: true
    },
    {
      stage: STAGES.DATA_IMPORT,
      name: '数据导入',
      status: validPoints.length > 0 ? 'completed' : 'pending',
      required: ['有效停留点数据'],
      satisfied: validPoints.length > 0
    },
    {
      stage: STAGES.EXHIBITION_GROUPING,
      name: '展区分组',
      status: store.exhibitions.length > 0 ? 'completed' : 'pending',
      required: ['至少一个展区配置'],
      satisfied: store.exhibitions.length > 0
    },
    {
      stage: STAGES.HEATMAP_CALCULATION,
      name: '热区计算',
      status: store.heatmaps.length > 0 ? 'completed' : 'pending',
      required: ['有效数据 + 展区配置'],
      satisfied: validPoints.length > 0 && store.exhibitions.length > 0
    },
    {
      stage: STAGES.SECURITY_RECOMMENDATION,
      name: '安保建议',
      status: store.securityPatrols.length > 0 ? 'completed' : 'pending',
      required: ['热区数据'],
      satisfied: store.heatmaps.length > 0
    },
    {
      stage: STAGES.COMPLETED,
      name: '流程完成',
      status: store.securityPatrols.length > 0 ? 'completed' : 'pending',
      required: ['所有步骤完成'],
      satisfied: store.securityPatrols.length > 0
    }
  ];
  
  res.json({
    success: true,
    data: {
      pipelineStatus,
      currentStage: store.businessStatus.currentStage,
      currentStageDescription: STAGE_DESCRIPTIONS[store.businessStatus.currentStage],
      blockages: store.businessStatus.currentBlock 
        ? [{ stage: store.businessStatus.currentStage, block: store.businessStatus.currentBlock }]
        : []
    }
  });
});

router.get('/dashboard/summary', (req, res) => {
  const validPoints = store.stopPoints.filter(p => p.status === 'valid');
  const invalidPoints = store.stopPoints.filter(p => p.status === 'invalid');
  const openProblems = store.problems.filter(p => p.status === 'open');
  const latestHeatmap = store.heatmaps.length > 0 
    ? store.heatmaps[store.heatmaps.length - 1] 
    : null;
  const latestRecommendation = store.securityPatrols.length > 0 
    ? store.securityPatrols[store.securityPatrols.length - 1] 
    : null;
  
  res.json({
    success: true,
    data: {
      stopPoints: {
        total: store.stopPoints.length,
        valid: validPoints.length,
        invalid: invalidPoints.length,
        lastImport: store.uploadHistory.length > 0 
          ? store.uploadHistory[store.uploadHistory.length - 1] 
          : null
      },
      exhibitions: {
        total: store.exhibitions.length,
        list: store.exhibitions.map(e => ({
          id: e.id,
          name: e.name,
          priority: e.priority,
          boundingBox: e.boundingBox
        }))
      },
      heatmaps: {
        total: store.heatmaps.length,
        latest: latestHeatmap ? {
          id: latestHeatmap.id,
          timestamp: latestHeatmap.timestamp,
          overallStats: latestHeatmap.overallStats
        } : null
      },
      security: {
        total: store.securityPatrols.length,
        latest: latestRecommendation ? {
          id: latestRecommendation.id,
          timestamp: latestRecommendation.timestamp,
          overallAssessment: latestRecommendation.overallAssessment,
          alertCount: latestRecommendation.alerts.length
        } : null
      },
      problems: {
        total: store.problems.length,
        open: openProblems.length,
        bySeverity: {
          error: store.problems.filter(p => p.severity === 'error' && p.status === 'open').length,
          warning: store.problems.filter(p => p.severity === 'warning' && p.status === 'open').length,
          info: store.problems.filter(p => p.severity === 'info' && p.status === 'open').length
        },
        recent: openProblems.slice(0, 5)
      },
      businessStatus: {
        currentStage: store.businessStatus.currentStage,
        currentStageDescription: STAGE_DESCRIPTIONS[store.businessStatus.currentStage],
        currentBlock: store.businessStatus.currentBlock,
        currentSuggestions: store.businessStatus.suggestions
      }
    }
  });
});

export default router;
