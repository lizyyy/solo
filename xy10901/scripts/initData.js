const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'database.db');
const db = new sqlite3.Database(dbPath);

function createTables(callback) {
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS sample_barcodes (
      id TEXT PRIMARY KEY,
      barcode TEXT UNIQUE NOT NULL,
      sample_type TEXT NOT NULL,
      patient_info TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_by TEXT,
      status TEXT DEFAULT 'active'
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS sampling_records (
      id TEXT PRIMARY KEY,
      barcode_id TEXT NOT NULL,
      barcode TEXT NOT NULL,
      sampling_time DATETIME NOT NULL,
      sampler TEXT NOT NULL,
      clinic_name TEXT NOT NULL,
      patient_name TEXT,
      patient_id TEXT,
      sample_type TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (barcode_id) REFERENCES sample_barcodes(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS transport_batches (
      id TEXT PRIMARY KEY,
      batch_code TEXT UNIQUE NOT NULL,
      transporter TEXT NOT NULL,
      departure_time DATETIME NOT NULL,
      expected_arrival_time DATETIME,
      actual_arrival_time DATETIME,
      origin_clinic TEXT NOT NULL,
      destination_lab TEXT NOT NULL,
      sample_count INTEGER DEFAULT 0,
      status TEXT DEFAULT 'in_transit',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS batch_samples (
      id TEXT PRIMARY KEY,
      batch_id TEXT NOT NULL,
      sampling_record_id TEXT NOT NULL,
      barcode TEXT NOT NULL,
      added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (batch_id) REFERENCES transport_batches(id),
      FOREIGN KEY (sampling_record_id) REFERENCES sampling_records(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS receiving_windows (
      id TEXT PRIMARY KEY,
      lab_name TEXT NOT NULL,
      start_time TIME NOT NULL,
      end_time TIME NOT NULL,
      days_of_week TEXT NOT NULL,
      is_active BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS rejection_reasons (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      category TEXT NOT NULL,
      is_active BOOLEAN DEFAULT 1
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS transfer_records (
      id TEXT PRIMARY KEY,
      sampling_record_id TEXT NOT NULL,
      batch_id TEXT,
      barcode TEXT NOT NULL,
      received_time DATETIME,
      receiver TEXT,
      receiving_lab TEXT,
      status TEXT DEFAULT 'pending',
      rejection_reason_id TEXT,
      rejection_note TEXT,
      is_amended BOOLEAN DEFAULT 0,
      amendment_request_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sampling_record_id) REFERENCES sampling_records(id),
      FOREIGN KEY (batch_id) REFERENCES transport_batches(id),
      FOREIGN KEY (rejection_reason_id) REFERENCES rejection_reasons(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS amendment_requests (
      id TEXT PRIMARY KEY,
      transfer_record_id TEXT NOT NULL,
      requester TEXT NOT NULL,
      requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      original_data TEXT NOT NULL,
      requested_changes TEXT NOT NULL,
      reason TEXT NOT NULL,
      approver TEXT,
      approved_at DATETIME,
      status TEXT DEFAULT 'pending',
      approval_notes TEXT,
      FOREIGN KEY (transfer_record_id) REFERENCES transfer_records(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS exception_logs (
      id TEXT PRIMARY KEY,
      api_endpoint TEXT NOT NULL,
      original_input TEXT NOT NULL,
      error_message TEXT NOT NULL,
      processing_result TEXT NOT NULL,
      occurred_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      resolved BOOLEAN DEFAULT 0,
      resolved_by TEXT,
      resolved_at DATETIME
    )`, callback);
  });
}

const rejectionReasons = [
  { id: uuidv4(), code: 'BROKEN', name: '标本破损', description: '样本容器破损导致泄漏', category: 'sample_condition' },
  { id: uuidv4(), code: 'EXPIRED', name: '标本超时', description: '采样到接收时间超出规定时限', category: 'timing' },
  { id: uuidv4(), code: 'NO_INFO', name: '信息缺失', description: '患者信息或采样信息不完整', category: 'information' },
  { id: uuidv4(), code: 'WRONG_TYPE', name: '类型错误', description: '样本类型与申请项目不匹配', category: 'sample_type' },
  { id: uuidv4(), code: 'CONTAMINATED', name: '标本污染', description: '样本存在污染迹象', category: 'sample_condition' }
];

const receivingWindows = [
  { id: uuidv4(), lab_name: '中心检验室', start_time: '08:00', end_time: '17:00', days_of_week: '1,2,3,4,5' },
  { id: uuidv4(), lab_name: '中心检验室', start_time: '09:00', end_time: '12:00', days_of_week: '0,6' }
];

const sampleBarcodes = [
  { id: uuidv4(), barcode: 'CLINIC-A-001', sample_type: '血液', patient_info: '张三,男,35岁', created_by: '李护士' },
  { id: uuidv4(), barcode: 'CLINIC-A-002', sample_type: '尿液', patient_info: '李四,女,28岁', created_by: '李护士' },
  { id: uuidv4(), barcode: 'CLINIC-A-003', sample_type: '血液', patient_info: '王五,男,42岁', created_by: '张护士' },
  { id: uuidv4(), barcode: 'CLINIC-B-001', sample_type: '咽拭子', patient_info: '赵六,女,50岁', created_by: '王护士' },
  { id: uuidv4(), barcode: 'CLINIC-B-002', sample_type: '血液', patient_info: '钱七,男,30岁', created_by: '王护士' }
];

const samplingRecords = sampleBarcodes.map((barcode, index) => ({
  id: uuidv4(),
  barcode_id: barcode.id,
  barcode: barcode.barcode,
  sampling_time: new Date(Date.now() - (index + 1) * 3600000).toISOString(),
  sampler: ['李护士', '李护士', '张护士', '王护士', '王护士'][index],
  clinic_name: index < 3 ? '城东社区诊所' : '城西社区诊所',
  patient_name: ['张三', '李四', '王五', '赵六', '钱七'][index],
  patient_id: ['P001', 'P002', 'P003', 'P004', 'P005'][index],
  sample_type: barcode.sample_type
}));

const transportBatch = {
  id: uuidv4(),
  batch_code: 'BATCH-2024-001',
  transporter: '陈司机',
  departure_time: new Date(Date.now() - 1800000).toISOString(),
  origin_clinic: '城东社区诊所',
  destination_lab: '中心检验室',
  sample_count: 3,
  status: 'in_transit'
};

const batchSamples = samplingRecords.slice(0, 3).map((record) => ({
  id: uuidv4(),
  batch_id: transportBatch.id,
  sampling_record_id: record.id,
  barcode: record.barcode
}));

console.log('📦 创建数据库表结构...');
createTables(() => {
  console.log('✅ 表结构创建完成');
  console.log('📝 插入初始化数据...');
  
  db.serialize(() => {
    const stmt1 = db.prepare('INSERT OR IGNORE INTO rejection_reasons (id, code, name, description, category, is_active) VALUES (?, ?, ?, ?, ?, 1)');
    rejectionReasons.forEach(r => stmt1.run(r.id, r.code, r.name, r.description, r.category));
    stmt1.finalize();

    const stmt2 = db.prepare('INSERT OR IGNORE INTO receiving_windows (id, lab_name, start_time, end_time, days_of_week, is_active) VALUES (?, ?, ?, ?, ?, 1)');
    receivingWindows.forEach(w => stmt2.run(w.id, w.lab_name, w.start_time, w.end_time, w.days_of_week));
    stmt2.finalize();

    const stmt3 = db.prepare('INSERT OR IGNORE INTO sample_barcodes (id, barcode, sample_type, patient_info, created_by, status) VALUES (?, ?, ?, ?, ?, "active")');
    sampleBarcodes.forEach(b => stmt3.run(b.id, b.barcode, b.sample_type, b.patient_info, b.created_by));
    stmt3.finalize();

    const stmt4 = db.prepare('INSERT OR IGNORE INTO sampling_records (id, barcode_id, barcode, sampling_time, sampler, clinic_name, patient_name, patient_id, sample_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
    samplingRecords.forEach(s => stmt4.run(s.id, s.barcode_id, s.barcode, s.sampling_time, s.sampler, s.clinic_name, s.patient_name, s.patient_id, s.sample_type));
    stmt4.finalize();

    db.run(
      'INSERT OR IGNORE INTO transport_batches (id, batch_code, transporter, departure_time, origin_clinic, destination_lab, sample_count, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [transportBatch.id, transportBatch.batch_code, transportBatch.transporter, transportBatch.departure_time, transportBatch.origin_clinic, transportBatch.destination_lab, transportBatch.sample_count, transportBatch.status]
    );

    const stmt5 = db.prepare('INSERT OR IGNORE INTO batch_samples (id, batch_id, sampling_record_id, barcode) VALUES (?, ?, ?, ?)');
    batchSamples.forEach(bs => stmt5.run(bs.id, bs.batch_id, bs.sampling_record_id, bs.barcode));
    stmt5.finalize();

    console.log('');
    console.log('✅ 初始化数据完成！');
    console.log('');
    console.log('📊 初始化数据概览:');
    console.log('  - 拒收原因: 5条');
    console.log('  - 接收窗口: 2条');
    console.log('  - 样本条码: 5条');
    console.log('  - 采样记录: 5条');
    console.log('  - 运输批次: 1条');
    console.log('  - 批次样本: 3条');
    console.log('');
    console.log('🚀 现在可以启动服务: npm start');
    
    db.close();
  });
});
