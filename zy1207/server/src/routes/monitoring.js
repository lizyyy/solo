import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../database/db.js';

const router = Router();

router.get('/batch/:batchId', (req, res) => {
  const { batchId } = req.params;
  
  const snapshots = db.prepare(`
    SELECT * FROM monitoring_snapshots
    WHERE batch_id = ?
    ORDER BY snapshot_time ASC
  `).all(batchId);
  
  snapshots.forEach(s => {
    if (s.custom_metrics_json) {
      try {
        s.custom_metrics = JSON.parse(s.custom_metrics_json);
      } catch (e) {
        s.custom_metrics = null;
      }
    }
  });
  
  res.json({ data: snapshots });
});

router.get('/:id', (req, res) => {
  const { id } = req.params;
  const item = db.prepare('SELECT * FROM monitoring_snapshots WHERE id = ?').get(id);
  
  if (!item) {
    return res.status(404).json({ error: '监控快照不存在' });
  }
  
  if (item.custom_metrics_json) {
    try {
      item.custom_metrics = JSON.parse(item.custom_metrics_json);
    } catch (e) {
      item.custom_metrics = null;
    }
  }
  
  res.json({ data: item });
});

router.post('/', (req, res) => {
  const { batch_id, snapshot_time, cpu_usage, memory_usage, disk_usage, network_in, network_out, db_connection_count, custom_metrics } = req.body;
  
  if (!batch_id) {
    return res.status(400).json({ error: '批次ID为必填项' });
  }
  
  const id = uuidv4();
  const customMetricsStr = custom_metrics ? JSON.stringify(custom_metrics) : null;
  const snapshotTime = snapshot_time || new Date().toISOString();
  
  db.prepare(`
    INSERT INTO monitoring_snapshots (
      id, batch_id, snapshot_time, cpu_usage, memory_usage, disk_usage,
      network_in, network_out, db_connection_count, custom_metrics_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, batch_id, snapshotTime,
    cpu_usage ?? null,
    memory_usage ?? null,
    disk_usage ?? null,
    network_in ?? null,
    network_out ?? null,
    db_connection_count ?? null,
    customMetricsStr
  );
  
  res.json({ 
    data: { 
      id, 
      batch_id, 
      snapshot_time: snapshotTime,
      cpu_usage,
      memory_usage,
      disk_usage,
      network_in,
      network_out,
      db_connection_count,
      custom_metrics
    } 
  });
});

router.post('/batch-import', (req, res) => {
  const { batch_id, snapshots } = req.body;
  
  if (!batch_id || !Array.isArray(snapshots)) {
    return res.status(400).json({ error: '批次ID和快照数组为必填项' });
  }
  
  const insert = db.prepare(`
    INSERT INTO monitoring_snapshots (
      id, batch_id, snapshot_time, cpu_usage, memory_usage, disk_usage,
      network_in, network_out, db_connection_count, custom_metrics_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  const transaction = db.transaction((items) => {
    const inserted = [];
    
    for (const item of items) {
      const id = uuidv4();
      const customMetricsStr = item.custom_metrics ? JSON.stringify(item.custom_metrics) : null;
      const snapshotTime = item.snapshot_time || new Date().toISOString();
      
      insert.run(
        id, batch_id, snapshotTime,
        item.cpu_usage ?? null,
        item.memory_usage ?? null,
        item.disk_usage ?? null,
        item.network_in ?? null,
        item.network_out ?? null,
        item.db_connection_count ?? null,
        customMetricsStr
      );
      
      inserted.push({ id, ...item, snapshot_time: snapshotTime });
    }
    
    return inserted;
  });
  
  const inserted = transaction(snapshots);
  res.json({ 
    message: `成功导入 ${inserted.length} 条监控快照`,
    data: inserted 
  });
});

router.get('/batch/:batchId/stats', (req, res) => {
  const { batchId } = req.params;
  
  const snapshots = db.prepare(`
    SELECT * FROM monitoring_snapshots
    WHERE batch_id = ?
    ORDER BY snapshot_time ASC
  `).all(batchId);
  
  if (snapshots.length === 0) {
    return res.json({ data: { count: 0, stats: {} } });
  }
  
  const cpuValues = snapshots.map(s => s.cpu_usage).filter(v => v !== null);
  const memValues = snapshots.map(s => s.memory_usage).filter(v => v !== null);
  
  const stats = {
    cpu: {
      min: cpuValues.length > 0 ? Math.min(...cpuValues) : 0,
      max: cpuValues.length > 0 ? Math.max(...cpuValues) : 0,
      avg: cpuValues.length > 0 ? cpuValues.reduce((a, b) => a + b, 0) / cpuValues.length : 0
    },
    memory: {
      min: memValues.length > 0 ? Math.min(...memValues) : 0,
      max: memValues.length > 0 ? Math.max(...memValues) : 0,
      avg: memValues.length > 0 ? memValues.reduce((a, b) => a + b, 0) / memValues.length : 0
    },
    snapshot_count: snapshots.length,
    time_range: {
      start: snapshots[0]?.snapshot_time,
      end: snapshots[snapshots.length - 1]?.snapshot_time
    }
  };
  
  res.json({ data: stats });
});

router.delete('/:id', (req, res) => {
  const { id } = req.params;
  
  const existing = db.prepare('SELECT * FROM monitoring_snapshots WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: '监控快照不存在' });
  }
  
  db.prepare('DELETE FROM monitoring_snapshots WHERE id = ?').run(id);
  res.json({ message: '删除成功' });
});

export default router;
