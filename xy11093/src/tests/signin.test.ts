import { createTables, dropTables } from '../database/init';
import { createEmployee } from '../services/employeeService';
import { createCourse } from '../services/courseService';
import {
  createSigninSupplement,
  getSigninRecordById,
  getNormalRecords,
  getAbnormalRecords,
  getSigninHistory,
  withdrawRecord,
  resubmitRecord,
  startManualProcess,
  processManual
} from '../services/signinService';
import { SigninStatus, AbnormalType } from '../types';

describe('企业内训签到补录系统测试', () => {
  let employeeLocal: any;
  let employeeRemote: any;
  let course: any;

  beforeAll(async () => {
    await createTables();

    employeeLocal = await createEmployee({
      employeeNo: 'TEST001',
      name: '本地员工',
      department: '技术部',
      isRemote: false,
      location: '北京'
    });

    employeeRemote = await createEmployee({
      employeeNo: 'TEST002',
      name: '外地员工',
      department: '市场部',
      isRemote: true,
      location: '上海'
    });

    course = await createCourse({
      courseCode: 'TEST-TRAIN-001',
      courseName: '测试培训课程',
      trainingDate: '2024-01-15',
      trainingLocation: '测试会议室',
      totalSeats: 50
    });
  });

  afterAll(async () => {
    await dropTables();
  });

  describe('正常记录测试', () => {
    it('本地员工线下签到 - 应为正常记录', async () => {
      const record = await createSigninSupplement({
        employeeId: employeeLocal.id,
        courseId: course.id,
        signinType: 'offline',
        seatNumber: 1,
        signinTime: '2024-01-15T09:00:00Z',
        submitterId: 'TESTADMIN',
        submitterName: '测试管理员'
      });

      expect(record.status).toBe(SigninStatus.NORMAL);
      expect(record.businessExplanation).toContain('校验通过');
      expect(record.abnormalType).toBeFalsy();

      const normalRecords = await getNormalRecords();
      expect(normalRecords.some(r => r.id === record.id)).toBe(true);
    });

    it('员工线上签到 - 应为正常记录', async () => {
      const record = await createSigninSupplement({
        employeeId: employeeRemote.id,
        courseId: course.id,
        signinType: 'online',
        signinTime: '2024-01-15T09:00:00Z',
        submitterId: 'TESTADMIN',
        submitterName: '测试管理员'
      });

      expect(record.status).toBe(SigninStatus.NORMAL);
      expect(record.businessExplanation).toContain('校验通过');
    });
  });

  describe('异常记录 - 外地员工线上签到误算线下座位', () => {
    it('外地员工选择线下签到 - 应识别为异常', async () => {
      const record = await createSigninSupplement({
        employeeId: employeeRemote.id,
        courseId: course.id,
        signinType: 'offline',
        seatNumber: 5,
        signinTime: '2024-01-15T09:05:00Z',
        submitterId: 'TESTADMIN',
        submitterName: '测试管理员'
      });

      expect(record.status).toBe(SigninStatus.ABNORMAL);
      expect(record.abnormalType).toBe(AbnormalType.ONLINE_WRONG_OFFLINE);
      expect(record.businessExplanation).toContain('外地员工');
      expect(record.businessExplanation).toContain('误算线下座位');

      const abnormalRecords = await getAbnormalRecords();
      expect(abnormalRecords.some(r => r.id === record.id)).toBe(true);
    });
  });

  describe('异常记录 - 签到表一致性', () => {
    it('线下签到缺少座位号 - 应识别为一致性错误', async () => {
      const record = await createSigninSupplement({
        employeeId: employeeLocal.id,
        courseId: course.id,
        signinType: 'offline',
        signinTime: '2024-01-15T09:10:00Z',
        submitterId: 'TESTADMIN',
        submitterName: '测试管理员'
      });

      expect(record.status).toBe(SigninStatus.ABNORMAL);
      expect(record.abnormalType).toBe(AbnormalType.CONSISTENCY_ERROR);
      expect(record.businessExplanation).toContain('缺少座位号');
      expect(record.businessExplanation).toContain('与签到表不一致');
    });

    it('线下签到座位冲突 - 应识别为座位冲突', async () => {
      const record1 = await createSigninSupplement({
        employeeId: employeeLocal.id,
        courseId: course.id,
        signinType: 'offline',
        seatNumber: 10,
        signinTime: '2024-01-15T09:15:00Z',
        submitterId: 'TESTADMIN',
        submitterName: '测试管理员'
      });
      expect(record1.status).toBe(SigninStatus.NORMAL);

      const record2 = await createSigninSupplement({
        employeeId: employeeRemote.id,
        courseId: course.id,
        signinType: 'offline',
        seatNumber: 10,
        signinTime: '2024-01-15T09:16:00Z',
        submitterId: 'TESTADMIN',
        submitterName: '测试管理员'
      });

      expect(record2.status).toBe(SigninStatus.ABNORMAL);
      expect(record2.abnormalType).toBe(AbnormalType.SEAT_CONFLICT);
      expect(record2.businessExplanation).toContain('座位号10已被占用');
    });
  });

  describe('撤回后再次提交的组合情况', () => {
    it('正常记录撤回后重新提交', async () => {
      const record = await createSigninSupplement({
        employeeId: employeeLocal.id,
        courseId: course.id,
        signinType: 'offline',
        seatNumber: 20,
        signinTime: '2024-01-15T10:00:00Z',
        submitterId: 'TESTADMIN',
        submitterName: '测试管理员'
      });
      expect(record.status).toBe(SigninStatus.NORMAL);

      const withdrawn = await withdrawRecord(
        record.id,
        'TESTADMIN',
        '测试管理员',
        '需要修改信息'
      );
      expect(withdrawn.status).toBe(SigninStatus.WITHDRAWN);

      const history = await getSigninHistory(record.id);
      expect(history.some(h => h.action === '撤回')).toBe(true);
      expect(history.some(h => h.previousStatus === SigninStatus.NORMAL)).toBe(true);
      expect(history.some(h => h.newStatus === SigninStatus.WITHDRAWN)).toBe(true);

      const resubmitted = await resubmitRecord(
        record.id,
        'offline',
        21,
        '2024-01-15T10:05:00Z',
        'TESTADMIN',
        '测试管理员'
      );
      expect(resubmitted.status).toBe(SigninStatus.NORMAL);

      const historyAfter = await getSigninHistory(record.id);
      expect(historyAfter.some(h => h.action === '重新提交')).toBe(true);
    });

    it('异常记录修改后重新提交变为正常', async () => {
      const record = await createSigninSupplement({
        employeeId: employeeRemote.id,
        courseId: course.id,
        signinType: 'offline',
        seatNumber: 25,
        signinTime: '2024-01-15T10:30:00Z',
        submitterId: 'TESTADMIN',
        submitterName: '测试管理员'
      });
      expect(record.status).toBe(SigninStatus.ABNORMAL);
      expect(record.abnormalType).toBe(AbnormalType.ONLINE_WRONG_OFFLINE);

      const resubmitted = await resubmitRecord(
        record.id,
        'online',
        undefined,
        '2024-01-15T10:35:00Z',
        'TESTADMIN',
        '测试管理员'
      );
      expect(resubmitted.status).toBe(SigninStatus.NORMAL);
      expect(resubmitted.abnormalType).toBeFalsy();
    });
  });

  describe('人工处理流程', () => {
    it('异常记录进入人工处理并通过', async () => {
      const record = await createSigninSupplement({
        employeeId: employeeRemote.id,
        courseId: course.id,
        signinType: 'offline',
        seatNumber: 30,
        signinTime: '2024-01-15T11:00:00Z',
        submitterId: 'TESTADMIN',
        submitterName: '测试管理员'
      });
      expect(record.status).toBe(SigninStatus.ABNORMAL);

      const processing = await startManualProcess(
        record.id,
        'MANAGER001',
        '经理',
        '员工当天确实在现场'
      );
      expect(processing.status).toBe(SigninStatus.MANUAL_PROCESSING);

      const processed = await processManual({
        recordId: record.id,
        operatorId: 'MANAGER001',
        operatorName: '经理',
        remark: '经核实员工确实到场，予以通过',
        resolution: 'approve'
      });
      expect(processed.status).toBe(SigninStatus.PROCESSED);
      expect(processed.businessExplanation).toContain('人工处理通过');
      expect(processed.businessExplanation).toContain('予以通过');

      const history = await getSigninHistory(record.id);
      expect(history.some(h => h.action === '启动人工处理')).toBe(true);
      expect(history.some(h => h.action === '人工处理通过')).toBe(true);
    });

    it('人工处理备注留痕', async () => {
      const record = await createSigninSupplement({
        employeeId: employeeLocal.id,
        courseId: course.id,
        signinType: 'offline',
        signinTime: '2024-01-15T11:30:00Z',
        submitterId: 'TESTADMIN',
        submitterName: '测试管理员'
      });
      expect(record.status).toBe(SigninStatus.ABNORMAL);

      const processing = await startManualProcess(
        record.id,
        'MANAGER001',
        '经理',
        '需要核实情况'
      );

      const processed = await processManual({
        recordId: record.id,
        operatorId: 'MANAGER001',
        operatorName: '经理',
        remark: '缺少座位号，无法确认，请补充信息',
        resolution: 'reject'
      });

      expect(processed.status).toBe(SigninStatus.ABNORMAL);
      expect(processed.businessExplanation).toContain('人工处理备注');
      expect(processed.businessExplanation).toContain('缺少座位号');

      const history = await getSigninHistory(record.id);
      const manualProcess = history.find(h => h.action === '人工处理驳回');
      expect(manualProcess).toBeDefined();
      expect(manualProcess?.remark).toContain('缺少座位号');
    });
  });

  describe('历史记录留痕', () => {
    it('每次状态变更都有历史记录', async () => {
      const record = await createSigninSupplement({
        employeeId: employeeRemote.id,
        courseId: course.id,
        signinType: 'offline',
        seatNumber: 35,
        signinTime: '2024-01-15T14:00:00Z',
        submitterId: 'TESTADMIN',
        submitterName: '测试管理员'
      });

      const withdrawn = await withdrawRecord(
        record.id,
        'TESTADMIN',
        '测试管理员',
        '撤回测试'
      );

      const resubmitted = await resubmitRecord(
        record.id,
        'online',
        undefined,
        '2024-01-15T14:05:00Z',
        'TESTADMIN',
        '测试管理员'
      );

      const history = await getSigninHistory(record.id);

      expect(history.length).toBeGreaterThanOrEqual(3);
      expect(history.some(h => h.action === '提交')).toBe(true);
      expect(history.some(h => h.action === '撤回')).toBe(true);
      expect(history.some(h => h.action === '重新提交')).toBe(true);

      const withdrawHistory = history.find(h => h.action === '撤回');
      expect(withdrawHistory?.remark).toBe('撤回测试');
      expect(withdrawHistory?.operatorName).toBe('测试管理员');
    });
  });

  describe('从列表到详情到历史的完整流程', () => {
    it('完整流程: 列表 -> 详情 -> 历史', async () => {
      const record = await createSigninSupplement({
        employeeId: employeeLocal.id,
        courseId: course.id,
        signinType: 'offline',
        seatNumber: 40,
        signinTime: '2024-01-15T15:00:00Z',
        submitterId: 'TESTADMIN',
        submitterName: '测试管理员'
      });

      const allRecords = await getNormalRecords();
      const foundInList = allRecords.find(r => r.id === record.id);
      expect(foundInList).toBeDefined();
      expect(foundInList?.recordNo).toBe(record.recordNo);

      const detail = await getSigninRecordById(record.id);
      expect(detail).toBeDefined();
      expect(detail?.employeeId).toBe(employeeLocal.id);
      expect(detail?.courseId).toBe(course.id);
      expect(detail?.signinType).toBe('offline');
      expect(detail?.seatNumber).toBe(40);
      expect(detail?.businessExplanation).toBeDefined();

      const history = await getSigninHistory(record.id);
      expect(history.length).toBeGreaterThanOrEqual(1);
      expect(history[0].recordId).toBe(record.id);
      expect(history[0].action).toBe('提交');
    });
  });
});
