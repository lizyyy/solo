const http = require('http');

function post(path, data) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch(e) { resolve(body); }
      });
    });
    req.on('error', reject);
    req.write(JSON.stringify(data));
    req.end();
  });
}

function get(path) {
  return new Promise((resolve, reject) => {
    http.get('http://localhost:3000' + path, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch(e) { resolve(body); }
      });
    }).on('error', reject);
  });
}

async function test() {
  console.log('=== 1. 健康检查 ===');
  console.log(await get('/api/health'));

  console.log('\n=== 2. 创建批次（故意打乱运单号顺序） ===');
  const batchData = {
    station_id: 'STATION_TEST',
    batch_no: 'TEST_ORDER',
    items: [
      { waybill_no: 'ZZZZ00000000004', receiver_name: '李四', receiver_phone: '13900139002', detained_at: '2026-05-20T10:00:00Z', expected_pickup_at: '2026-05-25T18:00:00Z', parcel_type: '普通', storage_location: 'A-02', remark: '' },
      { waybill_no: 'AAAA00000000001', receiver_name: '', receiver_phone: '13800138001', detained_at: '2026-05-22T09:00:00Z', expected_pickup_at: '2026-05-28T18:00:00Z', parcel_type: '生鲜', storage_location: 'B-01', remark: '' },
      { waybill_no: 'ZZZZ00000000003', receiver_name: '王五', receiver_phone: '13800138003', detained_at: '2026-05-26T09:00:00Z', expected_pickup_at: '2026-05-24T18:00:00Z', parcel_type: '贵重', storage_location: 'C-01', remark: '用户要求拦截' },
      { waybill_no: 'ZZZZ00000000002', receiver_name: '赵六', receiver_phone: '13800138004', detained_at: '2026-05-21T09:00:00Z', expected_pickup_at: '2026-05-27T18:00:00Z', parcel_type: '普通', storage_location: 'A-03', remark: '' }
    ]
  };
  const result = await post('/api/batches', batchData);
  console.log('批次ID:', result.batch_id);
  console.log('重复提交:', result.duplicate);
  console.log('统计:', JSON.stringify(result.statistics));
  console.log('\n原始提交顺序 vs 返回 row_index:');
  result.items.forEach(item => {
    console.log('  row_index=' + item.row_index + ' waybill=' + item.waybill_no + ' category=' + item.category);
  });

  console.log('\n=== 3. 错误明细（验证row_index指向原始位置） ===');
  const errors = await get('/api/batches/' + result.batch_id + '/errors');
  console.log('错误数量:', errors.error_count);
  errors.errors.forEach(e => {
    console.log('  row_index=' + e.row_index + ' waybill=' + e.waybill_no + ' field=' + e.field_name + ' msg=' + e.error_message);
  });

  console.log('\n=== 4. 字段追踪链路 ===');
  const trace = await get('/api/batches/' + result.batch_id + '/trace');
  console.log('追踪数量:', trace.trace_count);
  trace.items.slice(0, 2).forEach(t => {
    console.log('  row=' + t.row_index + ' waybill=' + t.waybill_no + ' fields=' + Object.keys(t.fields).join(','));
  });

  console.log('\n=== 5. 重复提交测试 ===');
  const dup = await post('/api/batches', batchData);
  console.log('duplicate:', dup.duplicate);
  console.log('使用相同的批次ID:', dup.batch_id === result.batch_id);

  console.log('\n=== 测试完成 ===');
}

test().catch(console.error);
