const { dataStore, saveData, generateId } = require('../data/store');

function getWalls(req, res) {
  try {
    res.json({ success: true, data: dataStore.walls });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

function createWall(req, res) {
  try {
    const { name, width, height, depth, isKidsArea = false, position = { x: 0, y: 0, z: 0 }, rotation = { x: 0, y: 0, z: 0 } } = req.body;
    
    if (!name) {
      return res.status(400).json({ success: false, message: '墙面名称不能为空' });
    }

    const wall = {
      id: generateId(),
      name,
      width: width || 8,
      height: height || 4,
      depth: depth || 0.2,
      isKidsArea,
      position,
      rotation,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    dataStore.walls.push(wall);
    saveData('walls');

    res.json({ success: true, data: wall });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

function importHolds(req, res) {
  try {
    const { holds, wallId } = req.body;
    
    if (!holds || !holds.length) {
      return res.status(400).json({ success: false, message: '岩点数据不能为空' });
    }

    const importedHolds = holds.map(hold => ({
      id: generateId(),
      wallId: wallId || null,
      position: hold.position || { x: 0, y: 0, z: 0 },
      color: hold.color || '#ffffff',
      difficulty: hold.difficulty || 'V0',
      size: hold.size || 'medium',
      type: hold.type || 'jug',
      isUsed: hold.isUsed !== undefined ? hold.isUsed : true,
      notes: hold.notes || '',
      createdAt: new Date().toISOString()
    }));

    dataStore.holds.push(...importedHolds);
    saveData('holds');

    res.json({ 
      success: true, 
      message: `成功导入 ${importedHolds.length} 个岩点`,
      data: importedHolds 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

function importHeatmap(req, res) {
  try {
    const { heatmapData, wallId } = req.body;
    
    if (!heatmapData || !heatmapData.length) {
      return res.status(400).json({ success: false, message: '热区数据不能为空' });
    }

    const importedHeatmap = heatmapData.map(data => ({
      id: generateId(),
      wallId: wallId || null,
      position: data.position || { x: 0, y: 0, z: 0 },
      intensity: data.intensity || 1,
      climberCount: data.climberCount || 0,
      sessionCount: data.sessionCount || 0,
      date: data.date || new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString()
    }));

    dataStore.heatmap.push(...importedHeatmap);
    saveData('heatmap');

    res.json({ 
      success: true, 
      message: `成功导入 ${importedHeatmap.length} 条热区数据`,
      data: importedHeatmap 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

function importFeedback(req, res) {
  try {
    const { feedbackList, wallId } = req.body;
    
    if (!feedbackList || !feedbackList.length) {
      return res.status(400).json({ success: false, message: '反馈数据不能为空' });
    }

    const importedFeedback = feedbackList.map(fb => ({
      id: generateId(),
      wallId: wallId || null,
      memberName: fb.memberName || '匿名',
      memberLevel: fb.memberLevel || 'beginner',
      routeId: fb.routeId || null,
      rating: fb.rating || 3,
      comment: fb.comment || '',
      issues: fb.issues || [],
      date: fb.date || new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString()
    }));

    dataStore.feedback.push(...importedFeedback);
    saveData('feedback');

    res.json({ 
      success: true, 
      message: `成功导入 ${importedFeedback.length} 条会员反馈`,
      data: importedFeedback 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

module.exports = {
  getWalls,
  createWall,
  importHolds,
  importHeatmap,
  importFeedback
};
