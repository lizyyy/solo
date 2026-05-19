import express from 'express';
import cors from 'cors';
import { store } from './store';
import { initSampleData } from './sampleData';
import { MessageStatus } from './types';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  const start = Date.now();
  const originalSend = res.send;
  res.send = function(this: any, body: any) {
    const duration = Date.now() - start;
    store.addLog({
      endpoint: req.path,
      method: req.method,
      input: req.body,
      result: typeof body === 'string' ? body : JSON.parse(body || '{}'),
      responsibleNode: 'api-gateway-01',
      duration
    });
    return originalSend.call(this, body);
  };
  next();
});

initSampleData();

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/messages', (req, res) => {
  const { topic, status } = req.query;
  const messages = store.getMessages({
    topic: topic as string | undefined,
    status: status as MessageStatus | undefined
  });
  res.json(messages);
});

app.get('/api/messages/:id', (req, res) => {
  const msg = store.getMessage(req.params.id);
  if (!msg) {
    return res.status(404).json({ error: 'Message not found' });
  }
  res.json(msg);
});

app.post('/api/messages/:id/replay', (req, res) => {
  const { operator } = req.body;
  const msg = store.getMessage(req.params.id);
  if (!msg) {
    return res.status(404).json({ error: 'Message not found' });
  }
  
  store.updateMessage(req.params.id, { status: 'pending' });
  store.addHistory(req.params.id, {
    timestamp: Date.now(),
    action: 'replay_single',
    status: 'pending',
    operator: operator || 'anonymous',
    note: '单条重放'
  });
  
  setTimeout(() => {
    const shouldFail = Math.random() < 0.3;
    const newStatus = shouldFail ? 'failed' : 'success';
    store.updateMessage(req.params.id, { 
      status: newStatus,
      retryCount: msg.retryCount + 1,
      lastError: shouldFail ? '模拟重放失败' : undefined
    });
    store.addHistory(req.params.id, {
      timestamp: Date.now(),
      action: 'replay_complete',
      status: newStatus,
      operator: 'system',
      note: shouldFail ? '重放失败' : '重放成功'
    });
  }, 1000);
  
  res.json({ success: true, message: '重放任务已提交' });
});

app.post('/api/messages/:id/skip', (req, res) => {
  const { operator, reason } = req.body;
  const msg = store.getMessage(req.params.id);
  if (!msg) {
    return res.status(404).json({ error: 'Message not found' });
  }
  
  store.updateMessage(req.params.id, { status: 'skipped' });
  store.addHistory(req.params.id, {
    timestamp: Date.now(),
    action: 'skip',
    status: 'skipped',
    operator: operator || 'anonymous',
    note: reason || '手动跳过'
  });
  
  res.json({ success: true, message: '已跳过' });
});

app.get('/api/topics', (req, res) => {
  res.json(store.getTopics());
});

app.get('/api/batches', (req, res) => {
  res.json(store.getBatches());
});

app.post('/api/batches', (req, res) => {
  const { name, topic, messageIds, rateLimit, operator } = req.body;
  
  if (!messageIds || messageIds.length === 0) {
    return res.status(400).json({ error: '请选择要重放的消息' });
  }
  
  const batch = store.addBatch({
    name,
    topic,
    messageIds,
    status: 'created',
    rateLimit: rateLimit || 10,
    operator: operator || 'anonymous'
  });
  
  messageIds.forEach((id: string) => {
    store.updateMessage(id, { status: 'pending', batchId: batch.id });
    store.addHistory(id, {
      timestamp: Date.now(),
      action: 'batch_scheduled',
      status: 'pending',
      operator: operator || 'anonymous',
      note: `加入批次: ${name}`
    });
  });
  
  res.json(batch);
});

app.post('/api/batches/:id/start', (req, res) => {
  const batch = store.getBatch(req.params.id);
  if (!batch) {
    return res.status(404).json({ error: 'Batch not found' });
  }
  
  store.updateBatch(req.params.id, { status: 'running', startedAt: Date.now() });
  
  const processMessage = async (index: number) => {
    if (index >= batch.messageIds.length) {
      store.updateBatch(req.params.id, { status: 'completed', completedAt: Date.now() });
      return;
    }
    
    const msgId = batch.messageIds[index];
    const currentBatch = store.getBatch(req.params.id);
    if (currentBatch?.status === 'paused') {
      return;
    }
    
    store.updateMessage(msgId, { status: 'replaying' });
    store.addHistory(msgId, {
      timestamp: Date.now(),
      action: 'replay_start',
      status: 'replaying',
      operator: 'system',
      note: '开始重放'
    });
    
    await new Promise(r => setTimeout(r, 1000 / batch.rateLimit));
    
    const msg = store.getMessage(msgId);
    const rules = store.getRules().filter(r => r.enabled);
    
    const shouldSkip = rules.some(rule => {
      const hasTopicFilter = !!rule.topic;
      const hasDeadReasonFilter = !!rule.deadReason;
      const hasPayloadPatternFilter = !!rule.payloadPattern;
      
      const topicMatch = !hasTopicFilter || rule.topic === msg?.topic;
      const deadReasonMatch = !hasDeadReasonFilter || rule.deadReason === msg?.deadReason;
      
      let payloadPatternMatch = true;
      if (hasPayloadPatternFilter && msg?.payload) {
        try {
          const regex = new RegExp(rule.payloadPattern!);
          const payloadStr = JSON.stringify(msg.payload);
          payloadPatternMatch = regex.test(payloadStr);
        } catch (e) {
          payloadPatternMatch = false;
        }
      }
      
      if (hasTopicFilter || hasDeadReasonFilter || hasPayloadPatternFilter) {
        return topicMatch && deadReasonMatch && payloadPatternMatch;
      }
      
      return false;
    });
    
    if (shouldSkip) {
      const matchedRule = rules.find(rule => {
        const hasTopicFilter = !!rule.topic;
        const hasDeadReasonFilter = !!rule.deadReason;
        const hasPayloadPatternFilter = !!rule.payloadPattern;
        
        const topicMatch = !hasTopicFilter || rule.topic === msg?.topic;
        const deadReasonMatch = !hasDeadReasonFilter || rule.deadReason === msg?.deadReason;
        
        let payloadPatternMatch = true;
        if (hasPayloadPatternFilter && msg?.payload) {
          try {
            const regex = new RegExp(rule.payloadPattern!);
            const payloadStr = JSON.stringify(msg.payload);
            payloadPatternMatch = regex.test(payloadStr);
          } catch (e) {
            payloadPatternMatch = false;
          }
        }
        
        if (hasTopicFilter || hasDeadReasonFilter || hasPayloadPatternFilter) {
          return topicMatch && deadReasonMatch && payloadPatternMatch;
        }
        return false;
      });
      
      store.updateMessage(msgId, { status: 'skipped' });
      store.addHistory(msgId, {
        timestamp: Date.now(),
        action: 'skipped_by_rule',
        status: 'skipped',
        operator: 'system',
        note: matchedRule ? `命中规则: ${matchedRule.name}` : '命中跳过规则'
      });
      store.updateBatch(req.params.id, { skippedCount: (currentBatch?.skippedCount || 0) + 1 });
    } else {
      const shouldFail = Math.random() < 0.2;
      const newStatus = shouldFail ? 'failed' : 'success';
      store.updateMessage(msgId, { 
        status: newStatus,
        retryCount: (msg?.retryCount || 0) + 1,
        lastError: shouldFail ? '模拟重放失败' : undefined
      });
      store.addHistory(msgId, {
        timestamp: Date.now(),
        action: 'replay_complete',
        status: newStatus,
        operator: 'system',
        note: shouldFail ? '重放失败' : '重放成功'
      });
      if (shouldFail) {
        store.updateBatch(req.params.id, { failedCount: (currentBatch?.failedCount || 0) + 1 });
      } else {
        store.updateBatch(req.params.id, { successCount: (currentBatch?.successCount || 0) + 1 });
      }
    }
    
    setTimeout(() => processMessage(index + 1), 1000 / batch.rateLimit);
  };
  
  processMessage(0);
  
  res.json({ success: true, message: '批次已启动' });
});

app.post('/api/batches/:id/pause', (req, res) => {
  store.updateBatch(req.params.id, { status: 'paused' });
  res.json({ success: true, message: '批次已暂停' });
});

app.get('/api/rules', (req, res) => {
  res.json(store.getRules());
});

app.post('/api/rules', (req, res) => {
  const rule = store.addRule(req.body);
  res.json(rule);
});

app.put('/api/rules/:id', (req, res) => {
  const rule = store.updateRule(req.params.id, req.body);
  if (!rule) {
    return res.status(404).json({ error: 'Rule not found' });
  }
  res.json(rule);
});

app.delete('/api/rules/:id', (req, res) => {
  const success = store.deleteRule(req.params.id);
  res.json({ success });
});

app.get('/api/export', (req, res) => {
  const { topic, status, format } = req.query;
  const messages = store.getMessages({
    topic: topic as string | undefined,
    status: status as MessageStatus | undefined
  });
  
  const exportData = messages.map(m => ({
    id: m.id,
    topic: m.topic,
    deadReason: m.deadReason,
    deadReasonDesc: m.deadReasonDesc,
    payloadSummary: m.payloadSummary,
    status: m.status,
    responsibleNode: m.responsibleNode,
    retryCount: m.retryCount,
    createdAt: new Date(m.createdAt).toISOString(),
    lastUpdated: new Date(m.updatedAt).toISOString(),
    latestAction: m.history[m.history.length - 1]?.action || 'unknown',
    latestNote: m.history[m.history.length - 1]?.note || '',
    statusExplanation: getStatusExplanation(m)
  }));
  
  if (format === 'csv') {
    const headers = Object.keys(exportData[0] || {}).join(',');
    const rows = exportData.map(row => 
      Object.values(row).map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=dlq-export.csv');
    res.send('\ufeff' + headers + '\n' + rows.join('\n'));
  } else {
    res.json(exportData);
  }
});

function getStatusExplanation(msg: any): string {
  const latest = msg.history[msg.history.length - 1];
  switch (msg.status) {
    case 'dead':
      return `因「${msg.deadReasonDesc}」进入死信队列，已重试${msg.retryCount}次`;
    case 'pending':
      return `已由「${latest?.operator}」加入重放队列，等待处理`;
    case 'replaying':
      return `正在重放处理中`;
    case 'success':
      return `重放成功，最终由「${latest?.operator}」完成处理`;
    case 'failed':
      return `重放失败：${msg.lastError || latest?.note || '未知原因'}`;
    case 'skipped':
      return `已跳过：${latest?.note || '手动跳过'}`;
    default:
      return '状态未知';
  }
}

app.get('/api/logs', (req, res) => {
  res.json(store.getLogs());
});

app.listen(PORT, () => {
  console.log(`DLQ Replay Console API running on http://localhost:${PORT}`);
});
