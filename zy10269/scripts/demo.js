const http = require('http');

const BASE_URL = 'http://localhost:3000/api';
const CURRENT_MONTH = '2024-05';

function request(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + path);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          resolve(body);
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function waitForServer() {
  console.log('等待服务器启动...');
  for (let i = 0; i < 30; i++) {
    try {
      await request('GET', '/health');
      console.log('服务器已就绪');
      return;
    } catch (e) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  throw new Error('服务器启动超时');
}

async function demo() {
  try {
    await waitForServer();

    console.log('\n========================================');
    console.log('  农贸摊位卫生扣分 API 系统演示');
    console.log('========================================\n');

    console.log('1. 创建摊位...');
    const stall1 = await request('POST', '/stalls', {
      code: 'A001',
      name: '蔬菜摊位',
      ownerName: '张三',
      phone: '13800138001',
      area: 'A区',
      baseDiscountRate: 0.9
    });
    console.log('  创建摊位1:', stall1.name);

    const stall2 = await request('POST', '/stalls', {
      code: 'A002',
      name: '水果摊位',
      ownerName: '李四',
      phone: '13800138002',
      area: 'A区',
      baseDiscountRate: 0.9
    });
    console.log('  创建摊位2:', stall2.name);

    const stall3 = await request('POST', '/stalls', {
      code: 'B001',
      name: '肉类摊位',
      ownerName: '王五',
      phone: '13800138003',
      area: 'B区',
      baseDiscountRate: 0.9
    });
    console.log('  创建摊位3:', stall3.name);

    console.log('\n2. 创建卫生检查记录...');
    const inspection1 = await request('POST', '/inspections', {
      stallId: stall1.id,
      inspector: '李管理员',
      inspectionDate: '2024-05-15T10:00:00Z',
      remark: '日常检查'
    });
    console.log('  创建检查记录:', inspection1.inspectionNo);

    const inspection2 = await request('POST', '/inspections', {
      stallId: stall2.id,
      inspector: '李管理员',
      inspectionDate: '2024-05-15T10:30:00Z',
      remark: '日常检查'
    });
    console.log('  创建检查记录:', inspection2.inspectionNo);

    console.log('\n3. 进行扣分（优惠降低）...');
    const deduction1 = await request('POST', `/inspections/${inspection1.id}/deductions`, {
      reason: '地面有垃圾未清理',
      points: 5,
      category: '卫生'
    });
    console.log('  扣分成功:', deduction1.deduction.reason, '-', deduction1.deduction.points, '分');

    const deduction2 = await request('POST', `/inspections/${inspection2.id}/deductions`, {
      reason: '物品摆放不整齐',
      points: 3,
      category: '秩序'
    });
    console.log('  扣分成功:', deduction2.deduction.reason, '-', deduction2.deduction.points, '分');

    console.log('\n4. 查看摊位1的优惠情况...');
    const discount1 = await request('GET', `/discounts/stalls/${stall1.id}/${CURRENT_MONTH}`);
    console.log('  累计扣分:', discount1.totalPoints, '分');
    console.log('  优惠率:', (discount1.discountRate * 10).toFixed(1), '折');
    console.log('  优惠资格:', discount1.isEligible ? '有' : '无');

    console.log('\n5. 查看优惠调整历史...');
    const history = await request('GET', `/discounts/stalls/${stall1.id}/history`);
    history.forEach((item, index) => {
      console.log(`  ${index + 1}. ${item.sourceDescription}`);
      console.log(`     优惠率: ${(item.beforeRate * 10).toFixed(1)}折 -> ${(item.afterRate * 10).toFixed(1)}折`);
    });

    console.log('\n6. 摊位1创建投诉...');
    const complaint = await request('POST', '/complaints', {
      inspectionId: inspection1.id,
      stallId: stall1.id,
      complainant: '张三',
      reason: '当时已经清理完毕，扣分不合理'
    });
    console.log('  投诉创建成功:', complaint.complaintNo);

    console.log('\n7. 处理投诉（支持投诉，撤销扣分）...');
    const handled = await request('PUT', `/complaints/${complaint.id}/handle`, {
      handler: '王主管',
      status: 'upheld',
      handleResult: '经核实，投诉成立，撤销扣分'
    });
    console.log('  投诉处理结果:', handled.complaint.status === 'upheld' ? '投诉成立，已撤销扣分' : '投诉驳回');

    console.log('\n8. 再次查看摊位1的优惠情况（投诉后）...');
    const discount2 = await request('GET', `/discounts/stalls/${stall1.id}/${CURRENT_MONTH}`);
    console.log('  累计扣分:', discount2.totalPoints, '分');
    console.log('  优惠率:', (discount2.discountRate * 10).toFixed(1), '折');

    console.log('\n9. 创建整改通知...');
    const rectification = await request('POST', '/rectifications', {
      inspectionId: inspection2.id,
      stallId: stall2.id,
      requirement: '请在3日内整理物品，保持摆放整齐',
      deadline: '2024-05-18T23:59:59Z'
    });
    console.log('  整改通知创建成功:', rectification.rectificationNo);

    console.log('\n10. 提交整改报告...');
    const submitted = await request('PUT', `/rectifications/${rectification.id}/submit`, {
      description: '已完成物品整理，全部摆放整齐有序'
    });
    console.log('  整改提交成功，状态:', submitted.status);

    console.log('\n11. 复核整改并返还分数...');
    const review = await request('POST', `/rectifications/${rectification.id}/reviews`, {
      reviewer: '李管理员',
      result: 'pass',
      remark: '整改合格',
      pointsReturned: 2
    });
    console.log('  复核结果:', review.review.result === 'pass' ? '通过' : '不通过');
    console.log('  返还分数:', review.review.pointsReturned, '分');

    console.log('\n12. 查看摊位2的优惠情况（整改后）...');
    const discount3 = await request('GET', `/discounts/stalls/${stall2.id}/${CURRENT_MONTH}`);
    console.log('  累计扣分:', discount3.totalPoints, '分');
    console.log('  优惠率:', (discount3.discountRate * 10).toFixed(1), '折');

    console.log('\n13. 查询月度排名...');
    const ranking = await request('GET', `/discounts/ranking?month=${CURRENT_MONTH}&limit=10`);
    ranking.forEach((item, index) => {
      console.log(`  第${item.rank}名: ${item.stallName} - ${item.totalPoints}分 - ${(item.discountRate * 10).toFixed(1)}折`);
    });

    console.log('\n14. 锁定月份数据（防止篡改）...');
    const locked = await request('POST', '/discounts/lock', {
      month: CURRENT_MONTH
    });
    console.log(' ', locked.message);

    console.log('\n========================================');
    console.log('  演示完成！');
    console.log('========================================\n');

    console.log('提示:');
    console.log('  - 所有操作均已记录，可追溯');
    console.log('  - 月度数据已锁定，无法修改');
    console.log('  - 优惠调整历史完整记录每次变化来源');
    console.log('  - 防止了重复扣分、重复投诉、重复复核');
    console.log('\n');

  } catch (error) {
    console.error('演示出错:', error.message);
    process.exit(1);
  }
}

demo();
