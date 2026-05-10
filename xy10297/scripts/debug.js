const http = require('http');

const testConnection = async () => {
    console.log('测试服务器连接...');
    
    const options = {
        hostname: 'localhost',
        port: 3001,
        path: '/api/weighing',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    };
    
    const body = JSON.stringify({
        sku_code: 'DEBUG-001',
        sku_name: '调试商品',
        weight: 1.0,
        unit_price: 5.00,
        batch_number: 'DEBUG-BATCH',
        counter_code: 'DEBUG-COUNTER',
        operator_id: 'user1'
    });
    
    options.headers['Content-Length'] = Buffer.byteLength(body);
    
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let data = '';
            console.log(`状态码: ${res.statusCode}`);
            console.log(`响应头: ${JSON.stringify(res.headers, null, 2)}`);
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                console.log(`响应体: ${data}`);
                try {
                    const parsed = JSON.parse(data);
                    resolve({ status: res.statusCode, data: parsed });
                } catch (e) {
                    resolve({ status: res.statusCode, data: { raw: data } });
                }
            });
        });
        
        req.on('error', (err) => {
            console.error('请求错误:', err.message);
            reject(err);
        });
        
        req.write(body);
        req.end();
    });
};

testConnection().then(() => {
    console.log('测试完成');
}).catch(err => {
    console.error('测试失败:', err);
});
