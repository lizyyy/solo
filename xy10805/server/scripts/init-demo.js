const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');
const path = require('path');

const dbPath = path.join(__dirname, '../../data/idempotency-audit.db');

const generateFingerprint = (method, endpoint, body) => {
    const data = `${method}:${endpoint}:${body}`;
    return crypto.createHash('sha256').update(data).digest('hex');
};

const formatDate = (date) => {
    return date.toISOString().replace('T', ' ').substring(0, 19);
};

const demoRecords = [
    {
        key: 'payment-001-abcdef',
        service: 'payment-service',
        endpoint: '/api/v1/payments',
        method: 'POST',
        body: JSON.stringify({ userId: 'user-123', amount: 500, currency: 'CNY' }),
        responseStatus: 200,
        responseBody: JSON.stringify({ success: true, transactionId: 'txn-001', status: 'completed' }),
        requestCount: 3,
        status: 'active'
    },
    {
        key: 'payment-002-ghijkl',
        service: 'payment-service',
        endpoint: '/api/v1/payments/refund',
        method: 'POST',
        body: JSON.stringify({ transactionId: 'txn-001', reason: 'customer_request' }),
        responseStatus: 200,
        responseBody: JSON.stringify({ success: true, refundId: 'refund-001', status: 'processed' }),
        requestCount: 1,
        status: 'active'
    },
    {
        key: 'order-001-mnopqr',
        service: 'order-service',
        endpoint: '/api/v1/orders',
        method: 'POST',
        body: JSON.stringify({ userId: 'user-456', items: [{ sku: 'item-001', qty: 2 }], total: 299 }),
        responseStatus: 201,
        responseBody: JSON.stringify({ orderId: 'order-001', status: 'created' }),
        requestCount: 5,
        status: 'active'
    },
    {
        key: 'order-002-stuvwx',
        service: 'order-service',
        endpoint: '/api/v1/orders/cancel',
        method: 'POST',
        body: JSON.stringify({ orderId: 'order-002', reason: 'out_of_stock' }),
        responseStatus: 200,
        responseBody: JSON.stringify({ success: true, status: 'cancelled' }),
        requestCount: 1,
        status: 'conflict'
    },
    {
        key: 'user-001-yzabcd',
        service: 'user-service',
        endpoint: '/api/v1/users/profile',
        method: 'PUT',
        body: JSON.stringify({ name: '张三', email: 'zhangsan@example.com' }),
        responseStatus: 200,
        responseBody: JSON.stringify({ success: true, userId: 'user-789' }),
        requestCount: 2,
        status: 'active'
    },
    {
        key: 'payment-003-efghij',
        service: 'payment-service',
        endpoint: '/api/v1/payments',
        method: 'POST',
        body: JSON.stringify({ userId: 'user-999', amount: 1500, currency: 'CNY' }),
        responseStatus: 200,
        responseBody: JSON.stringify({ success: true, transactionId: 'txn-003', status: 'pending' }),
        requestCount: 1,
        status: 'expired'
    }
];

const initDemoData = () => {
    const db = new sqlite3.Database(dbPath);
    
    console.log('开始初始化演示数据...\n');
    
    db.serialize(() => {
        const now = new Date();
        const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        const expiredAt = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        
        demoRecords.forEach((record, index) => {
            const fingerprint = generateFingerprint(record.method, record.endpoint, record.body);
            const recordExpiresAt = record.status === 'expired' ? expiredAt : expiresAt;
            
            db.run(`INSERT INTO idempotency_keys (
                idempotency_key, service_name, api_endpoint, request_fingerprint,
                request_method, request_body, first_request_at, last_request_at,
                first_response_status, first_response_body, request_count, status, expires_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
                record.key,
                record.service,
                record.endpoint,
                fingerprint,
                record.method,
                record.body,
                formatDate(now),
                formatDate(now),
                record.responseStatus,
                record.responseBody,
                record.requestCount,
                record.status,
                formatDate(recordExpiresAt)
            ], function(err) {
                if (err) {
                    console.error(`插入记录 ${record.key} 失败:`, err.message);
                    return;
                }
                
                const recordId = this.lastID;
                console.log(`✓ 插入记录: ${record.key} (ID: ${recordId})`);
                
                for (let i = 0; i < record.requestCount; i++) {
                    const isReused = i > 0 && record.status !== 'conflict';
                    const isConflict = i > 0 && record.status === 'conflict';
                    
                    let requestBody = record.body;
                    if (isConflict) {
                        const bodyObj = JSON.parse(record.body);
                        bodyObj.amount = (bodyObj.amount || 0) + 100;
                        requestBody = JSON.stringify(bodyObj);
                    }
                    
                    db.run(`INSERT INTO request_logs (
                        idempotency_key_id, idempotency_key, request_fingerprint,
                        request_method, request_body, response_status, response_body,
                        is_reused, is_conflict, requested_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
                        recordId,
                        record.key,
                        fingerprint,
                        record.method,
                        requestBody,
                        isConflict ? null : record.responseStatus,
                        isConflict ? null : record.responseBody,
                        isReused ? 1 : 0,
                        isConflict ? 1 : 0,
                        formatDate(new Date(now.getTime() - i * 60000))
                    ]);
                }
            });
        });
    });
    
    db.close((err) => {
        if (err) {
            console.error('\n关闭数据库失败:', err.message);
            process.exit(1);
        }
        console.log('\n✅ 演示数据初始化完成!');
        console.log(`\n共插入 ${demoRecords.length} 条幂等记录`);
        console.log('包含以下服务:');
        console.log('  - payment-service (支付服务)');
        console.log('  - order-service (订单服务)');
        console.log('  - user-service (用户服务)');
        console.log('\n运行 npm start 启动服务');
    });
};

initDemoData();
