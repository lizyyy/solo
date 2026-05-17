import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import { runAsync, getAsync } from '../database';
import { createChecklist, updateStatusToPendingRelease, releaseChecklist, rescheduleChecklist } from '../services/checklist.service';
import { ReleaseReason } from '../types';

const examItems = [
  { code: 'CT001', name: '头颅CT平扫', department: '放射科', price: 350 },
  { code: 'MRI001', name: '腰椎MRI', department: '放射科', price: 680 },
  { code: 'US001', name: '腹部B超', department: '超声科', price: 120 },
  { code: 'ECG001', name: '心电图', department: '心电图室', price: 50 },
  { code: 'XRAY001', name: '胸部X光', department: '放射科', price: 80 }
];

const patients = [
  { name: '张三', idCard: '110101199001011234', phone: '13800138001' },
  { name: '李四', idCard: '110101199102022345', phone: '13800138002' },
  { name: '王五', idCard: '110101199203033456', phone: '13800138003' },
  { name: '赵六', idCard: '110101199304044567', phone: '13800138004' },
  { name: '钱七', idCard: '110101199405055678', phone: '13800138005' }
];

async function seedExamItems() {
  console.log('正在插入检查项目...');
  for (const item of examItems) {
    const exists = await getAsync('SELECT * FROM exam_items WHERE code = ?', [item.code]);
    if (!exists) {
      await runAsync(
        'INSERT INTO exam_items (id, name, code, department, price) VALUES (?, ?, ?, ?, ?)',
        [uuidv4(), item.name, item.code, item.department, item.price]
      );
    }
  }
  console.log('检查项目插入完成');
}

async function seedPatients() {
  console.log('正在插入患者数据...');
  for (const patient of patients) {
    const exists = await getAsync('SELECT * FROM patients WHERE id_card = ?', [patient.idCard]);
    if (!exists) {
      await runAsync(
        'INSERT INTO patients (id, name, id_card, phone, created_at) VALUES (?, ?, ?, ?, ?)',
        [uuidv4(), patient.name, patient.idCard, patient.phone, dayjs().toISOString()]
      );
    }
  }
  console.log('患者数据插入完成');
}

async function seedTimeSlots() {
  console.log('正在插入号源数据...');
  const allExamItems = await runAsync('SELECT * FROM exam_items');
  const rows = await new Promise<any[]>((resolve) => {
    runAsync('SELECT * FROM exam_items').then(() => {
      getAsync('SELECT * FROM exam_items LIMIT 1').then(() => {
        const db = require('../database').db;
        db.all('SELECT * FROM exam_items', [], async (err: Error, rows: any[]) => {
          resolve(rows);
        });
      });
    });
  });

  const timeRanges = [
    { start: '08:00', end: '08:30' },
    { start: '08:30', end: '09:00' },
    { start: '09:00', end: '09:30' },
    { start: '09:30', end: '10:00' },
    { start: '10:00', end: '10:30' },
    { start: '14:00', end: '14:30' },
    { start: '14:30', end: '15:00' },
    { start: '15:00', end: '15:30' }
  ];

  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const date = dayjs().add(dayOffset, 'day').format('YYYY-MM-DD');
    for (const examItem of rows) {
      for (const time of timeRanges) {
        const exists = await getAsync(
          'SELECT * FROM time_slots WHERE exam_item_id = ? AND date = ? AND start_time = ?',
          [examItem.id, date, time.start]
        );
        if (!exists) {
          await runAsync(
            'INSERT INTO time_slots (id, exam_item_id, date, start_time, end_time, total, available, occupied) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [uuidv4(), examItem.id, date, time.start, time.end, 5, 5, 0]
          );
        }
      }
    }
  }
  console.log('号源数据插入完成');
}

async function seedCompleteFlow() {
  console.log('正在插入完整流转示例数据...');

  const db = require('../database').db;
  const patient = await new Promise<any>((resolve) => {
    db.get('SELECT * FROM patients LIMIT 1', [], (err: Error, row: any) => resolve(row));
  });
  const examItem = await new Promise<any>((resolve) => {
    db.get('SELECT * FROM exam_items LIMIT 1', [], (err: Error, row: any) => resolve(row));
  });
  const timeSlot = await new Promise<any>((resolve) => {
    db.get('SELECT * FROM time_slots WHERE exam_item_id = ? LIMIT 1', [examItem.id], (err: Error, row: any) => resolve(row));
  });

  const checklist = await createChecklist({
    patientId: patient.id,
    patientName: patient.name,
    patientIdCard: patient.id_card,
    patientPhone: patient.phone,
    examItemId: examItem.id,
    examItemName: examItem.name,
    examItemCode: examItem.code,
    department: examItem.department,
    timeSlotId: timeSlot.id,
    timeSlotDate: timeSlot.date,
    timeSlotTime: `${timeSlot.start_time}-${timeSlot.end_time}`,
    operator: '张医生',
    businessObject: '门诊预约系统'
  });

  await updateStatusToPendingRelease(checklist.id, '李护士', '患者申请退费');
  await releaseChecklist(checklist.id, ReleaseReason.PATIENT_REFUND, '李护士', '已完成退费审批');

  console.log('完整流转示例数据插入完成:', checklist.checklistNo);
  return checklist;
}

async function seedConflictRecord() {
  console.log('正在插入冲突记录示例数据...');

  const db = require('../database').db;
  const patient = await new Promise<any>((resolve) => {
    db.all('SELECT * FROM patients LIMIT 2', [], (err: Error, rows: any[]) => resolve(rows[1]));
  });
  const examItem = await new Promise<any>((resolve) => {
    db.all('SELECT * FROM exam_items LIMIT 2', [], (err: Error, rows: any[]) => resolve(rows[1]));
  });
  const timeSlot = await new Promise<any>((resolve) => {
    db.get('SELECT * FROM time_slots WHERE exam_item_id = ? LIMIT 1', [examItem.id], (err: Error, row: any) => resolve(row));
  });

  await runAsync('UPDATE time_slots SET available = 0, occupied = total WHERE id = ?', [timeSlot.id]);

  const checklist = await createChecklist({
    patientId: patient.id,
    patientName: patient.name,
    patientIdCard: patient.id_card,
    patientPhone: patient.phone,
    examItemId: examItem.id,
    examItemName: examItem.name,
    examItemCode: examItem.code,
    department: examItem.department,
    timeSlotId: timeSlot.id,
    timeSlotDate: timeSlot.date,
    timeSlotTime: `${timeSlot.start_time}-${timeSlot.end_time}`,
    operator: '王医生',
    businessObject: '住院预约系统'
  });

  console.log('冲突记录示例数据插入完成:', checklist.checklistNo);
  return checklist;
}

async function seedRescheduleRecord() {
  console.log('正在插入改约记录示例数据...');

  const db = require('../database').db;
  const patient = await new Promise<any>((resolve) => {
    db.all('SELECT * FROM patients LIMIT 3', [], (err: Error, rows: any[]) => resolve(rows[2]));
  });
  const examItem = await new Promise<any>((resolve) => {
    db.all('SELECT * FROM exam_items LIMIT 3', [], (err: Error, rows: any[]) => resolve(rows[2]));
  });
  const timeSlots = await new Promise<any[]>((resolve) => {
    db.all('SELECT * FROM time_slots WHERE exam_item_id = ? LIMIT 2', [examItem.id], (err: Error, rows: any[]) => resolve(rows));
  });

  const checklist = await createChecklist({
    patientId: patient.id,
    patientName: patient.name,
    patientIdCard: patient.id_card,
    patientPhone: patient.phone,
    examItemId: examItem.id,
    examItemName: examItem.name,
    examItemCode: examItem.code,
    department: examItem.department,
    timeSlotId: timeSlots[0].id,
    timeSlotDate: timeSlots[0].date,
    timeSlotTime: `${timeSlots[0].start_time}-${timeSlots[0].end_time}`,
    operator: '赵医生',
    businessObject: '体检中心'
  });

  await rescheduleChecklist(checklist.id, timeSlots[1].id, '赵医生');

  console.log('改约记录示例数据插入完成:', checklist.checklistNo);
  return checklist;
}

async function main() {
  console.log('开始造数...');

  await seedExamItems();
  await seedPatients();
  await seedTimeSlots();
  await seedCompleteFlow();
  await seedConflictRecord();
  await seedRescheduleRecord();

  console.log('造数完成！');
  process.exit(0);
}

main().catch(console.error);
