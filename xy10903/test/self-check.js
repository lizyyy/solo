const http = require('http');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3000/api';
let serverProcess = null;
let results = [];
let passed = 0;
let failed = 0;

const request = (method, path, data = null) => {
  return new Promise((resolve, reject) => {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const url = new URL(BASE_URL + path);
    options.hostname = url.hostname;
    options.port = url.port;
    options.path = url.pathname + url.search;

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, body, raw: true });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
};

const assert = (condition, message) => {
  if (!condition) {
    failed++;
    results.push({ status: 'FAIL', message });
    console.log(`  ❌ FAIL: ${message}`);
    return false;
  }
  passed++;
  results.push({ status: 'PASS', message });
  console.log(`  ✓ PASS: ${message}`);
  return true;
};

const waitForServer = async (timeout = 30000) => {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const res = await request('GET', '/health');
      if (res.status === 200) return true;
    } catch (e) {}
    await new Promise(r => setTimeout(r, 500));
  }
  return false;
};

const startServer = () => {
  console.log('\n正在启动服务器...');
  serverProcess = require('child_process').spawn('node', ['src/server.js'], {
    detached: true,
    stdio: 'ignore'
  });
  return waitForServer();
};

const stopServer = () => {
  if (serverProcess) {
    process.kill(-serverProcess.pid);
  }
};

const runTests = async () => {
  console.log('\n' + '='.repeat(60));
  console.log('  校园借书预约 API - 自检脚本');
  console.log('='.repeat(60));

  const dbPath = path.join(__dirname, '..', 'data', 'library.db');
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
    console.log('\n已清理旧数据库');
  }

  if (fs.existsSync(path.join(__dirname, '..', 'data'))) {
    execSync('node scripts/init-sample-data.js', { stdio: 'pipe' });
  } else {
    console.log('\n数据库目录不存在，将在服务器启动后初始化');
  }

  const serverReady = await startServer();
  if (!serverReady) {
    console.error('服务器启动失败！');
    process.exit(1);
  }
  console.log('服务器已就绪');

  let readers = [];
  let books = [];
  let bookingId = null;
  const idempotencyKey = 'test-key-' + Date.now();

  try {
    console.log('\n' + '-'.repeat(50));
    console.log('【第一部分：基础数据读取测试】');
    console.log('-'.repeat(50));

    let res = await request('GET', '/readers');
    readers = res.body.data;
    assert(res.status === 200 && res.body.success, '读取读者列表');
    assert(readers.length >= 6, '读者数量正确');

    res = await request('GET', '/books');
    books = res.body.data;
    assert(res.status === 200 && res.body.success, '读取图书列表');
    assert(books.length >= 6, '图书数量正确');

    console.log('\n' + '-'.repeat(50));
    console.log('【第二部分：正常流程测试】');
    console.log('-'.repeat(50));

    const teacherReader = readers.find(r => r.identity_type === 'teacher');
    const studentReader = readers.find(r => r.identity_type === 'student');
    const testBook = books[0];

    res = await request('POST', '/bookings', {
      book_copy_id: testBook.id,
      reader_id: studentReader.id
    });
    assert(res.status === 201 && res.body.success, '学生创建预约');
    const studentBooking = res.body.data;

    res = await request('POST', '/bookings', {
      book_copy_id: testBook.id,
      reader_id: teacherReader.id
    });
    assert(res.status === 201 && res.body.success, '老师创建预约');
    const teacherBooking = res.body.data;
    assert(teacherBooking.priority === 2, '老师预约优先级正确（2）');
    assert(studentBooking.priority === 0, '学生预约优先级正确（0）');

    res = await request('GET', `/books/${testBook.id}/queue`);
    const queue = res.body.data;
    assert(queue.length === 2, '预约队列长度正确');
    assert(queue[0].reader_id === teacherReader.id, '老师优先级更高排在前面');

    res = await request('POST', '/bookings/lock-next', { book_copy_id: testBook.id });
    assert(res.status === 200 && res.body.success, '锁定下一个预约');
    const lockedBooking = res.body.data;
    assert(lockedBooking.status === 'locked', '预约状态变为locked');
    bookingId = lockedBooking.id;

    res = await request('POST', `/bookings/${bookingId}/fulfill`);
    assert(res.status === 200 && res.body.success, '完成取书');
    assert(res.body.data.status === 'fulfilled', '预约状态变为fulfilled');

    console.log('\n' + '-'.repeat(50));
    console.log('【第三部分：重复请求（幂等性）测试】');
    console.log('-'.repeat(50));

    res = await request('POST', '/bookings', {
      book_copy_id: testBook.id,
      reader_id: studentReader.id,
      idempotency_key: idempotencyKey
    });
    const firstResult = res.body.data;
    assert(res.status === 201 && res.body.success, '首次带幂等键创建预约');

    res = await request('POST', '/bookings', {
      book_copy_id: testBook.id,
      reader_id: studentReader.id,
      idempotency_key: idempotencyKey
    });
    assert(res.status === 201 && res.body.success, '重复带幂等键请求');
    assert(res.body.is_duplicate === true, '返回重复标记');
    assert(res.body.data.id === firstResult.id, '幂等性：返回相同预约ID');

    console.log('\n' + '-'.repeat(50));
    console.log('【第四部分：脏数据/异常测试】');
    console.log('-'.repeat(50));

    res = await request('POST', '/bookings', {});
    assert(res.status === 400, '缺少必要参数返回400错误');

    res = await request('POST', '/bookings', {
      book_copy_id: 'non-existent-book',
      reader_id: studentReader.id
    });
    assert(res.status === 400, '不存在的图书返回错误');

    res = await request('POST', '/bookings', {
      book_copy_id: testBook.id,
      reader_id: 'non-existent-reader'
    });
    assert(res.status === 400, '不存在的读者返回错误');

    res = await request('POST', '/bookings/invalid-id/fulfill');
    assert(res.status === 400, '对不存在的预约操作返回错误');

    res = await request('GET', '/error-logs');
    assert(res.status === 200 && res.body.success, '错误日志已记录');
    assert(res.body.data.length > 0, '至少有一条错误日志被保存');

    console.log('\n' + '-'.repeat(50));
    console.log('【第五部分：导出功能测试】');
    console.log('-'.repeat(50));

    res = await request('GET', '/reports/circulation');
    assert(res.status === 200 && res.body.success, '生成流转报告');
    const reportData = res.body.data;
    assert(reportData.content && reportData.content.totalBookings > 0, '报告包含统计数据');

    res = await request('GET', '/export/circulation?format=json');
    assert(res.status === 200 && res.body.success, 'JSON格式导出');
    const exportedData = res.body.data;
    assert(exportedData.totalBookings === reportData.content.totalBookings, 
      '导出内容与报告内容一致性检查');

    res = await request('GET', '/export/circulation?format=csv');
    assert(res.status === 200, 'CSV格式导出成功');
    assert(typeof res.body === 'string' || res.body.raw, 'CSV返回文本格式');

    console.log('\n' + '-'.repeat(50));
    console.log('【第六部分：人工修正测试】');
    console.log('-'.repeat(50));

    res = await request('PATCH', `/bookings/${studentBooking.id}/manual`, {
      status: 'cancelled'
    });
    assert(res.status === 200 && res.body.success, '人工修正预约状态');
    assert(res.body.data.status === 'cancelled', '预约状态已人工修正为cancelled');

    console.log('\n' + '-'.repeat(50));
    console.log('【第七部分：取消预约测试】');
    console.log('-'.repeat(50));

    res = await request('POST', `/bookings/${teacherBooking.id}/cancel`);
    assert(res.status === 200 && res.body.success, '取消预约成功');
    assert(res.body.data.status === 'cancelled', '预约状态已取消');

  } catch (error) {
    console.error('\n测试过程发生错误:', error.message);
    failed++;
  } finally {
    stopServer();
  }

  console.log('\n' + '='.repeat(60));
  console.log('  测试结果汇总');
  console.log('='.repeat(60));
  console.log(`  通过: ${passed} 项`);
  console.log(`  失败: ${failed} 项`);
  console.log(`  总计: ${passed + failed} 项`);
  console.log(`  通过率: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
  console.log('='.repeat(60));

  if (failed > 0) {
    console.log('\n  ⚠️  存在失败的测试项，请检查代码！');
    process.exit(1);
  } else {
    console.log('\n  ✓ 所有测试通过！');
    process.exit(0);
  }
};

runTests().catch(err => {
  console.error('自检脚本异常:', err);
  stopServer();
  process.exit(1);
});
