import express from 'express';
import { 
  getAllMissions, 
  getMissionById, 
  createMission, 
  updateMission, 
  deleteMission,
  duplicateMission,
  searchMissions,
  getMissionStats
} from '../utils/dataStore.js';
import { analyzeMission, overrideRisk, revertOverride } from '../utils/rulesEngine.js';

const router = express.Router();

router.get('/', (req, res) => {
  try {
    const missions = getAllMissions();
    const simplified = missions.map(m => ({
      id: m.id,
      name: m.name,
      description: m.description,
      status: m.status,
      summary: m.summary,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
      tags: m.tags,
      waypointCount: m.flightPath?.length || 0,
      restrictedZoneCount: m.restrictedZones?.features?.length || 0,
      batteryCount: m.batteryData?.batteries?.length || 0
    }));
    res.json(simplified);
  } catch (error) {
    console.error('获取任务列表失败:', error);
    res.status(500).json({ error: '获取任务列表失败: ' + error.message });
  }
});

router.get('/stats', (req, res) => {
  try {
    const stats = getMissionStats();
    res.json(stats);
  } catch (error) {
    console.error('获取统计数据失败:', error);
    res.status(500).json({ error: '获取统计数据失败: ' + error.message });
  }
});

router.get('/search', (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim() === '') {
      return res.status(400).json({ error: '请提供搜索关键词' });
    }
    
    const results = searchMissions(q.trim());
    res.json(results);
  } catch (error) {
    console.error('搜索任务失败:', error);
    res.status(500).json({ error: '搜索任务失败: ' + error.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const mission = getMissionById(id);
    
    if (!mission) {
      return res.status(404).json({ error: '任务不存在' });
    }
    
    res.json(mission);
  } catch (error) {
    console.error('获取任务详情失败:', error);
    res.status(500).json({ error: '获取任务详情失败: ' + error.message });
  }
});

router.post('/', (req, res) => {
  try {
    const missionData = req.body;
    const newMission = createMission(missionData);
    res.status(201).json(newMission);
  } catch (error) {
    console.error('创建任务失败:', error);
    res.status(500).json({ error: '创建任务失败: ' + error.message });
  }
});

router.post('/:id/analyze', (req, res) => {
  try {
    const { id } = req.params;
    const { config } = req.body;
    const mission = getMissionById(id);
    
    if (!mission) {
      return res.status(404).json({ error: '任务不存在' });
    }
    
    const analysisData = {
      flightPath: mission.flightPath || [],
      restrictedZones: mission.restrictedZones || { type: 'FeatureCollection', features: [] },
      batteryData: mission.batteryData || { batteries: [], rawData: [] },
      weatherWindow: mission.weatherWindow || {}
    };
    
    const analysisResult = analyzeMission(analysisData, config);
    
    const updatedMission = updateMission(id, {
      risks: analysisResult.risks,
      summary: analysisResult.summary,
      analysisConfig: analysisResult.config,
      status: analysisResult.summary.canFly ? 'ready' : 'needs_attention'
    });
    
    res.json({
      mission: updatedMission,
      analysis: analysisResult
    });
  } catch (error) {
    console.error('分析任务失败:', error);
    res.status(500).json({ error: '分析任务失败: ' + error.message });
  }
});

router.post('/:id/risk/:riskId/override', (req, res) => {
  try {
    const { id, riskId } = req.params;
    const { reason } = req.body;
    const mission = getMissionById(id);
    
    if (!mission) {
      return res.status(404).json({ error: '任务不存在' });
    }
    
    const missionCopy = JSON.parse(JSON.stringify(mission));
    const result = overrideRisk(missionCopy, riskId, reason);
    
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    
    const updatedMission = updateMission(id, {
      risks: missionCopy.risks,
      summary: missionCopy.summary
    });
    
    res.json({
      success: true,
      mission: updatedMission,
      updatedRisk: result.updatedRisk
    });
  } catch (error) {
    console.error('改判风险失败:', error);
    res.status(500).json({ error: '改判风险失败: ' + error.message });
  }
});

router.post('/:id/risk/:riskId/revert', (req, res) => {
  try {
    const { id, riskId } = req.params;
    const mission = getMissionById(id);
    
    if (!mission) {
      return res.status(404).json({ error: '任务不存在' });
    }
    
    const missionCopy = JSON.parse(JSON.stringify(mission));
    const result = revertOverride(missionCopy, riskId);
    
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    
    const updatedMission = updateMission(id, {
      risks: missionCopy.risks,
      summary: missionCopy.summary
    });
    
    res.json({
      success: true,
      mission: updatedMission,
      updatedRisk: result.updatedRisk
    });
  } catch (error) {
    console.error('恢复风险失败:', error);
    res.status(500).json({ error: '恢复风险失败: ' + error.message });
  }
});

router.post('/:id/duplicate', (req, res) => {
  try {
    const { id } = req.params;
    const duplicated = duplicateMission(id);
    
    if (!duplicated) {
      return res.status(404).json({ error: '任务不存在' });
    }
    
    res.status(201).json(duplicated);
  } catch (error) {
    console.error('复制任务失败:', error);
    res.status(500).json({ error: '复制任务失败: ' + error.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const updated = updateMission(id, updates);
    
    if (!updated) {
      return res.status(404).json({ error: '任务不存在' });
    }
    
    res.json(updated);
  } catch (error) {
    console.error('更新任务失败:', error);
    res.status(500).json({ error: '更新任务失败: ' + error.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const deleted = deleteMission(id);
    
    if (!deleted) {
      return res.status(404).json({ error: '任务不存在' });
    }
    
    res.json({ success: true, message: '任务已删除' });
  } catch (error) {
    console.error('删除任务失败:', error);
    res.status(500).json({ error: '删除任务失败: ' + error.message });
  }
});

export default router;
