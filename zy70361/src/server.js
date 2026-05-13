const express = require('express');
const DataStore = require('./dataStore');
const Router = require('./router');

const app = express();
const PORT = 3000;

app.use(express.json());

const dataStore = new DataStore();
const router = new Router(dataStore);

dataStore.setLatencyMs(2000);

app.post('/api/users/:userId', async (req, res) => {
  const userId = req.params.userId;
  const data = req.body;
  const timestamp = Date.now();
  
  const result = dataStore.write(userId, data, timestamp);
  const trace = router.recordWrite(userId, data, timestamp);
  
  res.json({
    success: true,
    data: result,
    trace: {
      id: trace.id,
      type: trace.type,
      version: trace.version,
      timestamp: trace.timestamp
    },
    info: {
      currentLatencyMs: dataStore.getLatencyMs(),
      syncQueueInfo: dataStore.getSyncQueueInfo()
    }
  });
});

app.get('/api/users/:userId', async (req, res) => {
  const userId = req.params.userId;
  const options = {
    forcePrimary: req.query.forcePrimary === 'true',
    strongConsistency: req.query.strongConsistency === 'true',
    isListQuery: req.query.isListQuery === 'true',
    traceId: req.query.traceId
  };
  
  const decision = await router.decideAndRead(userId, options);
  
  res.json({
    success: true,
    result: decision.result,
    trace: {
      traceId: decision.traceId,
      targetDb: decision.targetDb,
      reason: decision.reason,
      waited: decision.waited,
      waitTimeMs: decision.waitTimeMs,
      degraded: decision.degraded,
      currentLatencyMs: decision.currentLatencyMs,
      primaryVersion: decision.primaryVersion,
      replicaVersion: decision.replicaVersion,
      timestamp: decision.timestamp,
      executedAt: decision.executedAt
    }
  });
});

app.get('/api/users/:userId/traces', (req, res) => {
  const userId = req.params.userId;
  
  res.json({
    success: true,
    data: {
      readTraces: router.getReadTraces(userId),
      writeTraces: router.getWriteTraces(userId)
    }
  });
});

app.get('/api/report/latency', (req, res) => {
  const report = router.getLatencyReport();
  res.json({
    success: true,
    data: report
  });
});

app.post('/api/config/latency', (req, res) => {
  const latencyMs = parseInt(req.body.latencyMs, 10);
  
  if (isNaN(latencyMs) || latencyMs < 0) {
    return res.status(400).json({
      success: false,
      error: 'latencyMs must be a non-negative integer'
    });
  }
  
  dataStore.setLatencyMs(latencyMs);
  
  res.json({
    success: true,
    data: {
      latencyMs: dataStore.getLatencyMs(),
      syncQueueInfo: dataStore.getSyncQueueInfo()
    }
  });
});

app.get('/api/config/status', (req, res) => {
  dataStore.processSync();
  
  res.json({
    success: true,
    data: {
      currentLatencyMs: dataStore.getLatencyMs(),
      thresholdMs: 5000,
      writeCooldownMs: 3000,
      waitTimeoutMs: 30000,
      syncQueueInfo: dataStore.getSyncQueueInfo(),
      latencyAlerts: router.getLatencyAlerts()
    }
  });
});

app.post('/api/alerts/:alertId/resolve', (req, res) => {
  const alertId = req.params.alertId;
  const alert = router.resolveLatencyAlert(alertId);
  
  if (!alert) {
    return res.status(404).json({
      success: false,
      error: 'Alert not found'
    });
  }
  
  res.json({
    success: true,
    data: alert
  });
});

app.listen(PORT, () => {
  console.log(`只读副本延迟 API 服务已启动在端口 ${PORT}`);
  console.log('');
  console.log('=== 使用示例 ===');
  console.log('');
  console.log('# 1. 设置从库延迟为 2 秒');
  console.log('curl -X POST http://localhost:3000/api/config/latency -H "Content-Type: application/json" -d \'{"latencyMs":2000}\'');
  console.log('');
  console.log('# 2. 写入用户数据（写后立刻读）');
  console.log('curl -X POST http://localhost:3000/api/users/user1 -H "Content-Type: application/json" -d \'{"name":"张三","email":"zhangsan@example.com"}\'');
  console.log('');
  console.log('# 3. 立刻读取（应该走主库）');
  console.log('curl http://localhost:3000/api/users/user1');
  console.log('');
  console.log('# 4. 等待 3 秒后再读（应该走从库）');
  console.log('sleep 3 && curl http://localhost:3000/api/users/user1');
  console.log('');
  console.log('# 5. 强一致性读取（始终走主库）');
  console.log('curl "http://localhost:3000/api/users/user1?strongConsistency=true"');
  console.log('');
  console.log('# 6. 设置从库延迟为 6 秒（超过阈值，触发告警）');
  console.log('curl -X POST http://localhost:3000/api/config/latency -H "Content-Type: application/json" -d \'{"latencyMs":6000}\'');
  console.log('');
  console.log('# 7. 读取（应该自动切主库并记录降级）');
  console.log('curl http://localhost:3000/api/users/user1');
  console.log('');
  console.log('# 8. 查看延迟报告');
  console.log('curl http://localhost:3000/api/report/latency');
  console.log('');
  console.log('# 9. 查看用户读写 trace');
  console.log('curl http://localhost:3000/api/users/user1/traces');
  console.log('');
  console.log('# 10. 查看系统状态');
  console.log('curl http://localhost:3000/api/config/status');
});
