import { ImportService } from '../services/import.service';
import { ExportService } from '../services/export.service';
import { ValidationService } from '../services/validation.service';
import { BookingStatus, EquipmentIntensity, ContraindicationType, BadRecordType } from '../types';

describe('运动康复门店康复器械预约 - 边界测试', () => {
  let importService: ImportService;
  let validationService: ValidationService;
  let exportService: ExportService;

  beforeEach(() => {
    importService = new ImportService();
    validationService = new ValidationService();
    exportService = new ExportService();
  });

  const createValidBooking = (overrides = {}) => ({
    预约编号: 'BK001',
    门店名称: '北京朝阳康复中心',
    患者姓名: '张三',
    患者手机号: '13800138000',
    患者身份证号: '110101199001011234',
    患者禁忌情况: ContraindicationType.NONE,
    器械编号: 'EQ001',
    器械名称: '上肢康复训练器',
    器械强度等级: EquipmentIntensity.MEDIUM,
    预约日期: '2024-01-15',
    预约开始时间: '09:00',
    预约结束时间: '09:30',
    治疗师姓名: '李医生',
    预约状态: BookingStatus.PENDING,
    预约备注: '初次康复训练',
    ...overrides
  });

  describe('1. 必填字段缺失测试', () => {
    test('缺失预约编号应被标记为异常', () => {
      const data = [createValidBooking({ 预约编号: '' })];
      const result = importService.importData(data);
      expect(result.异常记录数).toBe(1);
      expect(result.异常记录列表[0].错误类型).toBe(BadRecordType.MISSING_REQUIRED_FIELD);
      expect(result.异常记录列表[0].是否允许继续).toBe(false);
    });

    test('缺失患者姓名应被标记为异常', () => {
      const data = [createValidBooking({ 患者姓名: '' })];
      const result = importService.importData(data);
      expect(result.异常记录数).toBe(1);
      expect(result.异常记录列表[0].错误原因).toContain('缺少必填字段');
    });

    test('缺失多个必填字段应被正确识别', () => {
      const data = [createValidBooking({ 预约编号: '', 患者手机号: '', 器械名称: '' })];
      const result = importService.importData(data);
      expect(result.异常记录数).toBe(1);
      expect(result.异常记录列表[0].错误原因).toContain('预约编号');
      expect(result.异常记录列表[0].错误原因).toContain('患者手机号');
    });
  });

  describe('2. 格式验证测试', () => {
    test('手机号格式不正确应被标记为异常', () => {
      const data = [createValidBooking({ 患者手机号: '12345' })];
      const result = importService.importData(data);
      expect(result.异常记录数).toBe(1);
      expect(result.异常记录列表[0].错误类型).toBe(BadRecordType.INVALID_FORMAT);
    });

    test('日期格式不正确应被标记为异常', () => {
      const data = [createValidBooking({ 预约日期: '2024/01/15' })];
      const result = importService.importData(data);
      expect(result.异常记录数).toBe(1);
      expect(result.异常记录列表[0].错误原因).toContain('日期格式');
    });

    test('时间格式不正确应被标记为异常', () => {
      const data = [createValidBooking({ 预约开始时间: '9点' })];
      const result = importService.importData(data);
      expect(result.异常记录数).toBe(1);
    });
  });

  describe('3. 重复预约测试', () => {
    test('重复提交相同预约编号应被标记为异常', () => {
      const existingBookings = [createValidBooking()];
      const newData = [createValidBooking()];
      const result = importService.importData(newData, existingBookings);
      expect(result.异常记录数).toBe(1);
      expect(result.异常记录列表[0].错误类型).toBe(BadRecordType.DUPLICATE_BOOKING);
      expect(result.异常记录列表[0].是否允许继续).toBe(false);
    });

    test('不同预约编号应正常导入', () => {
      const existingBookings = [createValidBooking()];
      const newData = [createValidBooking({ 预约编号: 'BK002' })];
      const result = importService.importData(newData, existingBookings);
      expect(result.正常记录数).toBe(1);
    });
  });

  describe('4. 状态越级测试', () => {
    test('从待确认直接跳到已完成应被标记为异常但允许人工审核', () => {
      const existingBookings = [createValidBooking({ 预约状态: BookingStatus.PENDING })];
      const newData = [createValidBooking({ 预约状态: BookingStatus.COMPLETED })];
      const result = importService.importData(newData, existingBookings);
      expect(result.异常记录数).toBe(1);
      expect(result.异常记录列表[0].错误类型).toBe(BadRecordType.STATUS_TRANSITION_ERROR);
      expect(result.异常记录列表[0].是否允许继续).toBe(true);
    });

    test('正常状态流转应通过验证', () => {
      const existingBookings = [createValidBooking({ 预约状态: BookingStatus.PENDING })];
      const newData = [createValidBooking({ 预约状态: BookingStatus.CONFIRMED })];
      const result = importService.importData(newData, existingBookings);
      expect(result.正常记录数).toBe(1);
    });
  });

  describe('5. 禁忌患者与高强度器械冲突测试', () => {
    test('心脏病患者使用高强度器械应被标记为异常但允许人工审核', () => {
      const data = [createValidBooking({
        患者禁忌情况: ContraindicationType.HEART_DISEASE,
        器械强度等级: EquipmentIntensity.HIGH
      })];
      const result = importService.importData(data);
      expect(result.异常记录数).toBe(1);
      expect(result.异常记录列表[0].错误类型).toBe(BadRecordType.CONTRAINDICATION_CONFLICT);
      expect(result.异常记录列表[0].是否允许继续).toBe(true);
      expect(result.异常记录列表[0].后续处理建议).toContain('主治医生评估');
    });

    test('高血压患者使用中等强度器械应正常通过', () => {
      const data = [createValidBooking({
        患者禁忌情况: ContraindicationType.HIGH_BLOOD_PRESSURE,
        器械强度等级: EquipmentIntensity.MEDIUM
      })];
      const result = importService.importData(data);
      expect(result.正常记录数).toBe(1);
    });

    test('无禁忌患者使用高强度器械应正常通过', () => {
      const data = [createValidBooking({
        患者禁忌情况: ContraindicationType.NONE,
        器械强度等级: EquipmentIntensity.HIGH
      })];
      const result = importService.importData(data);
      expect(result.正常记录数).toBe(1);
    });
  });

  describe('6. 预约表一致性测试', () => {
    test('结束时间早于开始时间应被标记为异常', () => {
      const data = [createValidBooking({
        预约开始时间: '10:00',
        预约结束时间: '09:00'
      })];
      const result = importService.importData(data);
      expect(result.异常记录数).toBe(1);
      expect(result.异常记录列表[0].错误类型).toBe(BadRecordType.CONSISTENCY_ERROR);
    });

    test('预约时长小于15分钟应被标记为异常', () => {
      const data = [createValidBooking({
        预约开始时间: '09:00',
        预约结束时间: '09:10'
      })];
      const result = importService.importData(data);
      expect(result.异常记录数).toBe(1);
      expect(result.异常记录列表[0].是否允许继续).toBe(true);
    });
  });

  describe('7. 人工审核功能测试', () => {
    test('允许继续的异常记录审核通过后应转为正常记录', () => {
      const data = [createValidBooking({
        患者禁忌情况: ContraindicationType.HEART_DISEASE,
        器械强度等级: EquipmentIntensity.HIGH
      })];
      const result = importService.importData(data);
      const batchId = result.导入批次号;
      
      expect(result.异常记录数).toBe(1);
      expect(result.正常记录数).toBe(0);

      const reviewedResult = importService.reviewBadRecord({
        批次号: batchId,
        行号: 1,
        人工备注: '主治医生已评估确认患者可以进行此项训练',
        是否通过审核: true
      });

      expect(reviewedResult).not.toBeNull();
      expect(reviewedResult!.异常记录数).toBe(0);
      expect(reviewedResult!.正常记录数).toBe(1);
      expect(reviewedResult!.正常记录列表[0].预约备注).toContain('人工审核备注');
    });

    test('不允许继续的异常记录即使审核通过也不会转为正常', () => {
      const data = [createValidBooking({ 预约编号: '' })];
      const result = importService.importData(data);
      const batchId = result.导入批次号;

      const reviewedResult = importService.reviewBadRecord({
        批次号: batchId,
        行号: 1,
        人工备注: '尝试通过审核',
        是否通过审核: true
      });

      expect(reviewedResult).not.toBeNull();
      expect(reviewedResult!.异常记录数).toBe(1);
      expect(reviewedResult!.正常记录数).toBe(0);
    });
  });

  describe('8. 混合场景测试', () => {
    test('混合正常和多种异常记录应正确分类', () => {
      const data = [
        createValidBooking({ 预约编号: 'BK001' }),
        createValidBooking({ 预约编号: 'BK002', 患者手机号: 'invalid' }),
        createValidBooking({ 
          预约编号: 'BK003',
          患者禁忌情况: ContraindicationType.RECENT_SURGERY,
          器械强度等级: EquipmentIntensity.HIGH
        }),
        createValidBooking({ 预约编号: 'BK004', 门店名称: '' })
      ];
      const result = importService.importData(data);
      expect(result.总记录数).toBe(4);
      expect(result.正常记录数).toBe(1);
      expect(result.异常记录数).toBe(3);
    });
  });

  describe('9. 导出功能测试', () => {
    test('JSON导出应包含所有字段', () => {
      const data = [createValidBooking()];
      const result = importService.importData(data);
      const jsonOutput = exportService.exportToJSON(result);
      expect(jsonOutput).toContain('导入批次号');
      expect(jsonOutput).toContain('正常记录列表');
      expect(jsonOutput).toContain('异常记录列表');
    });

    test('表格报告导出应生成可读格式', () => {
      const data = [createValidBooking()];
      const result = importService.importData(data);
      const report = exportService.exportFullReport(result);
      expect(report).toContain('运动康复器械预约导入报告');
      expect(report).toContain('正常记录列表');
      expect(report).toContain('异常记录列表');
    });

    test('CSV导出应正确格式化', () => {
      const data = [createValidBooking()];
      const result = importService.importData(data);
      const { normalCSV, badCSV } = exportService.exportToCSV(result);
      expect(normalCSV).toContain('预约编号');
      expect(normalCSV).toContain('患者姓名');
    });
  });
});
