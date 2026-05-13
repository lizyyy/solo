import sqlite3 from 'sqlite3';
import path from 'path';
import { initDatabase } from '../database/init';
import { DatabaseService } from '../services/database';
import { TreatmentService } from '../services/treatment';
import { TreatmentPhase, AlignerStatus, AppointmentStatus, ExceptionType, ExceptionStatus, TodoPriority } from '../types';

async function createSampleData() {
  console.log('Creating sample data...\n');

  const db = await initDatabase();
  const dbService = new DatabaseService(db);
  const treatmentService = new TreatmentService(dbService);

  console.log('1. Creating patients...');
  const patient1 = await treatmentService.createPatient({
    name: '张三',
    phone: '13800138001',
    doctorId: 'doc001',
    doctorName: '王医生',
    startDate: '2024-01-15',
    currentPhase: TreatmentPhase.ALIGNMENT,
    totalAligners: 40,
    currentAligner: 12
  }, 'admin', '系统管理员');
  console.log(`   Created patient: ${patient1.name} (ID: ${patient1.id})\n`);

  const patient2 = await treatmentService.createPatient({
    name: '李四',
    phone: '13800138002',
    doctorId: 'doc001',
    doctorName: '王医生',
    startDate: '2024-02-20',
    currentPhase: TreatmentPhase.INITIAL,
    totalAligners: 35,
    currentAligner: 3
  }, 'admin', '系统管理员');
  console.log(`   Created patient: ${patient2.name} (ID: ${patient2.id})\n`);

  console.log('2. Creating aligner batches...');
  const batch1 = await treatmentService.createAlignerBatch({
    patientId: patient1.id,
    batchNumber: 1,
    startAligner: 1,
    endAligner: 10,
    status: AlignerStatus.COMPLETED,
    receivedDate: '2024-01-15',
    startDate: '2024-01-20',
    expectedEndDate: '2024-03-20'
  }, 'admin', '系统管理员');
  console.log(`   Created batch ${batch1.batchNumber} for ${patient1.name}\n`);

  const batch2 = await treatmentService.createAlignerBatch({
    patientId: patient1.id,
    batchNumber: 2,
    startAligner: 11,
    endAligner: 20,
    status: AlignerStatus.IN_USE,
    receivedDate: '2024-03-15',
    startDate: '2024-03-21',
    expectedEndDate: '2024-05-21'
  }, 'admin', '系统管理员');
  console.log(`   Created batch ${batch2.batchNumber} for ${patient1.name}\n`);

  const batch3 = await treatmentService.createAlignerBatch({
    patientId: patient2.id,
    batchNumber: 1,
    startAligner: 1,
    endAligner: 8,
    status: AlignerStatus.PENDING,
    receivedDate: '2024-02-20'
  }, 'admin', '系统管理员');
  console.log(`   Created batch ${batch3.batchNumber} for ${patient2.name}\n`);

  console.log('3. Creating appointments...');
  const appointment1 = await treatmentService.createAppointment({
    patientId: patient1.id,
    batchId: batch1.id,
    scheduledDate: '2024-01-15',
    scheduledTime: '09:30',
    status: AppointmentStatus.COMPLETED,
    type: '初诊检查',
    doctorId: 'doc001',
    doctorName: '王医生',
    actualDate: '2024-01-15',
    notes: '患者初次就诊，进行口腔检查和取模'
  }, 'admin', '系统管理员');
  console.log(`   Created appointment: ${appointment1.type} for ${patient1.name}\n`);

  const appointment2 = await treatmentService.createAppointment({
    patientId: patient1.id,
    batchId: batch2.id,
    scheduledDate: '2024-03-21',
    scheduledTime: '14:00',
    status: AppointmentStatus.CONFIRMED,
    type: '复诊调整',
    doctorId: 'doc001',
    doctorName: '王医生',
    notes: '检查第二批次牙套佩戴情况'
  }, 'admin', '系统管理员');
  console.log(`   Created appointment: ${appointment2.type} for ${patient1.name}\n`);

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 2);
  const overdueDate = yesterday.toISOString().split('T')[0];
  
  const appointment3 = await treatmentService.createAppointment({
    patientId: patient2.id,
    batchId: batch3.id,
    scheduledDate: overdueDate,
    scheduledTime: '10:00',
    status: AppointmentStatus.SCHEDULED,
    type: '逾期复诊',
    doctorId: 'doc001',
    doctorName: '王医生',
    notes: '这是一个逾期的复诊'
  }, 'admin', '系统管理员');
  console.log(`   Created overdue appointment for ${patient2.name}\n`);

  console.log('4. Advancing treatment phase...');
  await treatmentService.updatePatientPhase(
    patient1.id,
    TreatmentPhase.ALIGNMENT,
    12,
    'doc001',
    '王医生',
    '患者顺利完成第一阶段治疗，进入第二阶段'
  );
  console.log(`   Updated ${patient1.name} treatment phase\n`);

  console.log('5. Completing a batch...');
  await treatmentService.advanceAlignerBatch(
    batch1.id,
    AlignerStatus.COMPLETED,
    '2024-03-18',
    'doc001',
    '王医生',
    '患者按时完成第一批次牙套佩戴'
  );
  console.log(`   Completed batch ${batch1.batchNumber}\n`);

  console.log('6. Creating a manual exception...');
  const exception1 = await treatmentService.createException({
    patientId: patient1.id,
    type: ExceptionType.ALIGNER_ISSUE,
    title: '牙套破损',
    description: '患者反映第15副牙套有破损',
    status: ExceptionStatus.OPEN,
    relatedBatchId: batch2.id,
    assigneeId: 'doc001',
    assigneeName: '王医生'
  }, 'nurse001', '张护士');
  console.log(`   Created exception: ${exception1.title}\n`);

  console.log('7. Resolving the exception...');
  await treatmentService.resolveException(
    exception1.id,
    '已重新制作牙套并寄送给患者',
    'doc001',
    '王医生',
    '确认牙套为制作问题，重新制作'
  );
  console.log(`   Resolved exception\n`);

  console.log('8. Checking overdue appointments (auto exception)...');
  const overdue = await treatmentService.checkOverdueAppointments();
  console.log(`   Found ${overdue.length} overdue appointments\n`);

  console.log('9. Getting patient timeline...');
  const timeline = await treatmentService.getPatientTimeline(patient1.id);
  console.log(`   Timeline has ${timeline.length} events\n`);
  timeline.forEach((event, index) => {
    console.log(`     ${index + 1}. [${event.eventType}] ${event.title} - ${event.reason || '无原因'}`);
  });
  console.log('');

  console.log('10. Getting modification history...');
  const history = await treatmentService.getModificationHistory('patient', patient1.id);
  console.log(`   Modification history has ${history.length} records\n`);

  console.log('11. Getting todos...');
  const todos = await treatmentService.getAllTodos('doc001');
  console.log(`   Found ${todos.length} todos for 王医生\n`);
  todos.forEach((todo, index) => {
    console.log(`     ${index + 1}. [${todo.status}] ${todo.description}`);
  });
  console.log('');

  console.log('12. Exporting report...');
  const report = await treatmentService.exportReport({
    assigneeId: 'doc001'
  });
  console.log(`   Exported ${report.length} records\n`);

  console.log('='.repeat(60));
  console.log('Sample data creation completed successfully!');
  console.log('\nSummary:');
  console.log(`  - Patients: 2`);
  console.log(`  - Aligner Batches: 3`);
  console.log(`  - Appointments: 3 (1 overdue)`);
  console.log(`  - Exceptions: 1 (resolved)`);
  console.log(`  - Timeline Events: ${timeline.length}`);
  console.log(`  - Todos: ${todos.length}`);
  console.log(`  - Modification History: ${history.length}`);
  console.log('\n' + '='.repeat(60));
  console.log('\nPatient IDs for testing:');
  console.log(`  - 张三: ${patient1.id}`);
  console.log(`  - 李四: ${patient2.id}`);

  process.exit(0);
}

createSampleData().catch(console.error);
