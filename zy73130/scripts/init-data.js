const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const RECORDS_FILE = path.join(DATA_DIR, 'records.json');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

const batch1 = [
  {
    record_id: 'TIDAL-001',
    station_name: '舟山衢山潮汐能站',
    latitude: 30.532,
    longitude: 122.218,
    water_level: 8.5,
    power_output: 1250,
    temperature: 16.8,
    salinity: 28.5,
    flow_velocity: 2.3,
    sample_date: '2026-06-15',
    batch_no: 'BATCH-2026-06-15-A',
    source_file: '实验室结果表_第一批.xlsx',
    manual_note: '数据完整，初步判定稳定'
  },
  {
    record_id: 'TIDAL-002',
    station_name: '温岭江厦潮汐能站',
    latitude: 28.485,
    longitude: 121.256,
    water_level: null,
    power_output: null,
    temperature: 17.2,
    salinity: 29.1,
    flow_velocity: 1.8,
    sample_date: '2026-06-15',
    batch_no: 'BATCH-2026-06-15-A',
    source_file: '实验室结果表_第一批.xlsx',
    manual_note: ''
  },
  {
    record_id: 'TIDAL-003',
    station_name: '厦门湾潮汐能站',
    latitude: 118.082,
    longitude: 24.479,
    water_level: 7.2,
    power_output: 980,
    temperature: 21.5,
    salinity: 30.2,
    flow_velocity: 2.0,
    sample_date: '2026-06-15',
    batch_no: 'BATCH-2026-06-15-A',
    source_file: '实验室结果表_第一批.xlsx',
    manual_note: ''
  },
  {
    record_id: 'TIDAL-004',
    station_name: '青岛黄岛潮汐能站',
    latitude: 35.982,
    longitude: 120.158,
    water_level: 6.8,
    power_output: null,
    temperature: 14.3,
    salinity: 31.0,
    flow_velocity: 1.5,
    sample_date: '2026-06-15',
    batch_no: 'BATCH-2026-06-15-A',
    source_file: '实验室结果表_第一批.xlsx',
    manual_note: '发电功率数据缺失，等第二批结果'
  }
];

const batch2 = [
  {
    record_id: 'TIDAL-001',
    station_name: '舟山衢山潮汐能站',
    latitude: 30.532,
    longitude: 122.218,
    water_level: 8.5,
    power_output: 1250,
    temperature: 16.8,
    salinity: 28.5,
    flow_velocity: 2.3,
    sample_date: '2026-06-15',
    batch_no: 'BATCH-2026-06-15-B',
    source_file: '实验室结果表_第二批.xlsx',
    manual_note: '新导入的备注，应该不会覆盖原有备注'
  },
  {
    record_id: 'TIDAL-002',
    station_name: '温岭江厦潮汐能站',
    latitude: 28.485,
    longitude: 121.256,
    water_level: 9.1,
    power_output: 1580,
    temperature: 17.2,
    salinity: 29.1,
    flow_velocity: 1.8,
    sample_date: '2026-06-15',
    batch_no: 'BATCH-2026-06-15-B',
    source_file: '实验室结果表_第二批.xlsx',
    manual_note: ''
  },
  {
    record_id: 'TIDAL-004',
    station_name: '青岛黄岛潮汐能站',
    latitude: 35.982,
    longitude: 120.158,
    water_level: 6.8,
    power_output: 860,
    temperature: 14.3,
    salinity: 31.0,
    flow_velocity: 1.5,
    sample_date: '2026-06-15',
    batch_no: 'BATCH-2026-06-15-B',
    source_file: '实验室结果表_第二批.xlsx',
    manual_note: ''
  }
];

ensureDataDir();

const initialRecords = [];
const initialHistory = [];

function validateCoordinate(lat, lng) {
  const issues = [];
  const latNum = parseFloat(lat);
  const lngNum = parseFloat(lng);

  if (isNaN(latNum) || isNaN(lngNum)) {
    issues.push('经纬度格式错误');
    return { valid: false, issues, reversed: false };
  }

  if (Math.abs(latNum) > 90) {
    issues.push('纬度超出正常范围（-90 ~ 90）');
  }
  if (Math.abs(lngNum) > 180) {
    issues.push('经度超出正常范围（-180 ~ 180）');
  }

  const latInLngRange = Math.abs(latNum) > 90 && Math.abs(latNum) <= 180;
  const lngInLatRange = Math.abs(lngNum) <= 90;
  const reversed = latInLngRange && lngInLatRange && Math.abs(latNum) > Math.abs(lngNum);

  if (reversed) {
    issues.push('经纬度疑似反写（纬度值异常偏大，经度值异常偏小）');
  }

  return {
    valid: issues.length === 0,
    issues,
    reversed
  };
}

function determineStatus(record) {
  const coordCheck = validateCoordinate(record.latitude, record.longitude);
  if (!coordCheck.valid) {
    return 'suspended';
  }

  const requiredFields = ['water_level', 'power_output', 'sample_date'];
  const missingFields = requiredFields.filter(f => !record[f] && record[f] !== 0);

  if (missingFields.length > 0) {
    return 'pending_evidence';
  }

  return 'processed';
}

console.log('\n═══════════════════════════════════════════════════════');
console.log('  潮汐能站数据清洗工具 - 示例数据初始化');
console.log('═══════════════════════════════════════════════════════\n');

console.log('【第一批导入】实验室结果表_第一批.xlsx (BATCH-2026-06-15-A)');
console.log('─────────────────────────────────────────────────────────');

batch1.forEach((incoming, idx) => {
  const coordCheck = validateCoordinate(incoming.latitude, incoming.longitude);
  const status = determineStatus(incoming);

  const record = {
    id: `REC_${Date.now()}_${idx}`,
    record_id: incoming.record_id,
    station_name: incoming.station_name,
    latitude: incoming.latitude,
    longitude: incoming.longitude,
    water_level: incoming.water_level,
    power_output: incoming.power_output,
    temperature: incoming.temperature,
    salinity: incoming.salinity,
    flow_velocity: incoming.flow_velocity,
    sample_date: incoming.sample_date,
    batch_no: incoming.batch_no,
    source_file: incoming.source_file,
    manual_note: incoming.manual_note,
    status,
    coordIssues: coordCheck.issues,
    coordReversed: coordCheck.reversed,
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 86400000).toISOString(),
    statusChangedAt: new Date(Date.now() - 86400000).toISOString(),
    importCount: 1,
    evidenceHistory: [],
    updateHistory: [],
    suspendReason: coordCheck.issues.length > 0 ? coordCheck.issues.join('；') : null
  };

  initialRecords.push(record);

  initialHistory.push({
    type: 'create',
    record_id: record.record_id,
    batch_no: incoming.batch_no,
    source_file: incoming.source_file,
    status,
    timestamp: new Date(Date.now() - 86400000).toISOString()
  });

  const statusIcon = status === 'processed' ? '✅' : status === 'pending_evidence' ? '⏳' : '⚠️';
  const statusText = status === 'processed' ? '已处理' : status === 'pending_evidence' ? '待补证据' : '异常挂起';
  console.log(`  ${statusIcon} ${record.record_id} ${record.station_name}`);
  console.log(`     状态: ${statusText}`);
  if (status === 'suspended') {
    console.log(`     原因: ${record.suspendReason}`);
  }
  if (status === 'pending_evidence') {
    const missing = [];
    if (!record.water_level && record.water_level !== 0) missing.push('水位');
    if (!record.power_output && record.power_output !== 0) missing.push('发电功率');
    console.log(`     缺失: ${missing.join('、')}`);
  }
  if (record.manual_note) {
    console.log(`     备注: ${record.manual_note}`);
  }
});

console.log('\n【第二批导入】实验室结果表_第二批.xlsx (BATCH-2026-06-15-B)');
console.log('─────────────────────────────────────────────────────────');

batch2.forEach((incoming) => {
  const existingIndex = initialRecords.findIndex(r => r.record_id === incoming.record_id);
  if (existingIndex < 0) return;

  const existing = initialRecords[existingIndex];
  existing.importCount += 1;

  initialHistory.push({
    type: 'update',
    record_id: incoming.record_id,
    batch_no: incoming.batch_no,
    source_file: incoming.source_file,
    timestamp: new Date(Date.now() - 3600000).toISOString()
  });

  const evidenceFields = ['water_level', 'power_output', 'temperature', 'salinity', 'flow_velocity'];
  const evidenceAdded = [];
  const updatedFields = [];

  evidenceFields.forEach(field => {
    if (incoming[field] !== undefined && incoming[field] !== null && incoming[field] !== '') {
      if (existing[field] === undefined || existing[field] === null || existing[field] === '') {
        existing[field] = incoming[field];
        evidenceAdded.push(field);
        updatedFields.push(field);
      }
    }
  });

  if (incoming.sample_date && !existing.sample_date) {
    existing.sample_date = incoming.sample_date;
    evidenceAdded.push('sample_date');
    updatedFields.push('sample_date');
  }

  if (evidenceAdded.length > 0) {
    existing.evidenceHistory.push({
      fields: evidenceAdded,
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      batch: incoming.batch_no
    });
  }

  const newStatus = determineStatus(existing);
  const statusChanged = newStatus !== existing.status;
  if (statusChanged) {
    existing.status = newStatus;
    existing.statusChangedAt = new Date(Date.now() - 3600000).toISOString();
  }

  existing.updatedAt = new Date(Date.now() - 3600000).toISOString();

  if (updatedFields.length > 0) {
    existing.updateHistory.push({
      fields: updatedFields,
      timestamp: new Date(Date.now() - 3600000).toISOString()
    });
  }

  const statusIcon = newStatus === 'processed' ? '✅' : newStatus === 'pending_evidence' ? '⏳' : '⚠️';
  const statusText = newStatus === 'processed' ? '已处理' : newStatus === 'pending_evidence' ? '待补证据' : '异常挂起';
  console.log(`  ${statusIcon} ${incoming.record_id} ${existing.station_name}`);
  console.log(`     导入次数: ${existing.importCount} (重复导入，未翻倍)`);
  if (evidenceAdded.length > 0) {
    console.log(`     补充证据: ${evidenceAdded.join('、')}`);
  } else {
    console.log(`     无新证据补充`);
  }
  if (incoming.manual_note && existing.manual_note) {
    console.log(`     ⚠️  人工备注已存在，新备注被跳过`);
    console.log(`        保留: ${existing.manual_note}`);
    console.log(`        跳过: ${incoming.manual_note}`);
  }
  if (statusChanged) {
    console.log(`     状态变更: → ${statusText}`);
  }
});

fs.writeFileSync(RECORDS_FILE, JSON.stringify(initialRecords, null, 2));
fs.writeFileSync(HISTORY_FILE, JSON.stringify(initialHistory, null, 2));

console.log('\n═══════════════════════════════════════════════════════');
console.log('  初始化完成！数据概览：');
console.log('═══════════════════════════════════════════════════════');
console.log(`  总记录数: ${initialRecords.length} 条`);
console.log(`  ✅ 已处理: ${initialRecords.filter(r => r.status === 'processed').length} 条`);
console.log(`  ⏳ 待补证据: ${initialRecords.filter(r => r.status === 'pending_evidence').length} 条`);
console.log(`  ⚠️  异常挂起: ${initialRecords.filter(r => r.status === 'suspended').length} 条`);
console.log(`  📝 有人工备注: ${initialRecords.filter(r => r.manual_note && r.manual_note.trim()).length} 条`);
console.log(`  📦 导入批次: 2 批`);
console.log('');
console.log('  示例覆盖场景：');
console.log('  1. TIDAL-001 舟山衢山：正常记录 + 人工备注保留');
console.log('  2. TIDAL-002 温岭江厦：首批缺数据→二批补全→状态变更');
console.log('  3. TIDAL-003 厦门湾：经纬度反写→异常挂起待复核');
console.log('  4. TIDAL-004 青岛黄岛：首批缺功率→二批补上→有历史备注');
console.log('');
console.log('  下一步: npm start 启动服务');
console.log('═══════════════════════════════════════════════════════\n');
