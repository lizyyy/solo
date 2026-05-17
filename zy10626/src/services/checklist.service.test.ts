import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import { runAsync } from '../database';
import {
  createChecklist,
  getChecklistById,
  queryChecklists,
  updateStatusToPendingRelease,
  releaseChecklist,
  rescheduleChecklist,
  getChecklistHistory,
  batchImport
} from './checklist.service';
import { CheckListStatus, ReleaseReason } from '../types';

describe('Checklist Service', () => {
  let testPatientId: string;
  let testExamItemId: string;
  let testTimeSlotId1: string;
  let testTimeSlotId2: string;

  beforeAll(async () => {
    testPatientId = uuidv4();
    await runAsync(
      'INSERT INTO patients (id, name, id_card, phone, created_at) VALUES (?, ?, ?, ?, ?)',
      [testPatientId, '测试患者', '110101199001019999', '13900139999', dayjs().toISOString()]
    );

    testExamItemId = uuidv4();
    await runAsync(
      'INSERT INTO exam_items (id, name, code, department, price) VALUES (?, ?, ?, ?, ?)',
      [testExamItemId, '测试检查项目', 'TEST001', '测试科室', 100]
    );

    testTimeSlotId1 = uuidv4();
    await runAsync(
      'INSERT INTO time_slots (id, exam_item_id, date, start_time, end_time, total, available, occupied) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [testTimeSlotId1, testExamItemId, dayjs().format('YYYY-MM-DD'), '08:00', '08:30', 5, 5, 0]
    );

    testTimeSlotId2 = uuidv4();
    await runAsync(
      'INSERT INTO time_slots (id, exam_item_id, date, start_time, end_time, total, available, occupied) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [testTimeSlotId2, testExamItemId, dayjs().add(1, 'day').format('YYYY-MM-DD'), '09:00', '09:30', 5, 5, 0]
    );
  });

  describe('createChecklist', () => {
    it('应该成功创建检查单并占号', async () => {
      const checklist = await createChecklist({
        patientId: testPatientId,
        patientName: '测试患者',
        patientIdCard: '110101199001019999',
        patientPhone: '13900139999',
        examItemId: testExamItemId,
        examItemName: '测试检查项目',
        examItemCode: 'TEST001',
        department: '测试科室',
        timeSlotId: testTimeSlotId1,
        timeSlotDate: dayjs().format('YYYY-MM-DD'),
        timeSlotTime: '08:00-08:30',
        operator: '测试医生',
        businessObject: '测试系统'
      });

      expect(checklist).toBeDefined();
      expect(checklist.status).toBe(CheckListStatus.OCCUPIED);
      expect(checklist.checklistNo).toBeDefined();
    });

    it('号源不存在时应该抛出错误', async () => {
      await expect(
        createChecklist({
          patientId: testPatientId,
          patientName: '测试患者',
          patientIdCard: '110101199001019999',
          patientPhone: '13900139999',
          examItemId: testExamItemId,
          examItemName: '测试检查项目',
          examItemCode: 'TEST001',
          department: '测试科室',
          timeSlotId: 'not-exist-id',
          timeSlotDate: dayjs().format('YYYY-MM-DD'),
          timeSlotTime: '08:00-08:30',
          operator: '测试医生',
          businessObject: '测试系统'
        })
      ).rejects.toThrow('号源不存在');
    });
  });

  describe('状态流转', () => {
    let checklistId: string;

    beforeEach(async () => {
      const checklist = await createChecklist({
        patientId: testPatientId,
        patientName: '测试患者',
        patientIdCard: '110101199001019999',
        patientPhone: '13900139999',
        examItemId: testExamItemId,
        examItemName: '测试检查项目',
        examItemCode: 'TEST001',
        department: '测试科室',
        timeSlotId: testTimeSlotId1,
        timeSlotDate: dayjs().format('YYYY-MM-DD'),
        timeSlotTime: '08:00-08:30',
        operator: '测试医生',
        businessObject: '测试系统'
      });
      checklistId = checklist.id;
    });

    it('已占号应该可以转为待释放', async () => {
      const updated = await updateStatusToPendingRelease(checklistId, '测试护士', '测试备注');
      expect(updated.status).toBe(CheckListStatus.PENDING_RELEASE);
    });

    it('待释放状态应该可以释放', async () => {
      await updateStatusToPendingRelease(checklistId, '测试护士', '测试备注');
      const released = await releaseChecklist(checklistId, ReleaseReason.PATIENT_REFUND, '测试护士', '测试');
      expect(released.status).toBe(CheckListStatus.RELEASED);
      expect(released.releaseReason).toBe(ReleaseReason.PATIENT_REFUND);
    });

    it('应该支持改约', async () => {
      const rescheduled = await rescheduleChecklist(checklistId, testTimeSlotId2, '测试医生');
      expect(rescheduled.status).toBe(CheckListStatus.RESCHEDULED);
      expect(rescheduled.timeSlotId).toBe(testTimeSlotId2);
    });

    it('应该记录操作历史', async () => {
      await updateStatusToPendingRelease(checklistId, '测试护士', '测试备注');
      await releaseChecklist(checklistId, ReleaseReason.PATIENT_REFUND, '测试护士', '测试');

      const history = await getChecklistHistory(checklistId);
      expect(history.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('queryChecklists', () => {
    it('应该支持按状态筛选', async () => {
      const result = await queryChecklists({ status: CheckListStatus.RELEASED });
      expect(result.list).toBeDefined();
      expect(Array.isArray(result.list)).toBe(true);
    });

    it('应该支持分页', async () => {
      const result = await queryChecklists({ page: 1, pageSize: 10 });
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(10);
    });
  });

  describe('batchImport', () => {
    it('应该支持批量导入并正确处理坏行', async () => {
      const result = await batchImport([
        {
          patientName: '批量导入测试1',
          patientIdCard: '110101199001018881',
          patientPhone: '13700137001',
          examItemCode: 'TEST001',
          timeSlotDate: dayjs().add(2, 'day').format('YYYY-MM-DD'),
          timeSlotTime: '08:00-08:30',
          businessObject: '批量导入测试'
        },
        {
          patientName: '坏行-缺少身份证',
          patientIdCard: '',
          examItemCode: 'TEST001',
          timeSlotDate: dayjs().add(2, 'day').format('YYYY-MM-DD'),
          timeSlotTime: '08:00-08:30'
        },
        {
          patientName: '坏行-无效编码',
          patientIdCard: '110101199001018882',
          examItemCode: 'INVALID',
          timeSlotDate: dayjs().add(2, 'day').format('YYYY-MM-DD'),
          timeSlotTime: '08:00-08:30'
        }
      ], '批量导入操作员');

      expect(result.total).toBe(3);
      expect(result.success).toBe(1);
      expect(result.failed).toBe(2);
      expect(result.details.length).toBe(3);
      expect(result.details[0].success).toBe(true);
      expect(result.details[1].success).toBe(false);
      expect(result.details[2].success).toBe(false);
      expect(result.details[1].error).toBeDefined();
    });
  });
});
