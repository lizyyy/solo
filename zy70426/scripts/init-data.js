const { v4: uuidv4 } = require('uuid');
const db = require('../db');

const normalRecords = [
  {
    batch_no: 'BATCH-2024-001',
    source_system: 'ERP系统A',
    finance_type: '药品采购结转',
    amount: 156800.50,
    transfer_date: '2024-01-15',
    handler: '张三',
    handler_department: '财务部一组'
  },
  {
    batch_no: 'BATCH-2024-001',
    source_system: 'ERP系统B',
    finance_type: '医疗器械结转',
    amount: 89200.00,
    transfer_date: '2024-01-15',
    handler: '李四',
    handler_department: '财务部一组'
  },
  {
    batch_no: 'BATCH-2024-002',
    source_system: '财务系统C',
    finance_type: '门诊收入结转',
    amount: 325600.75,
    transfer_date: '2024-01-16',
    handler: '王五',
    handler_department: '财务部二组'
  },
  {
    batch_no: 'BATCH-2024-002',
    source_system: 'ERP系统A',
    finance_type: '住院收入结转',
    amount: 589300.25,
    transfer_date: '2024-01-16',
    handler: '赵六',
    handler_department: '财务部二组'
  },
  {
    batch_no: 'BATCH-2024-003',
    source_system: '供应链系统D',
    finance_type: '耗材采购结转',
    amount: 67800.00,
    transfer_date: '2024-01-17',
    handler: '钱七',
    handler_department: '财务部一组'
  }
];

const errorRecords = [
  {
    batch_no: 'BATCH-2024-004',
    source_system: 'ERP系统A',
    finance_type: '药品采购结转',
    amount: 234500.00,
    transfer_date: '2024-01-18',
    handler: null,
    handler_department: null
  },
  {
    batch_no: 'BATCH-2024-004',
    source_system: 'ERP系统B',
    finance_type: '医疗器械结转',
    amount: 156700.50,
    transfer_date: '2024-01-18',
    handler: '孙八',
    handler_department: '财务部三组'
  },
  {
    batch_no: 'BATCH-2024-005',
    source_system: '财务系统C',
    finance_type: '门诊收入结转',
    amount: 412800.00,
    transfer_date: '2024-01-19',
    handler: null,
    handler_department: null
  }
];

function insertRecord(record) {
  return new Promise((resolve, reject) => {
    const id = uuidv4();
    const now = new Date().toISOString();
    
    let status = 'success';
    let error_type = null;
    let error_message = null;

    if (!record.handler) {
      status = 'error';
      error_type = 'handler_missing';
      error_message = '负责人信息缺失';
    }

    db.run(
      'INSERT INTO transfer_records (id, batch_no, source_system, finance_type, amount, transfer_date, handler, handler_department, status, error_type, error_message, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, record.batch_no, record.source_system, record.finance_type, record.amount, record.transfer_date, record.handler, record.handler_department, status, error_type, error_message, now, now],
      function(err) {
        if (err) reject(err);
        else resolve({ id, ...record, status, error_type, error_message });
      }
    );
  });
}

async function initData() {
  console.log('开始初始化样例数据...');
  
  try {
    console.log('插入正常结转记录...');
    for (const record of normalRecords) {
      const result = await insertRecord(record);
      console.log(`  插入: ${record.batch_no} - ${record.finance_type} [${result.status}]`);
    }

    console.log('插入异常结转记录（负责人缺失）...');
    for (const record of errorRecords) {
      const result = await insertRecord(record);
      console.log(`  插入: ${record.batch_no} - ${record.finance_type} [${result.status}]`);
    }

    console.log('样例数据初始化完成！');
    console.log(`总计: ${normalRecords.length + errorRecords.length} 条记录`);
    console.log(`  正常记录: ${normalRecords.length} 条`);
    console.log(`  异常记录: ${errorRecords.length} 条`);
    
  } catch (err) {
    console.error('初始化失败:', err.message);
  }
  
  process.exit(0);
}

initData();
