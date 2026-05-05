import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../database/db.js';

const router = Router();

function calculatePercentiles(dataArray, percentiles) {
  if (!dataArray || dataArray.length === 0) {
    const result = {};
    percentiles.forEach(p => result[p] = 0);
    return result;
  }
  
  const sorted = [...dataArray].sort((a, b) => a - b);
  const result = {};
  
  percentiles.forEach(p => {
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    result[p] = sorted[Math.max(0, index)];
  });
  
  return result;
}

function calculateMetrics(rawData) {
  if (!rawData || rawData.length === 0) {
    return {
      total_requests: 0,
      success_count: 0,
      failed_count: 0,
      qps: 0,
      tps: 0,
      avg_response_time: 0,
      min_response_time: 0,
      max_response_time: 0,
      p50_response_time: 0,
      p75_response_time: 0,
      p95_response_time: 0,
      p99_response_time: 0,
      throughput: 0,
      error_rate: 0
    };
  }
  
  const responseTimes = rawData.map(r => r.responseTime || 0);
  const successCount = rawData.filter(r => r.success !== false).length;
  const failedCount = rawData.length - successCount;
  
  const percentiles = calculatePercentiles(responseTimes, [50, 75, 95, 99]);
  
  const sum = responseTimes.reduce((a, b) => a + b, 0);
  const avg = sum / responseTimes.length;
  
  const min = Math.min(...responseTimes);
  const max = Math.max(...responseTimes);
  
  const startTime = Math.min(...rawData.map(r => r.timestamp || Date.now()));
  const endTime = Math.max(...rawData.map(r => r.timestamp || Date.now()));
  const duration = (endTime - startTime) / 1000 || 1;
  
  const qps = rawData.length / duration;
  const tps = successCount / duration;
  
  const errorRate = rawData.length > 0 ? (failedCount / rawData.length) * 100 : 0;
  
  const totalBytes = rawData.reduce((sum, r) => sum + (r.responseSize || 0), 0);
  const throughput = totalBytes / duration;
  
  return {
    total_requests: rawData.length,
    success_count: successCount,
    failed_count: failedCount,
    qps: parseFloat(qps.toFixed(2)),
    tps: parseFloat(tps.toFixed(2)),
    avg_response_time: parseFloat(avg.toFixed(2)),
    min_response_time: min,
    max_response_time: max,
    p50_response_time: percentiles[50],
    p75_response_time: percentiles[75],
    p95_response_time: percentiles[95],
    p99_response_time: percentiles[99],
    throughput: parseFloat(throughput.toFixed(2)),
    error_rate: parseFloat(errorRate.toFixed(2))
  };
}

router.get('/:id', (req, res) => {
  const { id } = req.params;
  const item = db.prepare(`
    SELECT tr.*, ai.name as interface_name, ai.path as interface_path, ai.method as interface_method
    FROM test_results tr
    LEFT JOIN api_interfaces ai ON tr.interface_id = ai.id
    WHERE tr.id = ?
  `).get(id);
  
  if (!item) {
    return res.status(404).json({ error: '压测结果不存在' });
  }
  
  if (item.raw_data_json) {
    try {
      item.raw_data = JSON.parse(item.raw_data_json);
    } catch (e) {
      item.raw_data = null;
    }
  }
  
  res.json({ data: item });
});

router.post('/', (req, res) => {
  const { batch_id, interface_id, raw_data } = req.body;
  
  if (!batch_id) {
    return res.status(400).json({ error: '批次ID为必填项' });
  }
  
  const metrics = calculateMetrics(raw_data);
  const id = uuidv4();
  const rawDataStr = raw_data ? JSON.stringify(raw_data) : null;
  
  db.prepare(`
    INSERT INTO test_results (
      id, batch_id, interface_id, total_requests, success_count, failed_count,
      qps, tps, avg_response_time, min_response_time, max_response_time,
      p50_response_time, p75_response_time, p95_response_time, p99_response_time,
      throughput, error_rate, raw_data_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, batch_id, interface_id || null,
    metrics.total_requests, metrics.success_count, metrics.failed_count,
    metrics.qps, metrics.tps, metrics.avg_response_time, metrics.min_response_time, metrics.max_response_time,
    metrics.p50_response_time, metrics.p75_response_time, metrics.p95_response_time, metrics.p99_response_time,
    metrics.throughput, metrics.error_rate, rawDataStr
  );
  
  res.json({ 
    data: { 
      id, 
      batch_id, 
      interface_id,
      ...metrics 
    } 
  });
});

router.post('/batch-import', (req, res) => {
  const { batch_id, results } = req.body;
  
  if (!batch_id || !Array.isArray(results)) {
    return res.status(400).json({ error: '批次ID和结果数组为必填项' });
  }
  
  const insert = db.prepare(`
    INSERT INTO test_results (
      id, batch_id, interface_id, total_requests, success_count, failed_count,
      qps, tps, avg_response_time, min_response_time, max_response_time,
      p50_response_time, p75_response_time, p95_response_time, p99_response_time,
      throughput, error_rate, raw_data_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  const transaction = db.transaction((items) => {
    const inserted = [];
    
    for (const item of items) {
      const metrics = item.raw_data 
        ? calculateMetrics(item.raw_data)
        : {
            total_requests: item.total_requests || 0,
            success_count: item.success_count || 0,
            failed_count: item.failed_count || 0,
            qps: item.qps || 0,
            tps: item.tps || 0,
            avg_response_time: item.avg_response_time || 0,
            min_response_time: item.min_response_time || 0,
            max_response_time: item.max_response_time || 0,
            p50_response_time: item.p50_response_time || 0,
            p75_response_time: item.p75_response_time || 0,
            p95_response_time: item.p95_response_time || 0,
            p99_response_time: item.p99_response_time || 0,
            throughput: item.throughput || 0,
            error_rate: item.error_rate || 0
          };
      
      const id = uuidv4();
      const rawDataStr = item.raw_data ? JSON.stringify(item.raw_data) : null;
      
      insert.run(
        id, batch_id, item.interface_id || null,
        metrics.total_requests, metrics.success_count, metrics.failed_count,
        metrics.qps, metrics.tps, metrics.avg_response_time, metrics.min_response_time, metrics.max_response_time,
        metrics.p50_response_time, metrics.p75_response_time, metrics.p95_response_time, metrics.p99_response_time,
        metrics.throughput, metrics.error_rate, rawDataStr
      );
      
      inserted.push({ id, ...metrics });
    }
    
    return inserted;
  });
  
  const inserted = transaction(results);
  res.json({ 
    message: `成功导入 ${inserted.length} 条压测结果`,
    data: inserted 
  });
});

router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { raw_data, ...metrics } = req.body;
  
  const existing = db.prepare('SELECT * FROM test_results WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: '压测结果不存在' });
  }
  
  let calculatedMetrics = metrics;
  let rawDataStr = existing.raw_data_json;
  
  if (raw_data) {
    calculatedMetrics = { ...calculatedMetrics, ...calculateMetrics(raw_data) };
    rawDataStr = JSON.stringify(raw_data);
  }
  
  db.prepare(`
    UPDATE test_results SET
      total_requests = ?, success_count = ?, failed_count = ?,
      qps = ?, tps = ?, avg_response_time = ?, min_response_time = ?, max_response_time = ?,
      p50_response_time = ?, p75_response_time = ?, p95_response_time = ?, p99_response_time = ?,
      throughput = ?, error_rate = ?, raw_data_json = ?
    WHERE id = ?
  `).run(
    calculatedMetrics.total_requests ?? existing.total_requests,
    calculatedMetrics.success_count ?? existing.success_count,
    calculatedMetrics.failed_count ?? existing.failed_count,
    calculatedMetrics.qps ?? existing.qps,
    calculatedMetrics.tps ?? existing.tps,
    calculatedMetrics.avg_response_time ?? existing.avg_response_time,
    calculatedMetrics.min_response_time ?? existing.min_response_time,
    calculatedMetrics.max_response_time ?? existing.max_response_time,
    calculatedMetrics.p50_response_time ?? existing.p50_response_time,
    calculatedMetrics.p75_response_time ?? existing.p75_response_time,
    calculatedMetrics.p95_response_time ?? existing.p95_response_time,
    calculatedMetrics.p99_response_time ?? existing.p99_response_time,
    calculatedMetrics.throughput ?? existing.throughput,
    calculatedMetrics.error_rate ?? existing.error_rate,
    rawDataStr,
    id
  );
  
  const updated = db.prepare('SELECT * FROM test_results WHERE id = ?').get(id);
  res.json({ data: updated });
});

router.delete('/:id', (req, res) => {
  const { id } = req.params;
  
  const existing = db.prepare('SELECT * FROM test_results WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: '压测结果不存在' });
  }
  
  db.prepare('DELETE FROM test_results WHERE id = ?').run(id);
  res.json({ message: '删除成功' });
});

export default router;
