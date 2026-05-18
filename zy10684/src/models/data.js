const { v4: uuidv4 } = require('uuid');

const doctors = [
  { id: 'doc_001', name: '张医生', department: '内科', title: '主任医师' },
  { id: 'doc_002', name: '李医生', department: '外科', title: '副主任医师' },
  { id: 'doc_003', name: '王医生', department: '儿科', title: '主治医师' },
];

const schedules = [
  { id: 'sch_001', doctorId: 'doc_001', date: '2026-05-20', timeSlot: '08:00-09:00', total: 20, available: 15, status: 'NORMAL' },
  { id: 'sch_002', doctorId: 'doc_001', date: '2026-05-20', timeSlot: '09:00-10:00', total: 20, available: 18, status: 'NORMAL' },
  { id: 'sch_003', doctorId: 'doc_002', date: '2026-05-20', timeSlot: '08:00-09:00', total: 15, available: 10, status: 'NORMAL' },
  { id: 'sch_004', doctorId: 'doc_003', date: '2026-05-21', timeSlot: '14:00-15:00', total: 25, available: 20, status: 'NORMAL' },
];

const patients = [
  { id: 'pat_001', name: '患者A', phone: '13800138001', idCard: '110101199001010001' },
  { id: 'pat_002', name: '患者B', phone: '13800138002', idCard: '110101199001010002' },
  { id: 'pat_003', name: '患者C', phone: '13800138003', idCard: '110101199001010003' },
  { id: 'pat_004', name: '患者D', phone: '13800138004', idCard: '110101199001010004' },
  { id: 'pat_005', name: '患者E', phone: '13800138005', idCard: '110101199001010005' },
];

const appointments = [
  { id: 'apt_001', patientId: 'pat_001', scheduleId: 'sch_001', status: 'CONFIRMED', createdAt: '2026-05-15T10:00:00Z' },
  { id: 'apt_002', patientId: 'pat_002', scheduleId: 'sch_001', status: 'CONFIRMED', createdAt: '2026-05-15T10:05:00Z' },
  { id: 'apt_003', patientId: 'pat_003', scheduleId: 'sch_001', status: 'CONFIRMED', createdAt: '2026-05-15T10:10:00Z' },
  { id: 'apt_004', patientId: 'pat_004', scheduleId: 'sch_003', status: 'CONFIRMED', createdAt: '2026-05-15T11:00:00Z' },
  { id: 'apt_005', patientId: 'pat_005', scheduleId: 'sch_004', status: 'CONFIRMED', createdAt: '2026-05-15T14:00:00Z' },
];

let rescheduleBatches = [];
let rescheduleRecords = [];
let operationHistory = [];

module.exports = {
  doctors,
  schedules,
  patients,
  appointments,
  rescheduleBatches,
  rescheduleRecords,
  operationHistory,
};
