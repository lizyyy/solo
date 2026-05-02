import { getDatabase, initDatabase } from '../database.js';
import { v4 as uuidv4 } from 'uuid';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const exampleDataPath = join(__dirname, '../../../data/example-data.json');

export function initSampleData() {
  const db = getDatabase();
  initDatabase();

  console.log('正在初始化示例数据...');

  const sampleData = JSON.parse(readFileSync(exampleDataPath, 'utf-8'));

  const caseIdMap = new Map();
  const toothIdMap = new Map();

  for (const caseData of sampleData.cases) {
    const caseId = uuidv4();
    caseIdMap.set(caseData.caseNumber, caseId);

    const stmt = db.prepare(`
      INSERT INTO cases (
        id, case_number, patient_name, doctor_name, clinic_name,
        status, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      caseId,
      caseData.caseNumber,
      caseData.patientName,
      caseData.doctorName,
      caseData.clinicName,
      caseData.status,
      caseData.notes
    );

    console.log(`  创建病例: ${caseData.caseNumber} - ${caseData.patientName}`);
  }

  const caseNumbers = [...caseIdMap.keys()];
  for (let i = 0; i < sampleData.teeth.length; i++) {
    const toothData = sampleData.teeth[i];
    const caseNumber = caseNumbers[i % caseNumbers.length];
    const caseId = caseIdMap.get(caseNumber);
    const toothId = uuidv4();

    toothIdMap.set(`${caseNumber}-${toothData.toothNumber}`, toothId);

    const stmt = db.prepare(`
      INSERT INTO teeth (
        id, case_id, tooth_number, tooth_type, is_rework,
        rework_count, version, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      toothId,
      caseId,
      toothData.toothNumber,
      toothData.toothType,
      toothData.isRework ? 1 : 0,
      toothData.reworkCount,
      toothData.version,
      toothData.status
    );

    console.log(`  创建牙位: ${toothData.toothNumber} - ${toothData.toothType} (病例: ${caseNumber})`);
  }

  for (let i = 0; i < sampleData.prescriptions.length; i++) {
    const rxData = sampleData.prescriptions[i];
    const caseNumber = caseNumbers[i % caseNumbers.length];
    const caseId = caseIdMap.get(caseNumber);

    const stmt = db.prepare(`
      INSERT INTO prescriptions (
        id, case_id, prescription_number, received_at, doctor_name,
        tooth_numbers, restoration_type, material, shade, due_date, notes
      ) VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      uuidv4(),
      caseId,
      rxData.prescriptionNumber,
      rxData.doctorName,
      rxData.toothNumbers,
      rxData.restorationType,
      rxData.material,
      rxData.shade,
      rxData.dueDate,
      rxData.notes
    );

    console.log(`  创建处方: ${rxData.prescriptionNumber}`);
  }

  if (sampleData.rework_requests.length > 0) {
    const case4Id = caseIdMap.get('CASE-2024-004');
    const case2Id = caseIdMap.get('CASE-2024-002');
    const tooth37Id = toothIdMap.get('CASE-2024-002-37');
    const tooth36Id = toothIdMap.get('CASE-2024-002-36');

    const rework1Data = sampleData.rework_requests[0];
    db.prepare(`
      INSERT INTO rework_requests (
        id, case_id, tooth_id, request_date, reason_code,
        reason_description, rework_type, requested_by, source_step,
        target_step, status
      ) VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      uuidv4(),
      case4Id || case2Id,
      tooth37Id,
      rework1Data.reasonCode,
      rework1Data.reasonDescription,
      rework1Data.reworkType,
      rework1Data.requestedBy,
      rework1Data.sourceStep,
      rework1Data.targetStep,
      rework1Data.status
    );
    console.log(`  创建返工申请: ${rework1Data.reasonCode} - ${rework1Data.reasonDescription}`);

    if (sampleData.rework_requests[1]) {
      const rework2Data = sampleData.rework_requests[1];
      db.prepare(`
        INSERT INTO rework_requests (
          id, case_id, tooth_id, request_date, reason_code,
          reason_description, rework_type, requested_by, source_step,
          target_step, status
        ) VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        uuidv4(),
        case2Id,
        tooth36Id,
        rework2Data.reasonCode,
        rework2Data.reasonDescription,
        rework2Data.reworkType,
        rework2Data.requestedBy,
        rework2Data.sourceStep,
        rework2Data.targetStep,
        rework2Data.status
      );
      console.log(`  创建返工申请: ${rework2Data.reasonCode} - ${rework2Data.reasonDescription}`);
    }
  }

  if (sampleData.try_in_feedbacks.length > 0) {
    const case3Id = caseIdMap.get('CASE-2024-003');
    const case2Id = caseIdMap.get('CASE-2024-002');
    const tooth11Id = toothIdMap.get('CASE-2024-003-11');
    const tooth36Id = toothIdMap.get('CASE-2024-002-36');

    const feedback1Data = sampleData.try_in_feedbacks[0];
    db.prepare(`
      INSERT INTO try_in_feedbacks (
        id, case_id, tooth_id, feedback_date, doctor_name,
        fit_status, occlusion_status, esthetics_status, notes,
        needs_rework, rework_reason, is_followed_up
      ) VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      uuidv4(),
      case3Id,
      tooth11Id,
      feedback1Data.doctorName,
      feedback1Data.fitStatus,
      feedback1Data.occlusionStatus,
      feedback1Data.estheticsStatus,
      feedback1Data.notes,
      feedback1Data.needsRework ? 1 : 0,
      feedback1Data.reworkReason,
      feedback1Data.isFollowedUp ? 1 : 0
    );
    console.log(`  创建试戴反馈: ${feedback1Data.fitStatus}`);

    if (sampleData.try_in_feedbacks[1]) {
      const feedback2Data = sampleData.try_in_feedbacks[1];
      db.prepare(`
        INSERT INTO try_in_feedbacks (
          id, case_id, tooth_id, feedback_date, doctor_name,
          fit_status, occlusion_status, esthetics_status, notes,
          needs_rework, rework_reason, is_followed_up
        ) VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        uuidv4(),
        case2Id,
        tooth36Id,
        feedback2Data.doctorName,
        feedback2Data.fitStatus,
        feedback2Data.occlusionStatus,
        feedback2Data.estheticsStatus,
        feedback2Data.notes,
        feedback2Data.needsRework ? 1 : 0,
        feedback2Data.reworkReason,
        feedback2Data.isFollowedUp ? 1 : 0
      );
      console.log(`  创建试戴反馈: ${feedback2Data.fitStatus}`);
    }
  }

  console.log('\n示例数据初始化完成!');
  console.log(`\n已创建:
  - ${sampleData.cases.length} 个病例
  - ${sampleData.teeth.length} 个牙位记录
  - ${sampleData.prescriptions.length} 个处方
  - ${sampleData.rework_requests.length} 个返工申请
  - ${sampleData.try_in_feedbacks.length} 个试戴反馈`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  initSampleData();
}
