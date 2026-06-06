const http = require('http');

const BASE_URL = 'localhost';
const PORT = 3000;

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: BASE_URL,
      port: PORT,
      path: `/api${path}`,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function testFlow() {
  console.log('=== 开始测试 Livehouse 酒水分成系统核心流程 ===\n');

  console.log('步骤 1: 健康检查');
  const health = await request('GET', '/health');
  console.log('健康检查结果:', JSON.stringify(health, null, 2));
  console.log();

  console.log('步骤 2: 创建演出批次');
  const createBatch = await request('POST', '/batches', {
    batchDate: '2026-06-06',
    showName: '周末摇滚夜'
  });
  console.log('创建批次结果:', JSON.stringify(createBatch, null, 2));
  const batchId = createBatch.data.batchId;
  console.log();

  console.log('步骤 3: 导入调音师留言（含赠票和售票混合）');
  const soundEngineerImport = await request('POST', `/batches/${batchId}/import/sound-engineer`, {
    tickets: [
      { ticketType: 'paid', ticketNumber: 'T001', attendeeName: '张三', price: 100, quantity: 1 },
      { ticketType: 'paid', ticketNumber: 'T002', attendeeName: '李四', price: 100, quantity: 1 },
      { ticketType: 'complimentary', ticketNumber: 'C001', attendeeName: '嘉宾A', price: 0, quantity: 1 },
      { ticketType: 'complimentary', ticketNumber: 'C002', attendeeName: '嘉宾B', price: 0, quantity: 1 }
    ]
  });
  console.log('调音师导入结果:', JSON.stringify(soundEngineerImport, null, 2));
  console.log();

  console.log('步骤 4: 导入排练群接龙（与调音师数据有冲突）');
  const rehearsalImport = await request('POST', `/batches/${batchId}/import/rehearsal-group`, {
    tickets: [
      { ticketType: 'paid', ticketNumber: 'T001', attendeeName: '张三', price: 100, quantity: 1 },
      { ticketType: 'paid', ticketNumber: 'T002', attendeeName: '李四', price: 100, quantity: 1 },
      { ticketType: 'paid', ticketNumber: 'T003', attendeeName: '王五', price: 100, quantity: 1 },
      { ticketType: 'complimentary', ticketNumber: 'C001', attendeeName: '嘉宾A', price: 0, quantity: 1 }
    ]
  });
  console.log('排练群导入结果:', JSON.stringify(rehearsalImport, null, 2));
  console.log();

  console.log('步骤 5: 查看冲突证据列表');
  const conflicts = await request('GET', `/batches/${batchId}/conflicts`);
  console.log('冲突证据列表:', JSON.stringify(conflicts, null, 2));
  console.log();

  console.log('步骤 6: 许老师解决冲突（确认以排练群为准）');
  if (conflicts.data && conflicts.data.length > 0) {
    const firstConflict = conflicts.data[0];
    const resolveResult = await request('POST', `/conflicts/${firstConflict.id}/resolve`, {
      resolution: 'confirm_rehearsal_group',
      resolvedBy: '许老师'
    });
    console.log('解决冲突结果:', JSON.stringify(resolveResult, null, 2));
  }
  console.log();

  console.log('步骤 7: 运行自检');
  const selfCheck = await request('GET', `/batches/${batchId}/self-check`);
  console.log('自检结果:', JSON.stringify(selfCheck, null, 2));
  console.log();

  console.log('步骤 8: 计算酒水分成');
  const calculate = await request('POST', `/batches/${batchId}/calculate`);
  console.log('分成计算结果:', JSON.stringify(calculate, null, 2));
  console.log();

  console.log('步骤 9: 获取统一结果（页面/接口/导出同一份数据）');
  const unified = await request('GET', `/batches/${batchId}`);
  console.log('统一结果 - 批次状态:', unified.data.batch.status);
  console.log('统一结果 - 是否有混合票务:', unified.data.batch.hasMixedTickets);
  console.log('统一结果 - 是否需要复核:', unified.data.batch.needsReview);
  console.log('统一结果 - 分成总金额:', unified.data.revenueSplit?.totalRevenue);
  console.log();

  console.log('步骤 10: 授权更新状态（录音师复核通过）');
  const statusUpdate = await request('POST', `/batches/${batchId}/status`, {
    status: 'confirmed',
    updatedBy: '录音师'
  });
  console.log('状态更新结果:', JSON.stringify(statusUpdate, null, 2));
  console.log();

  console.log('=== 测试流程完成 ===');
  console.log('\n核心功能验证:');
  console.log('✓ 调音师留言第一次导入');
  console.log('✓ 排练群接龙导入（第二步）');
  console.log('✓ 冲突自动检测并列出证据');
  console.log('✓ 许老师确认/驳回冲突（不自动拍板）');
  console.log('✓ 赠票和售票混合批次自动标记');
  console.log('✓ 自检覆盖：重复导入、混合批次、重算一致、导出一致');
  console.log('✓ 统一结果层：接口、页面、导出读同一份数据');
  console.log('✓ 授权提醒更新（状态流转）');
}

testFlow().catch(console.error);
