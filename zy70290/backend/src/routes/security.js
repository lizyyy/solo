import express from 'express';
import { 
  generatePatrolRecommendations, 
  getLatestRecommendation, 
  getRecommendationById,
  PATROL_STRATEGIES 
} from '../services/security.js';

const router = express.Router();

router.post('/generate', (req, res) => {
  try {
    const { heatmapId } = req.body;
    const result = generatePatrolRecommendations(heatmapId);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '生成安保建议失败: ' + error.message,
      error: error.stack
    });
  }
});

router.get('/latest', (req, res) => {
  const recommendation = getLatestRecommendation();
  if (!recommendation) {
    return res.status(404).json({
      success: false,
      message: '没有可用的安保巡逻建议'
    });
  }
  
  res.json({
    success: true,
    data: recommendation
  });
});

router.get('/:id', (req, res) => {
  const recommendation = getRecommendationById(req.params.id);
  if (!recommendation) {
    return res.status(404).json({
      success: false,
      message: '安保建议不存在'
    });
  }
  
  res.json({
    success: true,
    data: recommendation
  });
});

router.get('/config/strategies', (req, res) => {
  res.json({
    success: true,
    data: PATROL_STRATEGIES
  });
});

export default router;
