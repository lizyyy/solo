import { importService } from '../services/import.service';
import { storageService } from '../services/storage.service';
import { reviewService } from '../services/review.service';
import { DetentionFeeStatus, DetentionReason } from '../types/detention-fee';

describe('口岸仓储代理口岸滞箱费用导入接口测试', () => {
  beforeEach(() => {
    storageService.clear();
  });

  describe('正常导入测试', () => {
    it('应该成功导入完整的滞箱费用记录', () => {
      const result = importService.import({
        records: [
          {
            billOfLadingNo: 'COSCOSH202405001',
            containerNo: 'CNTR0012345',
            vesselVoyage: 'COSCO HONG KONG V.001E',
            portCode: 'CNSHA',
            portName: '上海港',
            storageAgentCode: 'SA001',
            storageAgentName: '上海XX仓储有限公司',
            customerCode: 'CUST001',
            customerName: 'XX国际贸易有限公司',
            entryDate: '2024-05-01',
            exitDate: '2024-05-10',
            detentionDays: 9,
            freeDays: 7,
            billableDays: 2,
            currency: 'CNY',
            dailyRate: 200,
            totalAmount: 400,
            detentionReasons: [DetentionReason.CUSTOMER_DELAY],
            reasonDescription: '客户清关延误导致滞箱',
            isCustomsInspection: false,
            isCustomerDelay: true
          }
        ],
        operatorId: 'OP001',
        operatorName: '张三'
      });

      expect(result.success).toBe(true);
      expect(result.totalCount).toBe(1);
      expect(result.successCount).toBe(1);
      expect(result.failedCount).toBe(0);
      expect(result.results[0].success).toBe(true);
      expect(result.results[0].record?.billOfLadingNo).toBe('COSCOSH202405001');
    });
  });

  describe('缺字段验证测试', () => {
    it('应该拒绝缺少必填字段的记录并返回建议', () => {
      const result = importService.import({
        records: [
          {
            billOfLadingNo: 'COSCOSH202405002',
            portCode: 'CNSHA',
            portName: '上海港',
            detentionDays: 5,
            freeDays: 3,
            billableDays: 2,
            currency: 'CNY',
            dailyRate: 200,
            totalAmount: 400,
            detentionReasons: [DetentionReason.CUSTOMER_DELAY]
          }
        ],
        operatorId: 'OP001',
        operatorName: '张三'
      });

      expect(result.success).toBe(false);
      expect(result.failedCount).toBe(1);
      expect(result.results[0].errorCode).toBe('MISSING_FIELDS');
      expect(result.results[0].errorMessage).toContain('缺少必填字段');
      expect(result.results[0].suggestion).toBe('请补充完整必填字段后重新提交');
      expect(result.results[0].originalData).toBeDefined();
      expect(result.results[0].originalData?.billOfLadingNo).toBe('COSCOSH202405002');
    });
  });

  describe('重复提交检测测试', () => {
    it('应该拒绝重复导入相同提单号+箱号+口岸的记录', () => {
      const recordData = {
        billOfLadingNo: 'COSCOSH202405003',
        containerNo: 'CNTR0012346',
        vesselVoyage: 'COSCO HONG KONG V.001E',
        portCode: 'CNSHA',
        portName: '上海港',
        storageAgentCode: 'SA001',
        storageAgentName: '上海XX仓储有限公司',
        customerCode: 'CUST001',
        customerName: 'XX国际贸易有限公司',
        entryDate: '2024-05-01',
        detentionDays: 5,
        freeDays: 3,
        billableDays: 2,
        currency: 'CNY',
        dailyRate: 200,
        totalAmount: 400,
        detentionReasons: [DetentionReason.CUSTOMER_DELAY]
      };

      const firstResult = importService.import({
        records: [recordData],
        operatorId: 'OP001',
        operatorName: '张三'
      });
      expect(firstResult.success).toBe(true);

      const secondResult = importService.import({
        records: [recordData],
        operatorId: 'OP001',
        operatorName: '张三'
      });

      expect(secondResult.success).toBe(false);
      expect(secondResult.failedCount).toBe(1);
      expect(secondResult.results[0].errorCode).toBe('DUPLICATE_RECORD');
      expect(secondResult.results[0].errorMessage).toContain('请勿重复导入');
      expect(secondResult.results[0].suggestion).toContain('核实是否为重复导入');
      expect(secondResult.results[0].originalData?.containerNo).toBe('CNTR0012346');
    });
  });

  describe('状态越级校验测试', () => {
    it('应该拒绝从已导入直接跳转到已开票的越级状态', () => {
      const recordData = {
        billOfLadingNo: 'COSCOSH202405004',
        containerNo: 'CNTR0012347',
        vesselVoyage: 'COSCO HONG KONG V.001E',
        portCode: 'CNSHA',
        portName: '上海港',
        storageAgentCode: 'SA001',
        storageAgentName: '上海XX仓储有限公司',
        customerCode: 'CUST001',
        customerName: 'XX国际贸易有限公司',
        entryDate: '2024-05-01',
        detentionDays: 5,
        freeDays: 3,
        billableDays: 2,
        currency: 'CNY',
        dailyRate: 200,
        totalAmount: 400,
        detentionReasons: [DetentionReason.CUSTOMER_DELAY],
        status: DetentionFeeStatus.INVOICED
      };

      const result = importService.import({
        records: [recordData],
        operatorId: 'OP001',
        operatorName: '张三'
      });

      expect(result.success).toBe(false);
      expect(result.results[0].errorCode).toBe('STATUS_TRANSITION_INVALID');
      expect(result.results[0].errorMessage).toContain('不符合流程规则');
      expect(result.results[0].suggestion).toBe('状态跳转不符合业务流程规则，请按顺序逐级推进');
    });

    it('应该允许从已导入正常推进到待审核状态', () => {
      const recordData = {
        billOfLadingNo: 'COSCOSH202405005',
        containerNo: 'CNTR0012348',
        vesselVoyage: 'COSCO HONG KONG V.001E',
        portCode: 'CNSHA',
        portName: '上海港',
        storageAgentCode: 'SA001',
        storageAgentName: '上海XX仓储有限公司',
        customerCode: 'CUST001',
        customerName: 'XX国际贸易有限公司',
        entryDate: '2024-05-01',
        detentionDays: 5,
        freeDays: 3,
        billableDays: 2,
        currency: 'CNY',
        dailyRate: 200,
        totalAmount: 400,
        detentionReasons: [DetentionReason.CUSTOMER_DELAY],
        status: DetentionFeeStatus.IMPORTED
      };

      const result = importService.import({
        records: [recordData],
        operatorId: 'OP001',
        operatorName: '张三'
      });

      expect(result.success).toBe(true);
      expect(result.results[0].record?.status).toBe(DetentionFeeStatus.IMPORTED);
    });
  });

  describe('海关查验+客户延迟共同原因测试', () => {
    it('应该识别双重原因并要求人工备注', () => {
      const result = importService.import({
        records: [
          {
            billOfLadingNo: 'COSCOSH202405006',
            containerNo: 'CNTR0012349',
            vesselVoyage: 'COSCO HONG KONG V.001E',
            portCode: 'CNSHA',
            portName: '上海港',
            storageAgentCode: 'SA001',
            storageAgentName: '上海XX仓储有限公司',
            customerCode: 'CUST001',
            customerName: 'XX国际贸易有限公司',
            entryDate: '2024-05-01',
            exitDate: '2024-05-15',
            detentionDays: 14,
            freeDays: 7,
            billableDays: 7,
            currency: 'CNY',
            dailyRate: 200,
            totalAmount: 1400,
            detentionReasons: [DetentionReason.CUSTOMS_INSPECTION, DetentionReason.CUSTOMER_DELAY],
            reasonDescription: '海关查验+客户清关延误共同导致滞箱',
            isCustomsInspection: true,
            isCustomerDelay: true
          }
        ],
        operatorId: 'OP001',
        operatorName: '张三'
      });

      expect(result.success).toBe(false);
      expect(result.requiresManualReviewCount).toBe(1);
      expect(result.results[0].errorCode).toBe('JOINT_REASON_REQUIRES_REMARK');
      expect(result.results[0].errorMessage).toContain('需添加人工备注');
      expect(result.results[0].suggestion).toContain('费用明细一致性');
    });

    it('添加人工备注后应该可以正常推进', () => {
      const recordData = {
        billOfLadingNo: 'COSCOSH202405007',
        containerNo: 'CNTR0012350',
        vesselVoyage: 'COSCO HONG KONG V.001E',
        portCode: 'CNSHA',
        portName: '上海港',
        storageAgentCode: 'SA001',
        storageAgentName: '上海XX仓储有限公司',
        customerCode: 'CUST001',
        customerName: 'XX国际贸易有限公司',
        entryDate: '2024-05-01',
        detentionDays: 14,
        freeDays: 7,
        billableDays: 7,
        currency: 'CNY',
        dailyRate: 200,
        totalAmount: 1400,
        detentionReasons: [DetentionReason.CUSTOMS_INSPECTION, DetentionReason.CUSTOMER_DELAY],
        reasonDescription: '海关查验+客户清关延误共同导致滞箱',
        isCustomsInspection: true,
        isCustomerDelay: true,
        manualRemark: '费用明细已核对，海关查验5天+客户延迟2天，合计7天计费，明细一致无误'
      };

      const result = importService.import({
        records: [recordData],
        operatorId: 'OP001',
        operatorName: '张三'
      });

      expect(result.success).toBe(true);
      expect(result.successCount).toBe(1);
      expect(result.results[0].record?.manualRemark).toContain('费用明细已核对');
      expect(result.results[0].record?.requiresManualRemark).toBe(false);
    });

    it('应该支持后续通过人工审核接口提交备注继续推进', () => {
      const recordData = {
        billOfLadingNo: 'COSCOSH202405008',
        containerNo: 'CNTR0012351',
        vesselVoyage: 'COSCO HONG KONG V.001E',
        portCode: 'CNSHA',
        portName: '上海港',
        storageAgentCode: 'SA001',
        storageAgentName: '上海XX仓储有限公司',
        customerCode: 'CUST001',
        customerName: 'XX国际贸易有限公司',
        entryDate: '2024-05-01',
        detentionDays: 10,
        freeDays: 7,
        billableDays: 3,
        currency: 'CNY',
        dailyRate: 200,
        totalAmount: 600,
        detentionReasons: [DetentionReason.CUSTOMS_INSPECTION, DetentionReason.CUSTOMER_DELAY],
        isCustomsInspection: true,
        isCustomerDelay: true
      };

      storageService.save({
        ...recordData,
        status: DetentionFeeStatus.IMPORTED,
        requiresManualRemark: true
      } as any);

      const reviewResult = reviewService.submitManualReview({
        billOfLadingNo: 'COSCOSH202405008',
        containerNo: 'CNTR0012351',
        portCode: 'CNSHA',
        manualRemark: '海关查验2天+客户延迟1天，费用分摊已确认，明细一致',
        operatorId: 'OP002',
        operatorName: '李四'
      });

      expect(reviewResult.success).toBe(true);
      expect(reviewResult.message).toContain('已进入待审核状态');
      expect(reviewResult.record?.status).toBe(DetentionFeeStatus.PENDING_REVIEW);
      expect(reviewResult.record?.manualRemark).toBe('海关查验2天+客户延迟1天，费用分摊已确认，明细一致');
    });
  });

  describe('坏数据格式测试', () => {
    it('应该拒绝无效数字字段值的记录', () => {
      const result = importService.import({
        records: [
          {
            billOfLadingNo: 'COSCOSH202405009',
            containerNo: 'CNTR0012352',
            vesselVoyage: 'COSCO HONG KONG V.001E',
            portCode: 'CNSHA',
            portName: '上海港',
            storageAgentCode: 'SA001',
            storageAgentName: '上海XX仓储有限公司',
            customerCode: 'CUST001',
            customerName: 'XX国际贸易有限公司',
            entryDate: '2024-05-01',
            detentionDays: -5,
            freeDays: '七天',
            billableDays: 2,
            currency: 'CNY',
            dailyRate: -200,
            totalAmount: 400,
            detentionReasons: [DetentionReason.CUSTOMER_DELAY]
          }
        ],
        operatorId: 'OP001',
        operatorName: '张三'
      });

      expect(result.success).toBe(false);
      expect(result.results[0].errorCode).toBe('INVALID_FIELD_VALUES');
      expect(result.results[0].errorMessage).toContain('detentionDays');
      expect(result.results[0].suggestion).toContain('检查数字字段');
    });
  });

  describe('混合场景测试', () => {
    it('应该正确处理包含成功、失败、需人工审核的混合导入', () => {
      const result = importService.import({
        records: [
          {
            billOfLadingNo: 'COSCOSH202405010',
            containerNo: 'CNTR0012353',
            vesselVoyage: 'COSCO HONG KONG V.001E',
            portCode: 'CNSHA',
            portName: '上海港',
            storageAgentCode: 'SA001',
            storageAgentName: '上海XX仓储有限公司',
            customerCode: 'CUST001',
            customerName: 'XX国际贸易有限公司',
            entryDate: '2024-05-01',
            detentionDays: 5,
            freeDays: 3,
            billableDays: 2,
            currency: 'CNY',
            dailyRate: 200,
            totalAmount: 400,
            detentionReasons: [DetentionReason.CUSTOMER_DELAY]
          },
          {
            billOfLadingNo: 'COSCOSH202405011',
            containerNo: 'CNTR0012354'
          },
          {
            billOfLadingNo: 'COSCOSH202405012',
            containerNo: 'CNTR0012355',
            vesselVoyage: 'COSCO HONG KONG V.001E',
            portCode: 'CNSHA',
            portName: '上海港',
            storageAgentCode: 'SA001',
            storageAgentName: '上海XX仓储有限公司',
            customerCode: 'CUST001',
            customerName: 'XX国际贸易有限公司',
            entryDate: '2024-05-01',
            detentionDays: 10,
            freeDays: 7,
            billableDays: 3,
            currency: 'CNY',
            dailyRate: 200,
            totalAmount: 600,
            detentionReasons: [DetentionReason.CUSTOMS_INSPECTION, DetentionReason.CUSTOMER_DELAY],
            isCustomsInspection: true,
            isCustomerDelay: true
          }
        ],
        operatorId: 'OP001',
        operatorName: '张三'
      });

      expect(result.totalCount).toBe(3);
      expect(result.successCount).toBe(1);
      expect(result.failedCount).toBe(2);
      expect(result.requiresManualReviewCount).toBe(1);
      expect(result.results[0].success).toBe(true);
      expect(result.results[1].errorCode).toBe('MISSING_FIELDS');
      expect(result.results[2].errorCode).toBe('JOINT_REASON_REQUIRES_REMARK');
    });
  });
});
