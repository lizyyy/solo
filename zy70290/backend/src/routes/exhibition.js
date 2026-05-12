import express from 'express';
import { 
  createExhibition, 
  updateExhibition, 
  deleteExhibition, 
  getExhibitions, 
  getExhibitionById,
  initDefaultExhibitions 
} from '../services/exhibition.js';

const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    success: true,
    data: getExhibitions()
  });
});

router.get('/:id', (req, res) => {
  const exhibition = getExhibitionById(req.params.id);
  if (!exhibition) {
    return res.status(404).json({
      success: false,
      message: '展区不存在'
    });
  }
  res.json({
    success: true,
    data: exhibition
  });
});

router.post('/', (req, res) => {
  try {
    const { name, description, boundingBox, priority, expectedDuration } = req.body;
    
    if (!name || !boundingBox) {
      return res.status(400).json({
        success: false,
        message: '展区名称和边界框是必需的'
      });
    }
    
    const exhibition = createExhibition({
      name,
      description,
      boundingBox,
      priority,
      expectedDuration
    });
    
    res.json({
      success: true,
      data: exhibition,
      message: '展区创建成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '创建展区失败: ' + error.message,
      error: error.stack
    });
  }
});

router.put('/:id', (req, res) => {
  try {
    const updated = updateExhibition(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({
        success: false,
        message: '展区不存在'
      });
    }
    
    res.json({
      success: true,
      data: updated,
      message: '展区更新成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '更新展区失败: ' + error.message,
      error: error.stack
    });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const deleted = deleteExhibition(req.params.id);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: '展区不存在'
      });
    }
    
    res.json({
      success: true,
      message: '展区删除成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '删除展区失败: ' + error.message,
      error: error.stack
    });
  }
});

router.post('/init-defaults', (req, res) => {
  initDefaultExhibitions();
  res.json({
    success: true,
    message: '已初始化默认展区分组',
    data: getExhibitions()
  });
});

export default router;
