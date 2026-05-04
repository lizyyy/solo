const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

const { initDatabase, getDatabase, saveDatabase } = require('./database');
const { 
  parseGPX, 
  parseRoadConditionCSV, 
  parsePhotoIndexCSV,
  saveGPXToDatabase,
  saveRoadConditionsToDatabase,
  savePhotosToDatabase
} = require('./file-import');
const {
  analyzeBatchRisks,
  getHighRiskSegments,
  getSegmentRiskDetails,
  overruleCondition,
  getBatchStatistics,
  RISK_TYPES
} = require('./risk-analysis');
const {
  exportMarkdownReport,
  exportJsonAudit,
  EXPORT_DIR
} = require('./exporter');

const app = express();
const PORT = process.env.PORT || 3001;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 静态文件服务
app.use('/exports', express.static(EXPORT_DIR));
app.use(express.static(path.join(__dirname, '../client/build')));

// Multer 配置 - 用于文件上传
const upload = multer({
  dest: path.join(__dirname, '../uploads'),
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.gpx', '.csv'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('不支持的文件类型'), false);
    }
  }
});

// 确保目录存在
const fs = require('fs');
const UPLOAD_DIR = path.join(__dirname, '../uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// API 路由

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 获取所有勘察批次
app.get('/api/batches', (req, res) => {
  try {
    const db = getDatabase();
    const result = db.exec(`
      SELECT id, name, description, created_at, updated_at 
      FROM inspection_batches 
      ORDER BY created_at DESC
    `);
    
    let batches = [];
    if (result.length > 0 && result[0].values.length > 0) {
      batches = result[0].values.map(row => ({
        id: row[0],
        name: row[1],
        description: row[2],
        created_at: row[3],
        updated_at: row[4]
      }));
    }
    
    res.json({ success: true, data: batches });
  } catch (error) {
    console.error('获取批次列表失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 创建新的勘察批次
app.post('/api/batches', (req, res) => {
  try {
    const { name, description } = req.body;
    
    if (!name) {
      return res.status(400).json({ success: false, error: '批次名称不能为空' });
    }
    
    const db = getDatabase();
    const batchId = uuidv4();
    
    db.run(`
      INSERT INTO inspection_batches (id, name, description)
      VALUES (?, ?, ?)
    `, [batchId, name, description || '']);
    
    saveDatabase();
    
    res.json({ 
      success: true, 
      data: { 
        id: batchId, 
        name, 
        description: description || '',
        created_at: new Date().toISOString()
      } 
    });
  } catch (error) {
    console.error('创建批次失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取单个批次详情
app.get('/api/batches/:id', (req, res) => {
  try {
    const { id } = req.params;
    const db = getDatabase();
    
    // 获取批次基本信息
    const batchResult = db.exec(`
      SELECT id, name, description, created_at, updated_at 
      FROM inspection_batches 
      WHERE id = ?
    `, [id]);
    
    if (batchResult.length === 0 || batchResult[0].values.length === 0) {
      return res.status(404).json({ success: false, error: '批次不存在' });
    }
    
    const batch = {
      id: batchResult[0].values[0][0],
      name: batchResult[0].values[0][1],
      description: batchResult[0].values[0][2],
      created_at: batchResult[0].values[0][3],
      updated_at: batchResult[0].values[0][4]
    };
    
    // 获取统计信息
    const stats = getBatchStatistics(id);
    
    res.json({ 
      success: true, 
      data: {
        batch,
        statistics: stats
      }
    });
  } catch (error) {
    console.error('获取批次详情失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 删除批次
app.delete('/api/batches/:id', (req, res) => {
  try {
    const { id } = req.params;
    const db = getDatabase();
    
    // 检查批次是否存在
    const batchResult = db.exec(`SELECT id FROM inspection_batches WHERE id = ?`, [id]);
    if (batchResult.length === 0 || batchResult[0].values.length === 0) {
      return res.status(404).json({ success: false, error: '批次不存在' });
    }
    
    // 级联删除相关数据
    db.run(`DELETE FROM photos WHERE batch_id = ?`, [id]);
    db.run(`DELETE FROM road_conditions WHERE batch_id = ?`, [id]);
    db.run(`DELETE FROM risk_aggregations WHERE batch_id = ?`, [id]);
    
    // 获取该批次的所有路线
    const routesResult = db.exec(`SELECT id FROM routes WHERE batch_id = ?`, [id]);
    if (routesResult.length > 0 && routesResult[0].values.length > 0) {
      const routeIds = routesResult[0].values.map(row => row[0]);
      // 删除路段和路点
      routeIds.forEach(routeId => {
        db.run(`DELETE FROM road_segments WHERE route_id = ?`, [routeId]);
        db.run(`DELETE FROM waypoints WHERE route_id = ?`, [routeId]);
      });
    }
    
    db.run(`DELETE FROM routes WHERE batch_id = ?`, [id]);
    db.run(`DELETE FROM inspection_batches WHERE id = ?`, [id]);
    
    saveDatabase();
    
    res.json({ success: true, message: '批次已删除' });
  } catch (error) {
    console.error('删除批次失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 上传文件到批次
app.post('/api/batches/:id/upload', upload.fields([
  { name: 'gpx', maxCount: 10 },
  { name: 'road_csv', maxCount: 5 },
  { name: 'photo_csv', maxCount: 5 }
]), async (req, res) => {
  try {
    const { id: batchId } = req.params;
    const results = {
      gpx: [],
      road_csv: [],
      photo_csv: []
    };
    
    // 检查批次是否存在
    const db = getDatabase();
    const batchResult = db.exec(`SELECT id FROM inspection_batches WHERE id = ?`, [batchId]);
    if (batchResult.length === 0 || batchResult[0].values.length === 0) {
      return res.status(404).json({ success: false, error: '批次不存在' });
    }
    
    // 处理 GPX 文件
    if (req.files && req.files.gpx) {
      for (const file of req.files.gpx) {
        const content = fs.readFileSync(file.path, 'utf-8');
        const gpxData = parseGPX(content);
        
        const routeName = path.basename(file.originalname, path.extname(file.originalname));
        const saveResult = await saveGPXToDatabase(batchId, routeName, gpxData);
        
        results.gpx.push({
          filename: file.originalname,
          routeId: saveResult.routeId,
          waypointCount: saveResult.waypointCount,
          totalDistance: gpxData.totalDistance,
          totalDuration: gpxData.totalDuration
        });
        
        // 清理临时文件
        fs.unlinkSync(file.path);
      }
    }
    
    // 处理路况 CSV 文件
    if (req.files && req.files.road_csv) {
      for (const file of req.files.road_csv) {
        const content = fs.readFileSync(file.path, 'utf-8');
        const conditions = parseRoadConditionCSV(content);
        
        // 尝试匹配路线（如果只有一条路线，直接使用）
        const routesResult = db.exec(`SELECT id FROM routes WHERE batch_id = ?`, [batchId]);
        let routeId = null;
        if (routesResult.length > 0 && routesResult[0].values.length === 1) {
          routeId = routesResult[0].values[0][0];
        }
        
        const saveResult = await saveRoadConditionsToDatabase(batchId, conditions, routeId);
        
        results.road_csv.push({
          filename: file.originalname,
          conditionCount: saveResult.conditionCount
        });
        
        // 清理临时文件
        fs.unlinkSync(file.path);
      }
    }
    
    // 处理照片索引 CSV 文件
    if (req.files && req.files.photo_csv) {
      for (const file of req.files.photo_csv) {
        const content = fs.readFileSync(file.path, 'utf-8');
        const photos = parsePhotoIndexCSV(content);
        
        // 构建 condition_id 到 photo_ids 的映射
        const conditionIdMap = {};
        const conditionsResult = db.exec(`
          SELECT id, photo_ids FROM road_conditions WHERE batch_id = ?
        `, [batchId]);
        
        if (conditionsResult.length > 0 && conditionsResult[0].values.length > 0) {
          conditionsResult[0].values.forEach(row => {
            if (row[1]) {
              conditionIdMap[row[0]] = row[1].split(',').map(s => s.trim());
            }
          });
        }
        
        const saveResult = await savePhotosToDatabase(batchId, photos, conditionIdMap);
        
        results.photo_csv.push({
          filename: file.originalname,
          photoCount: saveResult.photoCount
        });
        
        // 清理临时文件
        fs.unlinkSync(file.path);
      }
    }
    
    // 触发风险分析
    await analyzeBatchRisks(batchId);
    
    res.json({ 
      success: true, 
      data: results,
      message: '文件上传并处理完成'
    });
  } catch (error) {
    console.error('文件上传失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 触发风险分析
app.post('/api/batches/:id/analyze', async (req, res) => {
  try {
    const { id: batchId } = req.params;
    
    // 检查批次是否存在
    const db = getDatabase();
    const batchResult = db.exec(`SELECT id FROM inspection_batches WHERE id = ?`, [batchId]);
    if (batchResult.length === 0 || batchResult[0].values.length === 0) {
      return res.status(404).json({ success: false, error: '批次不存在' });
    }
    
    const aggregations = await analyzeBatchRisks(batchId);
    
    res.json({ 
      success: true, 
      data: {
        aggregationCount: aggregations.length,
        aggregations: aggregations.slice(0, 20) // 返回前20条预览
      },
      message: '风险分析完成'
    });
  } catch (error) {
    console.error('风险分析失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取高风险路段
app.get('/api/batches/:id/high-risk', (req, res) => {
  try {
    const { id: batchId } = req.params;
    const { minScore = 5.0, limit = 20 } = req.query;
    
    const segments = getHighRiskSegments(
      batchId, 
      parseFloat(minScore), 
      parseInt(limit)
    );
    
    res.json({ 
      success: true, 
      data: {
        count: segments.length,
        segments
      }
    });
  } catch (error) {
    console.error('获取高风险路段失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取路段详细风险信息
app.get('/api/batches/:batchId/segments/:segmentId', (req, res) => {
  try {
    const { batchId, segmentId } = req.params;
    
    const details = getSegmentRiskDetails(batchId, segmentId);
    
    if (!details) {
      return res.status(404).json({ success: false, error: '路段不存在' });
    }
    
    res.json({ 
      success: true, 
      data: details
    });
  } catch (error) {
    console.error('获取路段详情失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 人工改判路况
app.put('/api/conditions/:id/overrule', (req, res) => {
  try {
    const { id: conditionId } = req.params;
    const { is_overruled, reason, overruled_by } = req.body;
    
    const success = overruleCondition(
      conditionId, 
      is_overruled, 
      reason, 
      overruled_by || '系统管理员'
    );
    
    if (!success) {
      return res.status(404).json({ success: false, error: '路况记录不存在' });
    }
    
    // 如果是取消改判或确认改判，重新分析风险
    const db = getDatabase();
    const batchResult = db.exec(`SELECT batch_id FROM road_conditions WHERE id = ?`, [conditionId]);
    if (batchResult.length > 0 && batchResult[0].values.length > 0) {
      const batchId = batchResult[0].values[0][0];
      analyzeBatchRisks(batchId); // 异步重新分析
    }
    
    res.json({ 
      success: true, 
      message: is_overruled ? '已标记为无效风险' : '已恢复为有效风险'
    });
  } catch (error) {
    console.error('改判路况失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 导出 Markdown 整改建议
app.post('/api/batches/:id/export/markdown', async (req, res) => {
  try {
    const { id: batchId } = req.params;
    
    const result = await exportMarkdownReport(batchId, req.body);
    
    res.json({ 
      success: true, 
      data: {
        filename: result.filename,
        downloadUrl: `/exports/${result.filename}`
      }
    });
  } catch (error) {
    console.error('导出 Markdown 失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 导出 JSON 审计包
app.post('/api/batches/:id/export/json', async (req, res) => {
  try {
    const { id: batchId } = req.params;
    
    const result = await exportJsonAudit(batchId, req.body);
    
    res.json({ 
      success: true, 
      data: {
        filename: result.filename,
        downloadUrl: `/exports/${result.filename}`
      }
    });
  } catch (error) {
    console.error('导出 JSON 失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取风险类型定义
app.get('/api/risk-types', (req, res) => {
  res.json({ 
    success: true, 
    data: RISK_TYPES
  });
});

// 获取批次的所有路线
app.get('/api/batches/:id/routes', (req, res) => {
  try {
    const { id: batchId } = req.params;
    const db = getDatabase();
    
    const routesResult = db.exec(`
      SELECT id, name, total_distance, total_duration, created_at
      FROM routes WHERE batch_id = ?
      ORDER BY created_at
    `, [batchId]);
    
    let routes = [];
    if (routesResult.length > 0 && routesResult[0].values.length > 0) {
      routes = routesResult[0].values.map(row => ({
        id: row[0],
        name: row[1],
        total_distance: row[2],
        total_duration: row[3],
        created_at: row[4]
      }));
    }
    
    // 获取每条路线的路点
    const routesWithWaypoints = [];
    for (const route of routes) {
      const waypointsResult = db.exec(`
        SELECT latitude, longitude, elevation, speed, timestamp, sequence, distance_from_start
        FROM waypoints WHERE route_id = ?
        ORDER BY sequence
      `, [route.id]);
      
      let waypoints = [];
      if (waypointsResult.length > 0 && waypointsResult[0].values.length > 0) {
        waypoints = waypointsResult[0].values.map(row => ({
          latitude: row[0],
          longitude: row[1],
          elevation: row[2],
          speed: row[3],
          timestamp: row[4],
          sequence: row[5],
          distance_from_start: row[6]
        }));
      }
      
      routesWithWaypoints.push({
        ...route,
        waypoints
      });
    }
    
    res.json({ 
      success: true, 
      data: routesWithWaypoints
    });
  } catch (error) {
    console.error('获取路线失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 处理 React 前端路由
app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, '../client/build/index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.json({ 
      message: '路况勘察分析工具后端服务运行中',
      api_docs: {
        '/api/health': '健康检查',
        '/api/batches': '批次管理',
        '/api/risk-types': '风险类型定义'
      }
    });
  }
});

// 启动服务器
async function startServer() {
  try {
    await initDatabase();
    
    app.listen(PORT, () => {
      console.log(`路况勘察分析工具后端服务已启动`);
      console.log(`服务地址: http://localhost:${PORT}`);
      console.log(`API 文档: http://localhost:${PORT}/api`);
    });
  } catch (error) {
    console.error('启动服务器失败:', error);
    process.exit(1);
  }
}

startServer();
