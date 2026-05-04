const { dataStore, saveData, generateId } = require('../data/store');

function createRoute(req, res) {
  try {
    const { name, holdIds, difficulty, color, wallId, notes = '' } = req.body;
    
    if (!name || !holdIds || !holdIds.length) {
      return res.status(400).json({ 
        success: false, 
        message: '路线名称和岩点列表不能为空' 
      });
    }

    const route = {
      id: generateId(),
      name,
      holdIds,
      difficulty: difficulty || 'V0',
      color: color || '#ff0000',
      wallId: wallId || null,
      notes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    dataStore.routes.push(route);
    saveData('routes');

    res.json({ success: true, data: route });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

function getRoutes(req, res) {
  try {
    const { wallId } = req.query;
    let routes = [...dataStore.routes];
    
    if (wallId) {
      routes = routes.filter(r => r.wallId === wallId);
    }

    res.json({ success: true, data: routes });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

function getRouteById(req, res) {
  try {
    const { id } = req.params;
    const route = dataStore.routes.find(r => r.id === id);
    
    if (!route) {
      return res.status(404).json({ success: false, message: '路线不存在' });
    }

    res.json({ success: true, data: route });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

function updateRoute(req, res) {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const index = dataStore.routes.findIndex(r => r.id === id);
    if (index === -1) {
      return res.status(404).json({ success: false, message: '路线不存在' });
    }

    dataStore.routes[index] = {
      ...dataStore.routes[index],
      ...updates,
      id,
      updatedAt: new Date().toISOString()
    };

    saveData('routes');
    res.json({ success: true, data: dataStore.routes[index] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

function deleteRoute(req, res) {
  try {
    const { id } = req.params;
    const index = dataStore.routes.findIndex(r => r.id === id);
    
    if (index === -1) {
      return res.status(404).json({ success: false, message: '路线不存在' });
    }

    dataStore.routes.splice(index, 1);
    saveData('routes');
    
    res.json({ success: true, message: '路线已删除' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

module.exports = {
  createRoute,
  getRoutes,
  getRouteById,
  updateRoute,
  deleteRoute
};
