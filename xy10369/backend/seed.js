const { run, get, all, hashIdCard, uuidv4 } = require('./database');

const seedData = () => {
  console.log('开始插入种子数据...');

  const customers = [
    { id: uuidv4(), name: '张三', idCard: '110101199001011234', gender: '男', birthday: '1990-01-01', phone: '13800138001' },
    { id: uuidv4(), name: '李四', idCard: '110101199002022345', gender: '女', birthday: '1990-02-02', phone: '13800138002' },
    { id: uuidv4(), name: '王五', idCard: '110101199003033456', gender: '男', birthday: '1990-03-03', phone: '13800138003' },
    { id: uuidv4(), name: '赵六', idCard: '110101199004044567', gender: '女', birthday: '1990-04-04', phone: '13800138004' }
  ];

  customers.forEach(c => {
    const existing = get('SELECT id FROM customers WHERE id_card_hash = ?', [hashIdCard(c.idCard)]);
    if (!existing) {
      run(
        'INSERT INTO customers (id, id_card_hash, name, gender, birthday, phone) VALUES (?, ?, ?, ?, ?, ?)',
        [c.id, hashIdCard(c.idCard), c.name, c.gender, c.birthday, c.phone]
      );
    }
  });
  console.log('客户数据插入完成');

  let packageId = uuidv4();
  const existingPackage = get('SELECT id FROM packages WHERE code = ?', ['PKG001']);
  if (existingPackage) {
    packageId = existingPackage.id;
  } else {
    run(
      'INSERT INTO packages (id, code, name, description) VALUES (?, ?, ?, ?)',
      [packageId, 'PKG001', '入职体检套餐A', '包含基础体检项目，适合新员工入职']
    );
  }

  const items = [
    { id: uuidv4(), itemCode: 'ITEM001', itemName: '身高体重', department: '一般检查', sortOrder: 1 },
    { id: uuidv4(), itemCode: 'ITEM002', itemName: '血压', department: '一般检查', sortOrder: 2 },
    { id: uuidv4(), itemCode: 'ITEM003', itemName: '血常规', department: '检验科', sortOrder: 3 },
    { id: uuidv4(), itemCode: 'ITEM004', itemName: '肝功能', department: '检验科', sortOrder: 4 },
    { id: uuidv4(), itemCode: 'ITEM005', itemName: '胸片', department: '放射科', sortOrder: 5 },
    { id: uuidv4(), itemCode: 'ITEM006', itemName: '心电图', department: '功能科', sortOrder: 6 }
  ];

  items.forEach(item => {
    const existing = get('SELECT id FROM package_items WHERE package_id = ? AND item_code = ?', [packageId, item.itemCode]);
    if (!existing) {
      run(
        'INSERT INTO package_items (id, package_id, item_code, item_name, department, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
        [item.id, packageId, item.itemCode, item.itemName, item.department, item.sortOrder]
      );
    } else {
      item.id = existing.id;
    }
  });
  console.log('套餐项目数据插入完成');

  const records = [
    {
      id: uuidv4(),
      recordNo: 'REC20240101001',
      customer: customers[0],
      checkDate: '2024-01-01',
      reportStatus: 'completed',
      itemStatuses: ['completed', 'completed', 'completed', 'completed', 'completed', 'completed'],
      needRecheck: false,
      hasReceived: true
    },
    {
      id: uuidv4(),
      recordNo: 'REC20240115002',
      customer: customers[1],
      checkDate: '2024-01-15',
      reportStatus: 'pending',
      itemStatuses: ['completed', 'completed', 'pending', 'completed', 'completed', 'completed'],
      needRecheck: false,
      hasReceived: false
    },
    {
      id: uuidv4(),
      recordNo: 'REC20240201003',
      customer: customers[2],
      checkDate: '2024-02-01',
      reportStatus: 'recheck_pending',
      itemStatuses: ['completed', 'completed', 'completed', 'completed', 'completed', 'completed'],
      needRecheck: true,
      recheckItemIndex: 2,
      hasReceived: false
    },
    {
      id: uuidv4(),
      recordNo: 'REC20240215004',
      customer: customers[3],
      checkDate: '2024-02-15',
      reportStatus: 'completed',
      itemStatuses: ['completed', 'completed', 'completed', 'completed', 'completed', 'completed'],
      needRecheck: false,
      hasReceived: true,
      hasDuplicateRequest: true
    }
  ];

  records.forEach((record, idx) => {
    const existing = get('SELECT id FROM medical_records WHERE record_no = ?', [record.recordNo]);
    if (existing) {
      console.log(`记录 ${idx + 1} 已存在，跳过`);
      return;
    }

    run(
      'INSERT INTO medical_records (id, record_no, customer_id, package_id, check_date, report_status) VALUES (?, ?, ?, ?, ?, ?)',
      [record.id, record.recordNo, record.customer.id, packageId, record.checkDate, record.reportStatus]
    );

    items.forEach((item, itemIdx) => {
      const status = record.itemStatuses[itemIdx];
      const needRecheck = record.needRecheck && itemIdx === record.recheckItemIndex ? 1 : 0;
      const recheckStatus = needRecheck ? 'pending' : 'none';
      const result = status === 'completed' ? (needRecheck ? '异常' : '正常') : null;
      const abnormalFlag = needRecheck ? 1 : 0;
      const abnormalDesc = needRecheck ? '指标异常，建议复检' : null;
      const completedAt = status === 'completed' ? '2024-01-02 10:00:00' : null;

      run(
        `INSERT INTO record_items (id, record_id, item_id, status, result, abnormal_flag, abnormal_desc, need_recheck, recheck_status, completed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [uuidv4(), record.id, item.id, status, result, abnormalFlag, abnormalDesc, needRecheck, recheckStatus, completedAt]
      );
    });

    if (record.hasReceived) {
      const receiveId = uuidv4();
      run(
        'INSERT INTO receive_records (id, record_id, receiver_name, receiver_id_card_hash, relation, operator) VALUES (?, ?, ?, ?, ?, ?)',
        [receiveId, record.id, record.customer.name, hashIdCard(record.customer.idCard), '本人', '张护士']
      );
      run(
        'INSERT INTO audit_logs (id, record_id, action, details, operator) VALUES (?, ?, ?, ?, ?)',
        [uuidv4(), record.id, '首次领取', `报告首次领取，领取人：${record.customer.name}`, '张护士']
      );
    }

    if (record.hasDuplicateRequest) {
      const requestId = uuidv4();
      run(
        'INSERT INTO print_requests (id, record_id, request_type, reason, operator, status) VALUES (?, ?, ?, ?, ?, ?)',
        [requestId, record.id, 'reprint', '报告丢失需要补打', '李护士', 'completed']
      );
      const receiveId = uuidv4();
      run(
        'INSERT INTO receive_records (id, record_id, request_id, receiver_name, receiver_id_card_hash, relation, operator) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [receiveId, record.id, requestId, record.customer.name, hashIdCard(record.customer.idCard), '本人', '李护士']
      );
      run(
        'INSERT INTO audit_logs (id, record_id, action, details, operator) VALUES (?, ?, ?, ?, ?)',
        [uuidv4(), record.id, '重复补打', `补打原因：报告丢失需要补打`, '李护士']
      );
    }

    console.log(`记录 ${idx + 1} 插入完成`);
  });

  console.log('所有种子数据插入完成！');
  console.log('');
  console.log('测试场景说明：');
  console.log('1. 正常补打：张三（身份证110101199001011234）- 所有项目完成，可正常补打');
  console.log('2. 未完成项目：李四（身份证110101199002022345）- 血常规未完成，不能补打');
  console.log('3. 复检未完成：王五（身份证110101199003033456）- 血常规异常需复检，提示未处理');
  console.log('4. 重复补打：赵六（身份证110101199004044567）- 已领取过，补打需要原因');
};

module.exports = seedData;
