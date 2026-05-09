const express = require('express');
const { initDatabase } = require('./database');
const services = require('./services');
const rules = require('./rules');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

function getPerformedBy(req) {
  return req.headers['x-operator'] || 'anonymous';
}

function handleError(res, error) {
  console.error('API Error:', error);
  res.status(400).json({
    success: false,
    error: error.message
  });
}

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/rules', (req, res) => {
  try {
    const allRules = rules.getAllRules();
    res.json({ success: true, data: allRules });
  } catch (error) {
    handleError(res, error);
  }
});

app.put('/api/rules/:name', (req, res) => {
  try {
    const { value } = req.body;
    if (value === undefined || value === null) {
      throw new Error('必须提供规则值');
    }
    const updated = rules.updateRule(req.params.name, String(value), getPerformedBy(req));
    res.json({ success: true, data: updated });
  } catch (error) {
    handleError(res, error);
  }
});

app.get('/api/bus-routes', (req, res) => {
  try {
    const routes = services.getBusRoutes();
    res.json({ success: true, data: routes });
  } catch (error) {
    handleError(res, error);
  }
});

app.post('/api/bus-routes', (req, res) => {
  try {
    const { route_number, vehicle_number, driver_name } = req.body;
    if (!route_number || !vehicle_number) {
      throw new Error('必须提供线路号和车辆号');
    }
    const route = services.createBusRoute(route_number, vehicle_number, driver_name, getPerformedBy(req));
    res.status(201).json({ success: true, data: route });
  } catch (error) {
    handleError(res, error);
  }
});

app.get('/api/storage-points', (req, res) => {
  try {
    const points = services.getStoragePoints();
    res.json({ success: true, data: points });
  } catch (error) {
    handleError(res, error);
  }
});

app.post('/api/lost-items', (req, res) => {
  try {
    const { item_name, found_time, photos } = req.body;
    if (!item_name) {
      throw new Error('必须提供物品名称');
    }
    if (!photos || photos.length === 0) {
      throw new Error('必须至少提供一张照片');
    }
    const item = services.registerLostItem(req.body, getPerformedBy(req));
    res.status(201).json({ success: true, data: item });
  } catch (error) {
    handleError(res, error);
  }
});

app.get('/api/lost-items', (req, res) => {
  try {
    const filters = {};
    if (req.query.status) filters.status = req.query.status;
    if (req.query.route_number) filters.route_number = req.query.route_number;
    if (req.query.vehicle_number) filters.vehicle_number = req.query.vehicle_number;
    if (req.query.item_name) filters.item_name = req.query.item_name;
    if (req.query.item_category) filters.item_category = req.query.item_category;
    if (req.query.current_storage_point_id) filters.current_storage_point_id = req.query.current_storage_point_id;
    
    const items = services.getLostItems(filters);
    res.json({ success: true, data: items });
  } catch (error) {
    handleError(res, error);
  }
});

app.get('/api/lost-items/:id', (req, res) => {
  try {
    const item = services.getLostItemById(req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, error: '失物不存在' });
    }
    res.json({ success: true, data: item });
  } catch (error) {
    handleError(res, error);
  }
});

app.post('/api/lost-items/:id/bind-route', (req, res) => {
  try {
    const { bus_route_id } = req.body;
    if (!bus_route_id) {
      throw new Error('必须提供线路车辆ID');
    }
    const item = services.bindBusRoute(req.params.id, bus_route_id, getPerformedBy(req));
    res.json({ success: true, data: item });
  } catch (error) {
    handleError(res, error);
  }
});

app.post('/api/lost-items/:id/transfer', (req, res) => {
  try {
    const { to_storage_point_id, reason, notes } = req.body;
    if (!to_storage_point_id) {
      throw new Error('必须提供目标保管点ID');
    }
    const item = services.transferStorage(
      req.params.id,
      to_storage_point_id,
      reason,
      notes,
      getPerformedBy(req)
    );
    res.json({ success: true, data: item });
  } catch (error) {
    handleError(res, error);
  }
});

app.post('/api/lost-items/:id/confirm-arrival', (req, res) => {
  try {
    const item = services.confirmStorageArrival(req.params.id, getPerformedBy(req));
    res.json({ success: true, data: item });
  } catch (error) {
    handleError(res, error);
  }
});

app.get('/api/lost-items/:id/history', (req, res) => {
  try {
    const history = services.getItemFullHistory(req.params.id);
    if (!history) {
      return res.status(404).json({ success: false, error: '失物不存在' });
    }
    res.json({ success: true, data: history });
  } catch (error) {
    handleError(res, error);
  }
});

app.post('/api/claims', (req, res) => {
  try {
    const { lost_item_id, claimant_name, claimant_phone } = req.body;
    if (!lost_item_id || !claimant_name || !claimant_phone) {
      throw new Error('必须提供失物ID、认领人姓名和电话');
    }
    const claim = services.createClaim(lost_item_id, req.body, getPerformedBy(req));
    res.status(201).json({ success: true, data: claim });
  } catch (error) {
    handleError(res, error);
  }
});

app.get('/api/claims', (req, res) => {
  try {
    const filters = {};
    if (req.query.status) filters.status = req.query.status;
    if (req.query.lost_item_id) filters.lost_item_id = req.query.lost_item_id;
    if (req.query.claimant_phone) filters.claimant_phone = req.query.claimant_phone;
    
    const claims = services.getClaims(filters);
    res.json({ success: true, data: claims });
  } catch (error) {
    handleError(res, error);
  }
});

app.get('/api/claims/:id', (req, res) => {
  try {
    const claim = services.getClaimById(req.params.id);
    if (!claim) {
      return res.status(404).json({ success: false, error: '认领申请不存在' });
    }
    res.json({ success: true, data: claim });
  } catch (error) {
    handleError(res, error);
  }
});

app.post('/api/claims/:id/review', (req, res) => {
  try {
    const { approved, review_notes } = req.body;
    if (approved === undefined || approved === null) {
      throw new Error('必须提供审核结果');
    }
    const claim = services.reviewClaim(
      req.params.id,
      Boolean(approved),
      review_notes,
      getPerformedBy(req)
    );
    res.json({ success: true, data: claim });
  } catch (error) {
    handleError(res, error);
  }
});

app.post('/api/claims/:id/confirm-pickup', (req, res) => {
  try {
    const claim = services.confirmPickup(req.params.id, getPerformedBy(req));
    res.json({ success: true, data: claim });
  } catch (error) {
    handleError(res, error);
  }
});

app.post('/api/process-overdue', (req, res) => {
  try {
    const results = services.processOverdueItems(getPerformedBy(req));
    res.json({ 
      success: true, 
      data: {
        processed_count: results.length,
        details: results
      }
    });
  } catch (error) {
    handleError(res, error);
  }
});

app.get('/api/audit-logs', (req, res) => {
  try {
    const logs = rules.getAuditLogs(req.query.entity_type, req.query.entity_id);
    res.json({ success: true, data: logs });
  } catch (error) {
    handleError(res, error);
  }
});

app.get('/api/statuses', (req, res) => {
  res.json({
    success: true,
    data: {
      item_statuses: rules.ITEM_STATUSES,
      claim_statuses: rules.CLAIM_STATUSES
    }
  });
});

async function startServer() {
  await initDatabase();
  console.log('数据库初始化完成');
  
  app.listen(PORT, () => {
    console.log(`公交失物招领API服务已启动`);
    console.log(`服务地址: http://localhost:${PORT}`);
    console.log(`健康检查: http://localhost:${PORT}/api/health`);
  });
}

startServer().catch(err => {
  console.error('启动失败:', err);
  process.exit(1);
});
