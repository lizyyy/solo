const db = require('../src/database');
const moment = require('moment');

const operators = [
  { name: '张三', role: 'admin' },
  { name: '李四', role: 'staff' },
  { name: '王五', role: 'staff' },
  { name: '赵六', role: 'staff' }
];

const labItems = [
  { name: '血常规', code: 'CBC001', fasting: false, window: '上午8:00-11:00' },
  { name: '肝功能', code: 'LFT001', fasting: true, hours: 8, window: '上午8:00-10:00' },
  { name: '肾功能', code: 'RFT001', fasting: true, hours: 8, window: '上午8:00-10:00' },
  { name: '血糖', code: 'GLU001', fasting: true, hours: 12, window: '上午8:00-9:00' },
  { name: '血脂', code: 'LIP001', fasting: true, hours: 12, window: '上午8:00-10:00' },
  { name: '电解质', code: 'ELC001', fasting: false, window: '上午8:00-11:00' },
  { name: '甲状腺功能', code: 'THY001', fasting: false, window: '上午8:00-11:00' },
  { name: '肿瘤标志物', code: 'TUM001', fasting: false, window: '上午8:00-11:00' }
];

const patients = [
  { id: 'P001', name: '王小明', phone: '138****1234' },
  { id: 'P002', name: '李小红', phone: '139****5678' },
  { id: 'P003', name: '张伟', phone: '137****9012' },
  { id: 'P004', name: '刘芳', phone: '136****3456' },
  { id: 'P005', name: '陈强', phone: '135****7890' },
  { id: 'P006', name: '杨丽', phone: '134****2345' },
  { id: 'P007', name: '赵刚', phone: '133****6789' },
  { id: 'P008', name: '周敏', phone: '132****0123' },
  { id: 'P009', name: '吴杰', phone: '131****4567' },
  { id: 'P010', name: '郑华', phone: '130****8901' }
];

const statuses = ['pending', 'confirmed', 'completed', 'cancelled', 'no_show'];
const reportStatuses = ['pending', 'processing', 'completed', 'abnormal'];

function randomDate(start, end) {
  return moment(start).add(Math.random() * moment(end).diff(start), 'ms').format('YYYY-MM-DD');
}

function randomTime() {
  const hours = 8 + Math.floor(Math.random() * 4);
  const minutes = Math.floor(Math.random() * 4) * 15;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

db.serialize(() => {
  const stmt = db.prepare('INSERT OR IGNORE INTO operators (name, role) VALUES (?, ?)');
  operators.forEach(op => stmt.run(op.name, op.role));
  stmt.finalize();

  const apptStmt = db.prepare(`
    INSERT INTO appointments 
    (patient_id, patient_name, phone, lab_item, lab_item_code, sampling_window, 
     fasting_required, fasting_hours, appointment_date, appointment_time, 
     status, report_status, reminder_sent, reminder_count)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const rescheduleStmt = db.prepare(`
    INSERT INTO reschedule_logs
    (appointment_id, old_appointment_date, new_appointment_date, old_appointment_time, 
     new_appointment_time, old_sampling_window, new_sampling_window, old_lab_item, 
     new_lab_item, old_fasting_required, new_fasting_required, reason, operator, is_abnormal, abnormal_note)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const adjustStmt = db.prepare(`
    INSERT INTO adjustment_logs
    (appointment_id, field_name, old_value, new_value, reason, operator)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const today = moment();
  const startDate = moment().subtract(30, 'days');

  const appointmentIds = [];

  for (let i = 0; i < 50; i++) {
    const patient = patients[Math.floor(Math.random() * patients.length)];
    const labItem = labItems[Math.floor(Math.random() * labItems.length)];
    const date = randomDate(startDate, moment(today).add(7, 'days'));
    const time = randomTime();
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    const reportStatus = reportStatuses[Math.floor(Math.random() * reportStatuses.length)];
    const reminderSent = Math.random() > 0.3 ? 1 : 0;
    const reminderCount = reminderSent ? Math.floor(Math.random() * 3) + 1 : 0;

    apptStmt.run(
      patient.id, patient.name, patient.phone,
      labItem.name, labItem.code, labItem.window,
      labItem.fasting ? 1 : 0, labItem.hours || 0,
      date, time, status, reportStatus,
      reminderSent, reminderCount,
      function(err) {
        if (!err) {
          appointmentIds.push(this.lastID);
        }
      }
    );
  }

  apptStmt.finalize(() => {
    for (let i = 0; i < 15; i++) {
      const apptId = appointmentIds[Math.floor(Math.random() * appointmentIds.length)];
      const isAbnormal = Math.random() > 0.7 ? 1 : 0;
      
      const oldDate = randomDate(startDate, moment(today).add(3, 'days'));
      const newDate = randomDate(moment(oldDate).add(1, 'days'), moment(today).add(7, 'days'));
      const oldTime = randomTime();
      const newTime = randomTime();
      
      const reasons = ['患者要求', '医生调整', '设备维护', '窗口调整'];
      const reason = reasons[Math.floor(Math.random() * reasons.length)];
      const operator = operators[Math.floor(Math.random() * operators.length)].name;
      
      const abnormalNote = isAbnormal ? '改约次数超过3次，需关注' : null;

      rescheduleStmt.run(
        apptId, oldDate, newDate, oldTime, newTime,
        '上午8:00-10:00', '上午8:00-11:00',
        '肝功能', '肝功能+血糖',
        1, 1, reason, operator, isAbnormal, abnormalNote
      );
    }
    rescheduleStmt.finalize();

    for (let i = 0; i < 10; i++) {
      const apptId = appointmentIds[Math.floor(Math.random() * appointmentIds.length)];
      const fields = ['sampling_window', 'fasting_required', 'lab_item', 'appointment_time'];
      const field = fields[Math.floor(Math.random() * fields.length)];
      const operator = operators[Math.floor(Math.random() * operators.length)].name;
      
      let oldValue, newValue;
      switch(field) {
        case 'sampling_window':
          oldValue = '上午8:00-10:00';
          newValue = '上午8:00-11:00';
          break;
        case 'fasting_required':
          oldValue = '是';
          newValue = '否';
          break;
        case 'lab_item':
          oldValue = '肝功能';
          newValue = '肝功能+肾功能';
          break;
        case 'appointment_time':
          oldValue = '08:30';
          newValue = '09:00';
          break;
      }

      adjustStmt.run(apptId, field, oldValue, newValue, '人工调整', operator);
    }
    adjustStmt.finalize();

    console.log('演示数据生成完成');
    db.close();
  });
});
