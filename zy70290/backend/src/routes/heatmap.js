import express from 'express';
import { 
  calculateHeatmap, 
  getLatestHeatmap, 
  getHeatmapById, 
  getHeatmapHistory,
  HEAT_THRESHOLDS 
} from '../services/heatmap.js';

const router = express.Router();

router.post('/calculate', (req, res) => {
  try {
    const result = calculateHeatmap(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '热区计算失败: ' + error.message,
      error: error.stack
    });
  }
});

router.get('/latest', (req, res) => {
  const heatmap = getLatestHeatmap();
  if (!heatmap) {
    return res.status(404).json({
      success: false,
      message: '没有可用的热区数据'
    });
  }
  
  res.json({
    success: true,
    data: heatmap
  });
});

router.get('/:id', (req, res) => {
  const heatmap = getHeatmapById(req.params.id);
  if (!heatmap) {
    return res.status(404).json({
      success: false,
      message: '热区数据不存在'
    });
  }
  
  res.json({
    success: true,
    data: heatmap
  });
});

router.get('/', (req, res) => {
  res.json({
    success: true,
    data: getHeatmapHistory()
  });
});

router.get('/config/thresholds', (req, res) => {
  res.json({
    success: true,
    data: HEAT_THRESHOLDS
  });
});

export default router;
