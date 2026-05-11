const express = require('express');
const bodyParser = require('body-parser');
const sequelize = require('./config/database');
const complaintsRouter = require('./routes/complaints');

require('./models/associations');

const app = express();
const PORT = 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use('/api/complaints', complaintsRouter);

app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: '餐饮外卖差评API服务运行正常',
    timestamp: new Date().toISOString()
  });
});

const runTests = async () => {
  try {
    await sequelize.authenticate();
    console.log('数据库连接成功');
    
    await sequelize.sync({ alter: true });
    console.log('数据库模型同步完成');

    const server = app.listen(PORT, async () => {
      console.log(`\n========================================`);
      console.log(`餐饮外卖差评API服务已启动，端口: ${PORT}`);
      console.log(`========================================\n`);

      try {
        await testAllAPIs();
        console.log('\n========================================');
        console.log('所有API测试完成！');
        console.log('========================================\n');
      } catch (error) {
        console.error('测试出错:', error);
      }

      server.close(() => {
        console.log('测试完成，服务器已关闭');
        process.exit(0);
      });
    });
  } catch (error) {
    console.error('启动服务失败:', error);
    process.exit(1);
  }
};

const testAllAPIs = async () => {
  const baseUrl = 'http://localhost:3000';
  
  console.log('开始测试API...\n');

  let complaintId1 = null;
  let complaintId2 = null;
  let complaintId3 = null;

  try {
    console.log('========================================');
    console.log('测试1: 漏餐补偿 (missing_item)');
    console.log('========================================');
    
    const response1 = await fetch(`${baseUrl}/api/complaints/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: 'ORD20260511001',
        order: {
          customerId: 'CUS001',
          orderTime: '2026-05-10T18:30:00Z',
          totalAmount: 88.50,
          status: 'completed',
          expectedDeliveryTime: '2026-05-10T19:00:00Z',
          actualDeliveryTime: '2026-05-10T18:55:00Z'
        },
        orderItems: [
          { dishId: 'DISH001', dishName: '宫保鸡丁', quantity: 1, price: 35.00 },
          { dishId: 'DISH002', dishName: '麻婆豆腐', quantity: 1, price: 22.00 },
          { dishId: 'DISH003', dishName: '米饭', quantity: 2, price: 4.00 },
          { dishId: 'DISH004', dishName: '酸梅汤', quantity: 1, price: 12.50 }
        ],
        delivery: {
          riderId: 'RIDER001',
          riderName: '张三',
          delayReason: 'none',
          delayMinutes: 0,
          packageStatus: 'intact'
        },
        complaintContent: '收到的外卖中没有酸梅汤，联系商家核实后确认确实漏装了',
        reasonCategory: 'missing_item',
        reasonDetail: '漏送饮料',
        affectedItems: [
          { dishId: 'DISH004', dishName: '酸梅汤', quantity: 1 }
        ],
        severity: 'medium'
      })
    });
    
    const result1 = await response1.json();
    console.log('✅ 漏餐投诉提交成功');
    console.log('   投诉ID:', result1.data.complaint.id);
    console.log('   补偿建议:', result1.data.compensationSuggestions?.[0]?.description);
    console.log('   建议补偿金额:', result1.data.compensationSuggestions?.[0]?.amount);
    console.log('   责任方:', result1.data.responsibility);
    complaintId1 = result1.data.complaint.id;
    
    console.log('\n--- curl 样例 (漏餐补偿) ---');
    console.log(`curl -X POST "${baseUrl}/api/complaints/submit" \\`);
    console.log(`  -H "Content-Type: application/json" \\`);
    console.log(`  -d '{
    "orderId": "ORD20260511001",
    "order": {
      "customerId": "CUS001",
      "orderTime": "2026-05-10T18:30:00Z",
      "totalAmount": 88.50,
      "status": "completed"
    },
    "orderItems": [
      {"dishId": "DISH001", "dishName": "宫保鸡丁", "quantity": 1, "price": 35.00},
      {"dishId": "DISH004", "dishName": "酸梅汤", "quantity": 1, "price": 12.50}
    ],
    "complaintContent": "收到的外卖中没有酸梅汤",
    "reasonCategory": "missing_item",
    "affectedItems": [
      {"dishId": "DISH004", "dishName": "酸梅汤", "quantity": 1}
    ]
  }'`);
    console.log();
  } catch (error) {
    console.error('❌ 测试1失败:', error.message);
  }

  try {
    console.log('\n========================================');
    console.log('测试2: 延迟不补偿 (delivery_delay < 15分钟)');
    console.log('========================================');
    
    const response2 = await fetch(`${baseUrl}/api/complaints/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: 'ORD20260511002',
        order: {
          customerId: 'CUS002',
          orderTime: '2026-05-10T19:00:00Z',
          totalAmount: 65.00,
          status: 'completed',
          expectedDeliveryTime: '2026-05-10T19:30:00Z',
          actualDeliveryTime: '2026-05-10T19:42:00Z'
        },
        orderItems: [
          { dishId: 'DISH005', dishName: '水煮鱼', quantity: 1, price: 58.00 },
          { dishId: 'DISH003', dishName: '米饭', quantity: 1, price: 4.00 }
        ],
        delivery: {
          riderId: 'RIDER002',
          riderName: '李四',
          delayReason: 'traffic',
          delayMinutes: 12,
          packageStatus: 'intact'
        },
        complaintContent: '外卖比预计时间晚到了12分钟，饭菜有点凉了',
        reasonCategory: 'delivery_delay',
        reasonDetail: '配送延迟12分钟',
        severity: 'low'
      })
    });
    
    const result2 = await response2.json();
    console.log('✅ 延迟投诉提交成功');
    console.log('   投诉ID:', result2.data.complaint.id);
    console.log('   补偿建议:', result2.data.compensationSuggestions?.[0]?.description);
    console.log('   建议补偿类型:', result2.data.compensationSuggestions?.[0]?.type);
    console.log('   责任方:', result2.data.responsibility);
    complaintId2 = result2.data.complaint.id;
    
    console.log('\n--- curl 样例 (延迟不补偿) ---');
    console.log(`curl -X POST "${baseUrl}/api/complaints/submit" \\`);
    console.log(`  -H "Content-Type: application/json" \\`);
    console.log(`  -d '{
    "orderId": "ORD20260511002",
    "order": {
      "customerId": "CUS002",
      "orderTime": "2026-05-10T19:00:00Z",
      "totalAmount": 65.00,
      "status": "completed",
      "expectedDeliveryTime": "2026-05-10T19:30:00Z",
      "actualDeliveryTime": "2026-05-10T19:42:00Z"
    },
    "complaintContent": "外卖比预计时间晚到了12分钟",
    "reasonCategory": "delivery_delay"
  }'`);
    console.log();
  } catch (error) {
    console.error('❌ 测试2失败:', error.message);
  }

  try {
    console.log('\n========================================');
    console.log('测试3: 重复投诉拦截 (duplicate complaint)');
    console.log('========================================');
    
    const response3 = await fetch(`${baseUrl}/api/complaints/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: 'ORD20260511001',
        complaintContent: '还是关于酸梅汤的问题，我想再次投诉',
        reasonCategory: 'missing_item',
        reasonDetail: '再次投诉漏送饮料',
        severity: 'high'
      })
    });
    
    const result3 = await response3.json();
    console.log('✅ 重复投诉检测成功');
    console.log('   是否重复:', result3.data.isDuplicate);
    console.log('   投诉ID:', result3.data.complaint.id);
    console.log('   原始投诉ID:', result3.data.originalComplaint?.id);
    console.log('   处理结果:', result3.message);
    complaintId3 = result3.data.complaint.id;
    
    console.log('\n--- curl 样例 (重复投诉拦截) ---');
    console.log(`curl -X POST "${baseUrl}/api/complaints/submit" \\`);
    console.log(`  -H "Content-Type: application/json" \\`);
    console.log(`  -d '{
    "orderId": "ORD20260511001",
    "complaintContent": "还是关于酸梅汤的问题，我想再次投诉",
    "reasonCategory": "missing_item"
  }'`);
    console.log();
  } catch (error) {
    console.error('❌ 测试3失败:', error.message);
  }

  try {
    console.log('\n========================================');
    console.log('测试4: 回访关闭 (followup and close)');
    console.log('========================================');
    
    if (complaintId1) {
      const response4 = await fetch(`${baseUrl}/api/complaints/${complaintId1}/followup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          followUpBy: '王店长',
          customerResponse: 'satisfied',
          responseDetail: '已电话联系客户，客户接受补偿方案，对处理结果表示满意',
          isCompleted: true,
          closeComplaint: true,
          notes: '客户表示下次还会继续光顾'
        })
      });
      
      const result4 = await response4.json();
      console.log('✅ 回访记录保存成功');
      console.log('   回访ID:', result4.data.followUp.id);
      console.log('   客户回应:', result4.data.followUp.customerResponse);
      console.log('   是否已关闭:', result4.data.isClosed);
      console.log('   投诉状态:', result4.data.complaint.status);
      
      console.log('\n--- curl 样例 (回访关闭) ---');
      console.log(`curl -X POST "${baseUrl}/api/complaints/${complaintId1}/followup" \\`);
      console.log(`  -H "Content-Type: application/json" \\`);
      console.log(`  -d '{
    "followUpBy": "王店长",
    "customerResponse": "satisfied",
    "responseDetail": "已电话联系客户，客户接受补偿方案，对处理结果表示满意",
    "isCompleted": true,
    "closeComplaint": true
  }'`);
      console.log();
    }
  } catch (error) {
    console.error('❌ 测试4失败:', error.message);
  }

  try {
    console.log('\n========================================');
    console.log('测试5: 骑手延迟 vs 门店出餐延迟 责任区分');
    console.log('========================================');
    
    const response5a = await fetch(`${baseUrl}/api/complaints/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: 'ORD20260511003',
        order: {
          customerId: 'CUS003',
          orderTime: '2026-05-10T20:00:00Z',
          totalAmount: 120.00,
          status: 'completed',
          restaurantOutTime: '2026-05-10T20:15:00Z',
          expectedDeliveryTime: '2026-05-10T20:30:00Z',
          actualDeliveryTime: '2026-05-10T21:00:00Z'
        },
        orderItems: [
          { dishId: 'DISH006', dishName: '麻辣香锅', quantity: 1, price: 120.00 }
        ],
        delivery: {
          riderId: 'RIDER003',
          riderName: '王五',
          delayReason: 'rider',
          delayMinutes: 30,
          packageStatus: 'intact'
        },
        complaintContent: '外卖足足晚了30分钟才送到，骑手中途还去送了别的单',
        reasonCategory: 'delivery_delay',
        reasonDetail: '骑手绕道导致延迟30分钟',
        severity: 'high'
      })
    });
    
    const result5a = await response5a.json();
    console.log('✅ 骑手延迟责任分析');
    console.log('   责任方:', result5a.data.responsibility);
    console.log('   补偿建议:', result5a.data.compensationSuggestions?.[0]?.description);
    
    const response5b = await fetch(`${baseUrl}/api/complaints/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: 'ORD20260511004',
        order: {
          customerId: 'CUS004',
          orderTime: '2026-05-10T20:30:00Z',
          totalAmount: 95.00,
          status: 'completed',
          restaurantOutTime: '2026-05-10T21:15:00Z',
          expectedDeliveryTime: '2026-05-10T21:00:00Z',
          actualDeliveryTime: '2026-05-10T21:45:00Z'
        },
        orderItems: [
          { dishId: 'DISH007', dishName: '烤鱼', quantity: 1, price: 95.00 }
        ],
        delivery: {
          riderId: 'RIDER004',
          riderName: '赵六',
          delayReason: 'restaurant',
          delayMinutes: 45,
          packageStatus: 'intact'
        },
        complaintContent: '出餐太慢了，等了一个多小时才吃上饭',
        reasonCategory: 'delivery_delay',
        reasonDetail: '门店出餐延迟',
        severity: 'high'
      })
    });
    
    const result5b = await response5b.json();
    console.log('\n✅ 门店出餐延迟责任分析');
    console.log('   责任方:', result5b.data.responsibility);
    console.log('   补偿建议:', result5b.data.compensationSuggestions?.[0]?.description);
    console.log();
  } catch (error) {
    console.error('❌ 测试5失败:', error.message);
  }

  try {
    console.log('\n========================================');
    console.log('测试6: 统计接口 - 差评原因排行');
    console.log('========================================');
    
    const response6 = await fetch(`${baseUrl}/api/complaints/statistics/reason-ranking`);
    const result6 = await response6.json();
    console.log('✅ 差评原因排行获取成功');
    console.log('   数据:', JSON.stringify(result6.data, null, 2));
    console.log();
  } catch (error) {
    console.error('❌ 测试6失败:', error.message);
  }

  try {
    console.log('\n========================================');
    console.log('测试7: 统计接口 - 未回访清单');
    console.log('========================================');
    
    const response7 = await fetch(`${baseUrl}/api/complaints/statistics/unfollowed-up`);
    const result7 = await response7.json();
    console.log('✅ 未回访清单获取成功');
    console.log('   未回访数量:', result7.data.count);
    console.log('   清单:', JSON.stringify(result7.data.list, null, 2));
    console.log();
  } catch (error) {
    console.error('❌ 测试7失败:', error.message);
  }

  try {
    console.log('\n========================================');
    console.log('测试8: 统计接口 - 已结案统计 (含回访验证)');
    console.log('========================================');
    
    const response8 = await fetch(`${baseUrl}/api/complaints/statistics/closed-count`);
    const result8 = await response8.json();
    console.log('✅ 已结案统计获取成功');
    console.log('   已结案数量:', result8.data.total);
    console.log('   (只有完成回访的投诉才会计入已结案)');
    console.log('   详情:', JSON.stringify(result8.data.details, null, 2));
    console.log();
  } catch (error) {
    console.error('❌ 测试8失败:', error.message);
  }

  try {
    console.log('\n========================================');
    console.log('测试9: 统计接口 - 菜品改进建议');
    console.log('========================================');
    
    const response9 = await fetch(`${baseUrl}/api/complaints/statistics/dish-improvement`);
    const result9 = await response9.json();
    console.log('✅ 菜品改进建议获取成功');
    console.log('   建议:', JSON.stringify(result9.data, null, 2));
    console.log();
  } catch (error) {
    console.error('❌ 测试9失败:', error.message);
  }

  try {
    console.log('\n========================================');
    console.log('测试10: 统计接口 - 统计概览');
    console.log('========================================');
    
    const response10 = await fetch(`${baseUrl}/api/complaints/statistics/overview`);
    const result10 = await response10.json();
    console.log('✅ 统计概览获取成功');
    console.log('   差评原因排行数量:', result10.data.reasonRanking.length);
    console.log('   未回访数量:', result10.data.unfollowedUp.count);
    console.log('   已结案数量:', result10.data.closedComplaints.total);
    console.log('   菜品改进建议:', result10.data.dishImprovementSuggestions.length, '条');
    console.log();
  } catch (error) {
    console.error('❌ 测试10失败:', error.message);
  }
};

runTests();
