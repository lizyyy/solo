const http = require('http');
const { 
  initDatabase, 
  canTransition, 
  STATUS_FLOW, 
  generateTicketNumber,
  getAllTickets,
  getTicketById,
  createTicket,
  updateTicket,
  changeTicketStatus,
  getStatistics
} = require('../server/database');

const TEST_PORT = 3001;
const BASE_URL = `http://localhost:${TEST_PORT}`;

let testsPassed = 0;
let testsFailed = 0;
let testServer = null;

function logInfo(message) {
  console.log(`ℹ️  ${message}`);
}

function logSuccess(message) {
  console.log(`✅ ${message}`);
  testsPassed++;
}

function logError(message) {
  console.log(`❌ ${message}`);
  testsFailed++;
}

function logSection(title) {
  console.log('\n' + '='.repeat(50));
  console.log(`📋 ${title}`);
  console.log('='.repeat(50));
}

async function httpRequest(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const reqOptions = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    };

    const req = http.request(reqOptions, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          const data = body ? JSON.parse(body) : null;
          resolve({ status: res.statusCode, data, headers: res.headers });
        } catch (err) {
          resolve({ status: res.statusCode, data: body, headers: res.headers });
        }
      });
    });

    req.on('error', reject);

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }

    req.end();
  });
}

async function testDatabase() {
  logSection('数据库测试');
  
  try {
    initDatabase();
    logSuccess('数据库初始化成功');
  } catch (err) {
    logError(`数据库初始化失败: ${err.message}`);
    return false;
  }

  try {
    const tickets = getAllTickets({});
    logSuccess(`数据库中有 ${tickets.length} 条工单记录`);
  } catch (err) {
    logError(`查询工单数量失败: ${err.message}`);
  }

  logInfo('测试状态流转规则...');
  
  if (canTransition('待检测', '报价中')) {
    logSuccess('待检测 → 报价中 允许');
  } else {
    logError('待检测 → 报价中 应该允许');
  }

  if (canTransition('待检测', '已取消')) {
    logSuccess('待检测 → 已取消 允许');
  } else {
    logError('待检测 → 已取消 应该允许');
  }

  if (!canTransition('待检测', '维修中')) {
    logSuccess('待检测 → 维修中 正确禁止');
  } else {
    logError('待检测 → 维修中 应该禁止');
  }

  if (!canTransition('已完成', '待检测')) {
    logSuccess('已完成 → 待检测 正确禁止');
  } else {
    logError('已完成 → 待检测 应该禁止');
  }

  if (!canTransition('已取消', '待检测')) {
    logSuccess('已取消 → 待检测 正确禁止');
  } else {
    logError('已取消 → 待检测 应该禁止');
  }

  logInfo('测试工单创建...');
  try {
    const testTicket = {
      customer_name: '测试用户',
      customer_phone: '13800138099',
      device_model: '测试型号 Pro',
      fault_description: '这是一个测试工单',
      quote_amount: 999,
      repair_parts: '测试配件',
      notes: '这是测试备注'
    };
    
    const newTicket = createTicket(testTicket);
    if (newTicket && newTicket.id) {
      logSuccess(`创建工单成功，ID: ${newTicket.id}, 工单号: ${newTicket.ticket_number}`);
      
      const fetched = getTicketById(newTicket.id);
      if (fetched && fetched.customer_name === '测试用户') {
        logSuccess('获取工单详情成功');
      } else {
        logError('获取工单详情失败');
      }
      
      const updated = updateTicket(newTicket.id, {
        quote_amount: 1299,
        notes: '已更新测试备注'
      });
      if (updated && updated.quote_amount === 1299) {
        logSuccess('更新工单成功');
      } else {
        logError('更新工单失败');
      }
      
      const statusResult = changeTicketStatus(newTicket.id, '报价中', '测试状态变更');
      if (statusResult.success && statusResult.data.status === '报价中') {
        logSuccess(`状态流转成功: 待检测 → 报价中`);
      } else {
        logError('状态流转失败');
      }
      
      const invalidStatus = changeTicketStatus(newTicket.id, '已完成', '尝试非法跳转到已完成');
      if (!invalidStatus.success) {
        logSuccess('非法状态流转正确被拒绝');
      } else {
        logError('非法状态流转应该被拒绝，但却成功了');
      }
    } else {
      logError('创建工单失败');
    }
  } catch (err) {
    logError(`工单操作测试失败: ${err.message}`);
  }

  logInfo('测试数据验证...');
  try {
    const invalidTicket = {
      customer_name: '',
      customer_phone: 'invalid',
      device_model: '',
      fault_description: ''
    };
    
    const errors = [];
    if (!invalidTicket.customer_name || invalidTicket.customer_name.trim() === '') {
      errors.push('客户姓名不能为空');
    }
    if (!/^1[3-9]\d{9}$/.test(invalidTicket.customer_phone)) {
      errors.push('手机号格式不正确');
    }
    
    if (errors.length > 0) {
      logSuccess('无效数据正确被拒绝');
    } else {
      logError('无效数据应该被拒绝');
    }
  } catch (err) {
    logSuccess(`无效数据被拒绝: ${err.message}`);
  }

  return true;
}

async function startTestServer() {
  logInfo('启动测试服务器...');
  
  const express = require('express');
  const cors = require('cors');
  
  const app = express();
  
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  
  const ticketsRoute = require('../server/routes/tickets');
  const csvRoute = require('../server/routes/csv');
  
  app.use('/api/tickets', ticketsRoute);
  app.use('/api/csv', csvRoute);
  
  app.get('/api/status-flow', (req, res) => {
    res.json({
      success: true,
      data: {
        flow: STATUS_FLOW,
        colors: {
          '待检测': '#f59e0b',
          '报价中': '#3b82f6',
          '维修中': '#8b5cf6',
          '待取机': '#06b6d4',
          '已完成': '#22c55e',
          '已取消': '#6b7280'
        },
        allStatuses: Object.keys(STATUS_FLOW)
      }
    });
  });
  
  return new Promise((resolve) => {
    testServer = app.listen(TEST_PORT, () => {
      logSuccess(`测试服务器启动在端口 ${TEST_PORT}`);
      resolve();
    });
  });
}

async function stopTestServer() {
  if (testServer) {
    logInfo('关闭测试服务器...');
    return new Promise((resolve) => {
      testServer.close(() => {
        logSuccess('测试服务器已关闭');
        resolve();
      });
    });
  }
}

async function testApi() {
  logSection('API 接口测试');

  logInfo('测试获取工单列表...');
  try {
    const response = await httpRequest('/api/tickets');
    if (response.status === 200 && response.data.success) {
      logSuccess(`获取工单列表成功，共 ${response.data.data.length} 条`);
    } else {
      logError(`获取工单列表失败: ${response.data?.error || response.status}`);
    }
  } catch (err) {
    logError(`获取工单列表请求失败: ${err.message}`);
  }

  logInfo('测试创建工单...');
  const testTicket = {
    customer_name: 'API测试用户',
    customer_phone: '13800138088',
    device_model: 'API测试型号',
    fault_description: 'API测试工单',
    quote_amount: 888,
    repair_parts: 'API测试配件',
    notes: 'API测试备注'
  };

  let createdTicketId = null;

  try {
    const response = await httpRequest('/api/tickets', {
      method: 'POST',
      body: testTicket
    });
    
    if (response.status === 201 && response.data.success) {
      createdTicketId = response.data.data.id;
      logSuccess(`创建工单成功，ID: ${createdTicketId}, 工单号: ${response.data.data.ticket_number}`);
    } else {
      logError(`创建工单失败: ${response.data?.error || JSON.stringify(response.data?.messages) || response.status}`);
    }
  } catch (err) {
    logError(`创建工单请求失败: ${err.message}`);
  }

  if (createdTicketId) {
    logInfo('测试获取工单详情...');
    try {
      const response = await httpRequest(`/api/tickets/${createdTicketId}`);
      if (response.status === 200 && response.data.success) {
        logSuccess(`获取工单详情成功: ${response.data.data.customer_name}`);
      } else {
        logError(`获取工单详情失败: ${response.data?.error || response.status}`);
      }
    } catch (err) {
      logError(`获取工单详情请求失败: ${err.message}`);
    }

    logInfo('测试更新工单...');
    try {
      const response = await httpRequest(`/api/tickets/${createdTicketId}`, {
        method: 'PUT',
        body: {
          quote_amount: 1299,
          notes: '已更新API测试备注'
        }
      });
      
      if (response.status === 200 && response.data.success) {
        logSuccess(`更新工单成功，新报价: ¥${response.data.data.quote_amount}`);
      } else {
        logError(`更新工单失败: ${response.data?.error || JSON.stringify(response.data?.messages) || response.status}`);
      }
    } catch (err) {
      logError(`更新工单请求失败: ${err.message}`);
    }

    logInfo('测试状态流转...');
    try {
      const response = await httpRequest(`/api/tickets/${createdTicketId}/status`, {
        method: 'POST',
        body: {
          new_status: '报价中',
          reason: 'API测试状态变更'
        }
      });
      
      if (response.status === 200 && response.data.success) {
        logSuccess(`状态流转成功: 待检测 → ${response.data.data.status}`);
      } else {
        logError(`状态流转失败: ${response.data?.error || response.status}`);
      }
    } catch (err) {
      logError(`状态流转请求失败: ${err.message}`);
    }

    logInfo('测试非法状态流转（应该被拒绝）...');
    try {
      const response = await httpRequest(`/api/tickets/${createdTicketId}/status`, {
        method: 'POST',
        body: {
          new_status: '已完成',
          reason: '尝试非法跳转到已完成'
        }
      });
      
      if (response.status === 400 || !response.data?.success) {
        logSuccess('非法状态流转正确被拒绝');
      } else {
        logError('非法状态流转应该被拒绝，但却成功了');
      }
    } catch (err) {
      logSuccess(`非法状态流转被拒绝: ${err.message}`);
    }
  }
}

async function testSearchFilter() {
  logSection('搜索和筛选测试');

  logInfo('测试搜索功能...');
  try {
    const response = await httpRequest('/api/tickets?search=张三');
    if (response.status === 200 && response.data.success) {
      logSuccess(`搜索"张三"成功，找到 ${response.data.data.length} 条结果`);
    } else {
      logError(`搜索失败: ${response.data?.error || response.status}`);
    }
  } catch (err) {
    logError(`搜索请求失败: ${err.message}`);
  }

  logInfo('测试状态筛选...');
  try {
    const response = await httpRequest('/api/tickets?status=维修中');
    if (response.status === 200 && response.data.success) {
      const allAreRepairing = response.data.data.every(t => t.status === '维修中');
      if (allAreRepairing) {
        logSuccess(`状态筛选"维修中"成功，共 ${response.data.data.length} 条`);
      } else {
        logError('状态筛选结果包含非维修中状态');
      }
    } else {
      logError(`状态筛选失败: ${response.data?.error || response.status}`);
    }
  } catch (err) {
    logError(`状态筛选请求失败: ${err.message}`);
  }
}

async function main() {
  console.log('\n🚀 开始运行测试套件\n');

  try {
    await testDatabase();
    
    await startTestServer();
    
    await testApi();
    
    await testSearchFilter();
    
    await stopTestServer();
    
    console.log('\n' + '='.repeat(50));
    console.log('📊 测试结果汇总');
    console.log('='.repeat(50));
    console.log(`✅ 通过: ${testsPassed}`);
    console.log(`❌ 失败: ${testsFailed}`);
    console.log('='.repeat(50));
    
    if (testsFailed > 0) {
      console.log('\n⚠️  部分测试失败，请检查代码');
      process.exit(1);
    } else {
      console.log('\n🎉 所有测试通过！');
      process.exit(0);
    }
    
  } catch (err) {
    console.error('\n❌ 测试执行失败:', err);
    await stopTestServer();
    process.exit(1);
  }
}

main();
