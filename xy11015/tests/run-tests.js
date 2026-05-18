const fs = require('fs');
const path = require('path');

const testDataFile = path.join(__dirname, '../data/test-evaluations.json');

function initTestData() {
  if (fs.existsSync(testDataFile)) {
    fs.unlinkSync(testDataFile);
  }
}

function runTest(testName, testFn) {
  try {
    testFn();
    console.log(`✓ ${testName}`);
    return true;
  } catch (error) {
    console.log(`✗ ${testName}`);
    console.log(`  错误: ${error.message}`);
    return false;
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: 期望 ${expected}, 实际 ${actual}`);
  }
}

function assertTrue(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertNotNull(value, message) {
  if (value === null || value === undefined) {
    throw new Error(message);
  }
}

function runAllTests() {
  console.log('========================================');
  console.log('  家政派单点保姆试工评价 API 测试');
  console.log('========================================\n');

  initTestData();

  const Evaluation = require('../src/models/Evaluation');
  const EvaluationStore = require('../src/stores/EvaluationStore');
  
  const store = new EvaluationStore(testDataFile);
  
  let passed = 0;
  let failed = 0;

  const tests = [
    {
      name: '1. 数据模型 - 必填字段验证',
      fn: () => {
        const result = Evaluation.validate({});
        assertFalse(result.isValid, '空数据应该验证失败');
        assertTrue(result.errors.length > 0, '应该有错误信息');
      }
    },
    {
      name: '2. 数据模型 - 状态枚举验证',
      fn: () => {
        const result = Evaluation.validate({
          orderNo: 'TEST001',
          storeId: 'ST001',
          storeName: '测试门店',
          auntId: 'AUNT001',
          auntName: '测试阿姨',
          customerId: 'CUST001',
          customerName: '测试客户',
          trialDate: '2024-01-01',
          status: '无效状态'
        });
        assertFalse(result.isValid, '无效状态应该验证失败');
        assertTrue(result.errors.some(e => e.includes('状态值无效')), '应该有状态错误信息');
      }
    },
    {
      name: '3. 数据存储 - 创建评价记录',
      fn: () => {
        const data = {
          orderNo: 'TEST001',
          storeId: 'ST001',
          storeName: '测试门店',
          managerId: 'MGR001',
          managerName: '王经理',
          auntId: 'AUNT001',
          auntName: '李阿姨',
          auntPhone: '13800138001',
          customerId: 'CUST001',
          customerName: '张先生',
          customerPhone: '13900139001',
          serviceType: '日常保洁',
          trialDate: '2024-01-15',
          trialDuration: 4,
          status: '已评价',
          overallRating: '非常满意'
        };
        
        const evaluation = store.create(data);
        assertNotNull(evaluation.id, '应该生成ID');
        assertEqual(evaluation.orderNo, 'TEST001', '订单号应该一致');
      }
    },
    {
      name: '4. 数据存储 - 根据ID查询',
      fn: () => {
        const all = store.readAll();
        const first = all[0];
        const found = store.findById(first.id);
        assertNotNull(found, '应该能找到记录');
        assertEqual(found.id, first.id, 'ID应该一致');
      }
    },
    {
      name: '5. 数据存储 - 根据订单号查询',
      fn: () => {
        const found = store.findByOrderNo('TEST001');
        assertNotNull(found, '应该能找到记录');
        assertEqual(found.orderNo, 'TEST001', '订单号应该一致');
      }
    },
    {
      name: '6. 数据存储 - 更新评价记录',
      fn: () => {
        const all = store.readAll();
        const first = all[0];
        const updated = store.update(first.id, { comment: '更新后的评价' });
        assertEqual(updated.comment, '更新后的评价', '评论应该更新');
      }
    },
    {
      name: '7. 筛选功能 - 按状态筛选',
      fn: () => {
        const results = store.findByFilters({ status: '已评价' });
        assertTrue(results.length >= 1, '应该能筛选出已评价的记录');
        results.forEach(r => {
          assertEqual(r.status, '已评价', '状态应该正确');
        });
      }
    },
    {
      name: '8. 筛选功能 - 按日期范围筛选',
      fn: () => {
        const results = store.findByFilters({ startDate: '2024-01-01', endDate: '2024-12-31' });
        assertTrue(results.length >= 1, '应该能筛选出日期范围内的记录');
      }
    },
    {
      name: '9. 筛选功能 - 按门店筛选',
      fn: () => {
        const results = store.findByFilters({ storeId: 'ST001' });
        assertTrue(results.length >= 1, '应该能筛选出对应门店的记录');
        results.forEach(r => {
          assertEqual(r.storeId, 'ST001', '门店ID应该正确');
        });
      }
    },
    {
      name: '10. 批量导入 - 正常数据导入',
      fn: () => {
        const items = [
          {
            orderNo: 'BATCH001',
            storeId: 'ST001',
            storeName: '测试门店',
            auntId: 'AUNT001',
            auntName: '李阿姨',
            customerId: 'CUST001',
            customerName: '张先生',
            trialDate: '2024-01-20'
          },
          {
            orderNo: 'BATCH002',
            storeId: 'ST001',
            storeName: '测试门店',
            auntId: 'AUNT002',
            auntName: '王阿姨',
            customerId: 'CUST002',
            customerName: '李女士',
            trialDate: '2024-01-21'
          }
        ];
        
        const result = store.batchImport(items);
        assertEqual(result.total, 2, '总数量应该正确');
        assertEqual(result.success, 2, '成功数量应该正确');
        assertEqual(result.fail, 0, '失败数量应该正确');
      }
    },
    {
      name: '11. 批量导入 - 部分失败不中断',
      fn: () => {
        const items = [
          {
            orderNo: 'BATCH003',
            storeId: 'ST001',
            storeName: '测试门店',
            auntId: 'AUNT001',
            auntName: '李阿姨',
            customerId: 'CUST001',
            customerName: '张先生',
            trialDate: '2024-01-22'
          },
          {
            orderNo: '',
            storeId: 'ST001',
            storeName: '测试门店',
            auntId: 'AUNT001',
            auntName: '李阿姨',
            customerId: 'CUST001',
            customerName: '张先生',
            trialDate: '2024-01-23'
          },
          {
            orderNo: 'BATCH005',
            storeId: 'ST001',
            storeName: '测试门店',
            auntId: 'AUNT001',
            auntName: '李阿姨',
            customerId: 'CUST001',
            customerName: '张先生',
            trialDate: '2024-01-24'
          }
        ];
        
        const result = store.batchImport(items);
        assertEqual(result.total, 3, '总数量应该正确');
        assertEqual(result.success, 2, '成功数量应该正确');
        assertEqual(result.fail, 1, '失败数量应该正确');
        assertTrue(result.results[1].success === false, '第二条应该失败');
        assertTrue(result.results[0].success === true, '第一条应该成功');
        assertTrue(result.results[2].success === true, '第三条应该成功');
      }
    },
    {
      name: '12. 批量导入 - 重复订单号处理',
      fn: () => {
        const items = [
          {
            orderNo: 'TEST001',
            storeId: 'ST001',
            storeName: '测试门店',
            auntId: 'AUNT001',
            auntName: '李阿姨',
            customerId: 'CUST001',
            customerName: '张先生',
            trialDate: '2024-01-25'
          }
        ];
        
        const result = store.batchImport(items);
        assertEqual(result.success, 0, '应该导入失败');
        assertEqual(result.fail, 1, '应该有1条失败');
        assertTrue(result.results[0].errors.includes('订单号已存在'), '应该提示订单号已存在');
      }
    },
    {
      name: '13. 批量导入 - 返回行级结果',
      fn: () => {
        const items = [
          {
            orderNo: 'ROW001',
            storeId: 'ST001',
            storeName: '测试门店',
            auntId: 'AUNT001',
            auntName: '李阿姨',
            customerId: 'CUST001',
            customerName: '张先生',
            trialDate: '2024-01-26'
          },
          {
            orderNo: 'ROW002',
            storeId: '',
            storeName: '',
            auntId: 'AUNT001',
            auntName: '李阿姨',
            customerId: 'CUST001',
            customerName: '张先生',
            trialDate: '2024-01-27'
          }
        ];
        
        const result = store.batchImport(items);
        assertEqual(result.results.length, 2, '应该有2条结果');
        assertEqual(result.results[0].row, 1, '第一条行号应该是1');
        assertEqual(result.results[1].row, 2, '第二条行号应该是2');
        assertNotNull(result.results[0].orderNo, '应该返回订单号');
      }
    },
    {
      name: '14. 数据存储 - 删除评价记录',
      fn: () => {
        const all = store.readAll();
        const first = all[0];
        const deleteResult = store.delete(first.id);
        assertTrue(deleteResult, '删除应该成功');
        const found = store.findById(first.id);
        assertTrue(found === undefined, '删除后应该找不到记录');
      }
    },
    {
      name: '15. 枚举值验证 - 状态枚举',
      fn: () => {
        assertTrue(Array.isArray(Evaluation.STATUS_ENUMS), '状态应该是数组');
        assertTrue(Evaluation.STATUS_ENUMS.includes('已评价'), '应该包含"已评价"');
        assertTrue(Evaluation.STATUS_ENUMS.includes('待评价'), '应该包含"待评价"');
        assertTrue(Evaluation.STATUS_ENUMS.includes('已回访'), '应该包含"已回访"');
      }
    },
    {
      name: '16. 枚举值验证 - 服务类型',
      fn: () => {
        assertTrue(Array.isArray(Evaluation.SERVICE_TYPES), '服务类型应该是数组');
        assertTrue(Evaluation.SERVICE_TYPES.includes('日常保洁'), '应该包含"日常保洁"');
        assertTrue(Evaluation.SERVICE_TYPES.includes('育儿嫂'), '应该包含"育儿嫂"');
        assertTrue(Evaluation.SERVICE_TYPES.includes('月嫂'), '应该包含"月嫂"');
      }
    }
  ];

  tests.forEach(test => {
    const isPassed = runTest(test.name, test.fn);
    if (isPassed) {
      passed++;
    } else {
      failed++;
    }
  });

  console.log('\n========================================');
  console.log(`  测试完成: 通过 ${passed}, 失败 ${failed}`);
  console.log('========================================');

  if (failed > 0) {
    process.exit(1);
  }
}

function assertFalse(condition, message) {
  if (condition) {
    throw new Error(message);
  }
}

runAllTests();
