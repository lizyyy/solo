const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const dbPath = path.join(__dirname, '../data/prototype_tracking.db');
const db = new sqlite3.Database(dbPath);

const parts = [
  { id: uuidv4(), part_number: 'ENG-001', prototype_version: 'V1.0', part_name: '发动机总成', status: 'completed' },
  { id: uuidv4(), part_number: 'ENG-001', prototype_version: 'V1.1', part_name: '发动机总成', status: 'inspecting' },
  { id: uuidv4(), part_number: 'TRANS-002', prototype_version: 'V2.0', part_name: '变速器', status: 'installed' },
  { id: uuidv4(), part_number: 'CHASS-003', prototype_version: 'V1.5', part_name: '底盘支架', status: 'rework' },
  { id: uuidv4(), part_number: 'BRAKE-004', prototype_version: 'V1.0', part_name: '刹车系统', status: 'unqualified' },
  { id: uuidv4(), part_number: 'ELEC-005', prototype_version: 'V3.0', part_name: '电控单元', status: 'rechecking' },
  { id: uuidv4(), part_number: 'SUSP-006', prototype_version: 'V1.2', part_name: '悬挂系统', status: 'scrapped' },
  { id: uuidv4(), part_number: 'STEER-007', prototype_version: 'V1.0', part_name: '转向系统', status: 'qualified' },
  { id: uuidv4(), part_number: 'EXHAU-008', prototype_version: 'V2.1', part_name: '排气系统', status: 'pending' },
  { id: uuidv4(), part_number: 'COOLI-009', prototype_version: 'V1.3', part_name: '冷却系统', status: 'installation_failed' }
];

const statusHistory = [];
const modificationHistory = [];
const inspectionReports = [];
const installationRecords = [];
const reworkProcesses = [];
const scrapRecords = [];

parts.forEach(part => {
  statusHistory.push({
    id: uuidv4(),
    part_id: part.id,
    old_status: null,
    new_status: 'pending',
    changed_by: 'system',
    change_reason: '零件创建',
    changed_at: '2024-01-15 09:00:00'
  });

  const statusFlow = getStatusFlow(part.status);
  statusFlow.forEach((status, index) => {
    if (index > 0) {
      statusHistory.push({
        id: uuidv4(),
        part_id: part.id,
        old_status: statusFlow[index - 1],
        new_status: status,
        changed_by: ['张三', '李四', '王五'][index % 3],
        change_reason: getChangeReason(status),
        changed_at: `2024-01-${15 + index} ${10 + index}:00:00`
      });
    }
  });

  if (['inspecting', 'qualified', 'unqualified', 'rechecking', 'completed'].includes(part.status)) {
    inspectionReports.push({
      id: uuidv4(),
      part_id: part.id,
      report_number: `RPT-${part.part_number}-${part.prototype_version}`,
      inspector: ['张工', '李工', '王工'][Math.floor(Math.random() * 3)],
      inspection_date: '2024-01-18',
      result: part.status === 'unqualified' ? '不合格' : '合格',
      remarks: part.status === 'unqualified' ? '尺寸偏差超出允许范围' : '各项指标符合要求'
    });
  }

  if (['installing', 'installed', 'installation_failed', 'completed'].includes(part.status)) {
    installationRecords.push({
      id: uuidv4(),
      part_id: part.id,
      vehicle_number: `VEH-${1000 + Math.floor(Math.random() * 100)}`,
      installation_date: '2024-01-20',
      installer: ['赵六', '钱七', '孙八'][Math.floor(Math.random() * 3)],
      location: '前舱左侧',
      remarks: part.status === 'installation_failed' ? '接口不匹配，需返工' : '安装顺利'
    });
  }

  if (['rework', 'rework_completed'].includes(part.status)) {
    reworkProcesses.push({
      id: uuidv4(),
      part_id: part.id,
      process_name: '尺寸修正',
      operator: '周师傅',
      start_time: '2024-01-21 08:00:00',
      end_time: part.status === 'rework_completed' ? '2024-01-21 16:00:00' : null,
      result: part.status === 'rework_completed' ? '完成' : '进行中',
      remarks: '对关键尺寸进行精修处理'
    });
    reworkProcesses.push({
      id: uuidv4(),
      part_id: part.id,
      process_name: '表面处理',
      operator: '吴师傅',
      start_time: '2024-01-22 09:00:00',
      end_time: null,
      result: '待开始',
      remarks: '防腐涂层处理'
    });
  }

  if (part.status === 'scrapped') {
    scrapRecords.push({
      id: uuidv4(),
      part_id: part.id,
      scrap_date: '2024-01-25',
      reason: '材料疲劳试验不通过，存在安全隐患',
      responsible_person: '郑九',
      disposal_location: '报废品仓库A区-03',
      remarks: '等待统一销毁处理'
    });
  }

  if (part.part_number === 'ENG-001' && part.prototype_version === 'V1.1') {
    modificationHistory.push({
      id: uuidv4(),
      part_id: part.id,
      field_name: 'prototype_version',
      old_value: 'V1.0',
      new_value: 'V1.1',
      modified_by: '张三',
      modified_at: '2024-01-16 14:30:00'
    });
    modificationHistory.push({
      id: uuidv4(),
      part_id: part.id,
      field_name: 'part_name',
      old_value: '发动机',
      new_value: '发动机总成',
      modified_by: '李四',
      modified_at: '2024-01-16 15:00:00'
    });
  }
});

function getStatusFlow(finalStatus) {
  const flows = {
    completed: ['pending', 'inspecting', 'qualified', 'installing', 'installed', 'completed'],
    inspecting: ['pending', 'inspecting'],
    installed: ['pending', 'inspecting', 'qualified', 'installing', 'installed'],
    rework: ['pending', 'inspecting', 'unqualified', 'rework'],
    unqualified: ['pending', 'inspecting', 'unqualified'],
    rechecking: ['pending', 'inspecting', 'rechecking'],
    scrapped: ['pending', 'inspecting', 'unqualified', 'rework', 'scrapped'],
    qualified: ['pending', 'inspecting', 'qualified'],
    pending: ['pending'],
    installation_failed: ['pending', 'inspecting', 'qualified', 'installing', 'installation_failed']
  };
  return flows[finalStatus] || ['pending'];
}

function getChangeReason(status) {
  const reasons = {
    inspecting: '零件进入检测流程',
    qualified: '检测合格，通过质量检验',
    unqualified: '检测发现不合格项',
    rechecking: '进入复核流程，二次检验',
    installing: '开始装车安装',
    installed: '装车完成',
    installation_failed: '装车失败，存在问题',
    rework: '进入返工工序',
    rework_completed: '返工完成，等待复检',
    completed: '全部流程完成',
    scrapped: '零件报废处理'
  };
  return reasons[status] || '状态变更';
}

db.serialize(() => {
  const stmtPart = db.prepare('INSERT INTO parts (id, part_number, prototype_version, part_name, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
  const stmtHistory = db.prepare('INSERT INTO status_history (id, part_id, old_status, new_status, changed_by, change_reason, changed_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
  const stmtModification = db.prepare('INSERT INTO modification_history (id, part_id, field_name, old_value, new_value, modified_by, modified_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
  const stmtInspection = db.prepare('INSERT INTO inspection_reports (id, part_id, report_number, inspector, inspection_date, result, remarks) VALUES (?, ?, ?, ?, ?, ?, ?)');
  const stmtInstallation = db.prepare('INSERT INTO installation_records (id, part_id, vehicle_number, installation_date, installer, location, remarks) VALUES (?, ?, ?, ?, ?, ?, ?)');
  const stmtRework = db.prepare('INSERT INTO rework_processes (id, part_id, process_name, operator, start_time, end_time, result, remarks) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  const stmtScrap = db.prepare('INSERT INTO scrap_records (id, part_id, scrap_date, reason, responsible_person, disposal_location, remarks) VALUES (?, ?, ?, ?, ?, ?, ?)');

  console.log('开始插入样例数据...');

  parts.forEach(part => {
    stmtPart.run(part.id, part.part_number, part.prototype_version, part.part_name, part.status, '2024-01-15 09:00:00', '2024-01-25 18:00:00');
  });

  statusHistory.forEach(h => {
    stmtHistory.run(h.id, h.part_id, h.old_status, h.new_status, h.changed_by, h.change_reason, h.changed_at);
  });

  modificationHistory.forEach(m => {
    stmtModification.run(m.id, m.part_id, m.field_name, m.old_value, m.new_value, m.modified_by, m.modified_at);
  });

  inspectionReports.forEach(r => {
    stmtInspection.run(r.id, r.part_id, r.report_number, r.inspector, r.inspection_date, r.result, r.remarks);
  });

  installationRecords.forEach(r => {
    stmtInstallation.run(r.id, r.part_id, r.vehicle_number, r.installation_date, r.installer, r.location, r.remarks);
  });

  reworkProcesses.forEach(p => {
    stmtRework.run(p.id, p.part_id, p.process_name, p.operator, p.start_time, p.end_time, p.result, p.remarks);
  });

  scrapRecords.forEach(r => {
    stmtScrap.run(r.id, r.part_id, r.scrap_date, r.reason, r.responsible_person, r.disposal_location, r.remarks);
  });

  stmtPart.finalize();
  stmtHistory.finalize();
  stmtModification.finalize();
  stmtInspection.finalize();
  stmtInstallation.finalize();
  stmtRework.finalize();
  stmtScrap.finalize();

  console.log('样例数据插入完成！');
  console.log(`共插入 ${parts.length} 个零件记录`);
  console.log(`共插入 ${statusHistory.length} 条状态历史`);
  console.log(`共插入 ${modificationHistory.length} 条修改历史`);
  console.log(`共插入 ${inspectionReports.length} 条检测报告`);
  console.log(`共插入 ${installationRecords.length} 条装车记录`);
  console.log(`共插入 ${reworkProcesses.length} 条返工工序`);
  console.log(`共插入 ${scrapRecords.length} 条报废记录`);
});

db.close();
