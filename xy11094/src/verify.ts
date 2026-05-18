import { importService } from './services/import.service';
import { storageService } from './services/storage.service';
import { reviewService } from './services/review.service';
import { DetentionFeeStatus, DetentionReason } from './types/detention-fee';

console.log('========================================');
console.log('口岸仓储代理口岸滞箱费用 API 验证测试');
console.log('========================================\n');

function runTests() {
  let passed = 0;
  let failed = 0;

  function test(name: string, fn: () => boolean) {
    storageService.clear();
    try {
      const result = fn();
      if (result) {
        console.log(`✓ ${name}`);
        passed++;
      } else {
        console.log(`✗ ${name}`);
        failed++;
      }
    } catch (e) {
      console.log(`✗ ${name}: ${(e as Error).message}`);
      failed++;
    }
  }

  console.log('1. 正常导入测试\n');

  test('成功导入完整的滞箱费用记录', () => {
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
    return result.success && result.successCount === 1;
  });

  console.log('\n2. 缺字段验证测试\n');

  test('拒绝缺少必填字段的记录并返回建议', () => {
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
    return !result.success && 
           result.results[0].errorCode === 'MISSING_FIELDS' &&
           result.results[0].suggestion === '请补充完整必填字段后重新提交' &&
           result.results[0].originalData?.billOfLadingNo === 'COSCOSH202405002';
  });

  console.log('\n3. 重复提交检测测试\n');

  test('拒绝重复导入相同提单号+箱号+口岸的记录', () => {
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

    importService.import({ records: [recordData], operatorId: 'OP001', operatorName: '张三' });
    const secondResult = importService.import({ records: [recordData], operatorId: 'OP001', operatorName: '张三' });

    return !secondResult.success && 
           secondResult.results[0].errorCode === 'DUPLICATE_RECORD' &&
           secondResult.results[0].originalData?.containerNo === 'CNTR0012346';
  });

  console.log('\n4. 状态越级校验测试\n');

  test('拒绝从已导入直接跳转到已开票的越级状态', () => {
    const result = importService.import({
      records: [
        {
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
        }
      ],
      operatorId: 'OP001',
      operatorName: '张三'
    });

    return !result.success && 
           result.results[0].errorCode === 'STATUS_TRANSITION_INVALID';
  });

  console.log('\n5. 海关查验+客户延迟共同原因测试\n');

  test('识别双重原因并要求人工备注', () => {
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
          detentionDays: 14,
          freeDays: 7,
          billableDays: 7,
          currency: 'CNY',
          dailyRate: 200,
          totalAmount: 1400,
          detentionReasons: [DetentionReason.CUSTOMS_INSPECTION, DetentionReason.CUSTOMER_DELAY],
          isCustomsInspection: true,
          isCustomerDelay: true
        }
      ],
      operatorId: 'OP001',
      operatorName: '张三'
    });

    return !result.success && 
           result.requiresManualReviewCount === 1 &&
           result.results[0].errorCode === 'JOINT_REASON_REQUIRES_REMARK';
  });

  test('添加人工备注后可以正常推进', () => {
    const result = importService.import({
      records: [
        {
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
          isCustomsInspection: true,
          isCustomerDelay: true,
          manualRemark: '费用明细已核对，海关查验5天+客户延迟2天'
        }
      ],
      operatorId: 'OP001',
      operatorName: '张三'
    });

    return result.success && result.successCount === 1;
  });

  test('支持后续通过人工审核接口提交备注继续推进', () => {
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
      isCustomerDelay: true,
      status: DetentionFeeStatus.IMPORTED,
      requiresManualRemark: true
    };

    storageService.save(recordData as any);

    const reviewResult = reviewService.submitManualReview({
      billOfLadingNo: 'COSCOSH202405008',
      containerNo: 'CNTR0012351',
      portCode: 'CNSHA',
      manualRemark: '海关查验2天+客户延迟1天，费用分摊已确认',
      operatorId: 'OP002',
      operatorName: '李四'
    });

    return reviewResult.success && reviewResult.record?.status === DetentionFeeStatus.PENDING_REVIEW;
  });

  console.log('\n6. 坏数据格式测试\n');

  test('拒绝无效数字字段值的记录', () => {
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
          freeDays: 7,
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

    return !result.success && result.results[0].errorCode === 'INVALID_FIELD_VALUES';
  });

  console.log('\n7. 混合场景测试\n');

  test('正确处理包含成功、失败、需人工审核的混合导入', () => {
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

    return result.totalCount === 3 &&
           result.successCount === 1 &&
           result.failedCount === 2 &&
           result.requiresManualReviewCount === 1;
  });

  console.log('\n========================================');
  console.log(`测试结果: ${passed} 通过, ${failed} 失败`);
  console.log('========================================');

  return failed === 0;
}

const allPassed = runTests();
process.exit(allPassed ? 0 : 1);
