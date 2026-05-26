import { calculateMaterialHash } from '../src/services/idempotency';
import { validateTrainingMaterial } from '../src/services/validation';
import { TrainingMaterial } from '../src/types';

const validMaterial: TrainingMaterial = {
  trainingId: 'TRAIN-001',
  trainingName: '企业安全培训',
  trainer: '张老师',
  trainingDate: '2024-01-15',
  startTime: '09:00:00',
  endTime: '17:00:00',
  location: '会议室A',
  attendance: [
    {
      employeeId: 'EMP-001',
      employeeName: '张三',
      department: '技术部',
      signInTime: '09:00:00',
      signOutTime: '17:00:00',
    },
    {
      employeeId: 'EMP-002',
      employeeName: '李四',
      department: '人事部',
      signInTime: '09:00:00',
      signOutTime: '17:00:00',
    },
  ],
};

describe('幂等性检测', () => {
  test('相同材料生成相同哈希', () => {
    const hash1 = calculateMaterialHash([validMaterial]);
    const hash2 = calculateMaterialHash([validMaterial]);
    expect(hash1).toBe(hash2);
  });

  test('不同材料生成不同哈希', () => {
    const modifiedMaterial = { ...validMaterial, trainingName: '修改后的培训' };
    const hash1 = calculateMaterialHash([validMaterial]);
    const hash2 = calculateMaterialHash([modifiedMaterial]);
    expect(hash1).not.toBe(hash2);
  });
});

describe('验证服务', () => {
  test('有效材料无错误', () => {
    const existingIds = new Set<string>();
    const errors = validateTrainingMaterial(validMaterial, 0, existingIds);
    expect(errors.length).toBe(0);
  });

  test('缺少必填字段返回错误', () => {
    const invalidMaterial: any = {
      trainingId: 'TRAIN-002',
      trainingName: '',
      trainer: '张老师',
      trainingDate: '2024-01-15',
      startTime: '09:00:00',
      endTime: '17:00:00',
      location: '会议室A',
      attendance: [],
    };
    const existingIds = new Set<string>();
    const errors = validateTrainingMaterial(invalidMaterial, 0, existingIds);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].field).toBe('trainingName');
    expect(errors[0].materialIndex).toBe(0);
  });

  test('培训编号重复返回错误', () => {
    const existingIds = new Set<string>(['TRAIN-001']);
    const errors = validateTrainingMaterial(validMaterial, 0, existingIds);
    expect(errors.length).toBe(1);
    expect(errors[0].error).toContain('培训编号重复');
    expect(errors[0].materialIndex).toBe(0);
  });

  test('培训结束时间早于开始时间返回错误', () => {
    const invalidMaterial = {
      ...validMaterial,
      trainingId: 'TRAIN-003',
      startTime: '17:00:00',
      endTime: '09:00:00',
    };
    const existingIds = new Set<string>();
    const errors = validateTrainingMaterial(invalidMaterial, 0, existingIds);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].error).toContain('培训结束时间必须晚于开始时间');
  });

  test('签到时间早于培训开始时间返回错误', () => {
    const invalidMaterial = {
      ...validMaterial,
      trainingId: 'TRAIN-004',
      attendance: [
        {
          employeeId: 'EMP-001',
          employeeName: '张三',
          department: '技术部',
          signInTime: '08:00:00',
          signOutTime: '17:00:00',
        },
      ],
    };
    const existingIds = new Set<string>();
    const errors = validateTrainingMaterial(invalidMaterial, 0, existingIds);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].error).toContain('签到时间不能早于培训开始时间');
    expect(errors[0].attendanceIndex).toBe(0);
  });

  test('同一培训中员工编号重复返回错误', () => {
    const invalidMaterial = {
      ...validMaterial,
      trainingId: 'TRAIN-005',
      attendance: [
        {
          employeeId: 'EMP-001',
          employeeName: '张三',
          department: '技术部',
          signInTime: '09:00:00',
          signOutTime: '17:00:00',
        },
        {
          employeeId: 'EMP-001',
          employeeName: '张三',
          department: '技术部',
          signInTime: '09:00:00',
          signOutTime: '17:00:00',
        },
      ],
    };
    const existingIds = new Set<string>();
    const errors = validateTrainingMaterial(invalidMaterial, 0, existingIds);
    expect(errors.length).toBe(1);
    expect(errors[0].error).toContain('员工编号在同一培训中重复');
    expect(errors[0].attendanceIndex).toBe(1);
  });

  test('培训字段缺失返回错误并保留位置', () => {
    const invalidMaterial: any = {
      trainingId: 'TRAIN-006',
      trainingName: undefined,
      trainer: null,
      trainingDate: '',
      startTime: '09:00:00',
      endTime: '17:00:00',
      location: '会议室A',
      attendance: [],
    };
    const existingIds = new Set<string>();
    const errors = validateTrainingMaterial(invalidMaterial, 2, existingIds);
    expect(errors.length).toBeGreaterThanOrEqual(3);
    const fieldErrors = errors.map(e => e.field);
    expect(fieldErrors).toContain('trainingName');
    expect(fieldErrors).toContain('trainer');
    expect(fieldErrors).toContain('trainingDate');
    errors.forEach(e => {
      expect(e.materialIndex).toBe(2);
    });
  });

  test('第0条签到记录字段缺失时attendanceIndex应为0', () => {
    const invalidMaterial: any = {
      trainingId: 'TRAIN-007',
      trainingName: '测试培训',
      trainer: '张老师',
      trainingDate: '2024-01-15',
      startTime: '09:00:00',
      endTime: '17:00:00',
      location: '会议室A',
      attendance: [
        {
          employeeId: '',
          employeeName: undefined,
          department: null,
          signInTime: '09:00:00',
          signOutTime: '17:00:00',
        },
      ],
    };
    const existingIds = new Set<string>();
    const errors = validateTrainingMaterial(invalidMaterial, 0, existingIds);
    expect(errors.length).toBeGreaterThanOrEqual(3);
    const attendanceErrors = errors.filter(e => e.attendanceIndex !== undefined);
    attendanceErrors.forEach(e => {
      expect(e.attendanceIndex).toBe(0);
    });
  });

  test('多个签到记录错误时位置正确映射', () => {
    const invalidMaterial: any = {
      trainingId: 'TRAIN-008',
      trainingName: '测试培训',
      trainer: '张老师',
      trainingDate: '2024-01-15',
      startTime: '09:00:00',
      endTime: '17:00:00',
      location: '会议室A',
      attendance: [
        {
          employeeId: 'EMP-001',
          employeeName: '张三',
          department: '技术部',
          signInTime: '08:00:00',
          signOutTime: '18:00:00',
        },
        {
          employeeId: 'EMP-002',
          employeeName: '',
          department: null,
          signInTime: '09:00:00',
          signOutTime: '17:00:00',
        },
      ],
    };
    const existingIds = new Set<string>();
    const errors = validateTrainingMaterial(invalidMaterial, 1, existingIds);
    expect(errors.length).toBeGreaterThanOrEqual(4);
    const index0Errors = errors.filter(e => e.attendanceIndex === 0);
    const index1Errors = errors.filter(e => e.attendanceIndex === 1);
    expect(index0Errors.length).toBeGreaterThan(0);
    expect(index1Errors.length).toBeGreaterThan(0);
    index0Errors.forEach(e => expect(e.materialIndex).toBe(1));
    index1Errors.forEach(e => expect(e.materialIndex).toBe(1));
  });

  test('时间矛盾错误位置正确', () => {
    const invalidMaterial: any = {
      trainingId: 'TRAIN-009',
      trainingName: '测试培训',
      trainer: '张老师',
      trainingDate: '2024-01-15',
      startTime: '09:00:00',
      endTime: '17:00:00',
      location: '会议室A',
      attendance: [
        {
          employeeId: 'EMP-001',
          employeeName: '张三',
          department: '技术部',
          signInTime: '17:00:00',
          signOutTime: '09:00:00',
        },
      ],
    };
    const existingIds = new Set<string>();
    const errors = validateTrainingMaterial(invalidMaterial, 0, existingIds);
    const timeErrors = errors.filter(e => e.error.includes('签退时间必须晚于签到时间'));
    expect(timeErrors.length).toBe(1);
    expect(timeErrors[0].attendanceIndex).toBe(0);
    expect(timeErrors[0].materialIndex).toBe(0);
  });
});
