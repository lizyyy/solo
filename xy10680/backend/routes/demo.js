const express = require('express');
const router = express.Router();
const db = require('../database');
const { addTimelineEvent } = require('../utils/timeline');
const { v4: uuidv4 } = require('uuid');

router.post('/success', (req, res) => {
  const { employee_id, old_size, new_size } = req.body;
  
  db.get('SELECT quantity FROM inventory WHERE size = ?', [new_size], (err, row) => {
    if (!row || row.quantity < 1) {
      db.run(
        'INSERT INTO inventory (size, quantity) VALUES (?, ?) ON CONFLICT(size) DO UPDATE SET quantity = 10',
        [new_size, 10]
      );
    }
    
    const request_id = `DEMO-SUC-${Date.now()}`;
    
    db.run(
      'INSERT INTO exchange_requests (request_id, employee_id, old_size, new_size, reason, status) VALUES (?, ?, ?, ?, ?, ?)',
      [request_id, employee_id || 1, old_size || 'M', new_size || 'L', '成功路径演示', 'approved'],
      async function(err) {
        await addTimelineEvent('demo_success', { request_id }, 'success', 
          '演示路径1: 成功 - 换码申请创建并审批通过');
        
        res.json({
          path: 'success',
          request_id,
          status: 'approved',
          message: '成功路径演示完成 - 换码申请已自动审批通过'
        });
      }
    );
  });
});

router.post('/blocked', (req, res) => {
  const { employee_id, old_size, new_size } = req.body;
  
  db.run(
    'UPDATE inventory SET quantity = 0 WHERE size = ?',
    [new_size || 'XXL'],
    () => {
      const request_id = `DEMO-BLK-${Date.now()}`;
      
      db.run(
        'INSERT INTO exchange_requests (request_id, employee_id, old_size, new_size, reason, status, failure_reason) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [request_id, employee_id || 1, old_size || 'M', new_size || 'XXL', '拦截路径演示', 'failed', '库存不足'],
        async function(err) {
          await addTimelineEvent('demo_blocked', { request_id }, 'blocked', 
            '演示路径2: 拦截 - 库存不足，申请被拦截');
          
          res.status(400).json({
            path: 'blocked',
            request_id,
            status: 'failed',
            failure_reason: '库存不足',
            message: '拦截路径演示完成 - 因库存不足申请被拦截'
          });
        }
      );
    }
  );
});

router.post('/manual', (req, res) => {
  const { employee_id, size } = req.body;
  
  const recovery_id = `DEMO-MAN-${Date.now()}`;
  
  db.run(
    'INSERT INTO recoveries (recovery_id, employee_id, size, quantity, status, is_exception, exception_reason) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [recovery_id, employee_id || 1, size || 'M', 1, 'pending', 1, '员工在职但回收工装，需人工复核'],
    async function(err) {
      await addTimelineEvent('demo_manual', { recovery_id }, 'manual', 
        '演示路径3: 人工修正 - 异常回收待人工复核');
      
      res.json({
        path: 'manual',
        recovery_id,
        status: 'pending',
        is_exception: true,
        message: '人工修正路径演示完成 - 回收异常，需人工复核处理'
      });
    }
  );
});

router.post('/duplicate', (req, res) => {
  const idempotencyKey = req.headers['x-idempotency-key'] || 'demo-duplicate-key-' + Date.now();
  
  db.get('SELECT * FROM idempotency_keys WHERE key = ?', [idempotencyKey], (err, row) => {
    if (row) {
      res.json({
        path: 'duplicate',
        idempotencyKey,
        cached: true,
        message: '重复提交路径演示完成 - 检测到重复请求，返回缓存结果（幂等性生效）',
        cachedResponse: JSON.parse(row.response_data)
      });
      return;
    }
    
    const responseData = {
      employee_id: 'DEMO001',
      name: '演示员工',
      department: '演示部门',
      size: 'M',
      timestamp: new Date().toISOString()
    };
    
    db.run(
      'INSERT INTO idempotency_keys (key, request_type, response_data) VALUES (?, ?, ?)',
      [idempotencyKey, 'demo', JSON.stringify({ status: 200, data: responseData })],
      async function(err) {
        await addTimelineEvent('demo_duplicate', { idempotencyKey }, 'success', 
          '演示路径4: 重复提交 - 首次请求已缓存，后续重复请求将返回此结果');
        
        res.json({
          path: 'duplicate',
          idempotencyKey,
          cached: false,
          message: '首次请求已记录 - 请使用相同的 x-idempotency-key 再次请求以验证幂等性',
          response: responseData
        });
      }
    );
  });
});

router.get('/paths', (req, res) => {
  res.json({
    paths: [
      {
        id: 'success',
        name: '成功路径',
        description: '正常流程：提交换码申请 -> 库存充足 -> 自动审批通过',
        endpoint: '/api/demo/success',
        method: 'POST'
      },
      {
        id: 'blocked',
        name: '拦截路径',
        description: '异常拦截：提交换码申请 -> 库存不足 -> 申请被拦截失败',
        endpoint: '/api/demo/blocked',
        method: 'POST'
      },
      {
        id: 'manual',
        name: '人工修正路径',
        description: '异常处理：提交离职回收 -> 员工在职 -> 标记异常 -> 需人工复核',
        endpoint: '/api/demo/manual',
        method: 'POST'
      },
      {
        id: 'duplicate',
        name: '重复提交路径',
        description: '幂等验证：重复提交 -> 检测到幂等键 -> 返回缓存结果',
        endpoint: '/api/demo/duplicate',
        method: 'POST',
        header: 'x-idempotency-key: 自定义标识'
      }
    ]
  });
});

module.exports = router;