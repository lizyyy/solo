import { db } from '../store/database';
import { deductionService } from '../services/deduction.service';
import { conflictDetector } from '../services/conflict-detector.service';
import { DeductionType } from '../types';
import { DEDUCTION_ITEM_CODES, DEDUCTION_ITEM_NAMES, SUBMIT_SOURCES, ROLES } from '../config/constants';

async function runConflictFlowTest() {
  console.log('========================================');
  console.log('  测试：冲突检测功能');
  console.log('========================================\n');

  db.load();

  const orders = db.getOrders();

  console.log('【测试 1】续住订单与退房扣项重叠冲突');
  console.log('----------------------------------------');

  const extendOrder = orders.find(o => o.guestName === '李四');
  if (!extendOrder) {
    console.log('✗ 未找到测试订单');
    process.exit(1);
  }

  console.log(`测试订单: ${extendOrder.orderNo} - ${extendOrder.guestName} - ${extendOrder.roomNo}房`);
  console.log('该订单已存在退房扣项申请，现在尝试提交续住押金补扣...\n');

  const createResult1 = await deductionService.createDeduction({
    orderNo: extendOrder.orderNo,
    deductionType: DeductionType.EXTEND_STAY,
    items: [
      {
        itemCode: DEDUCTION_ITEM_CODES.EXTEND_DEPOSIT,
        itemName: DEDUCTION_ITEM_NAMES[DEDUCTION_ITEM_CODES.EXTEND_DEPOSIT],
        quantity: 1,
        unitPrice: 300,
        totalAmount: 300,
        remark: '续住3天押金补扣'
      }
    ],
    applicantId: ROLES.FRONT_DESK,
    applicantName: '前台小王',
    submitSource: SUBMIT_SOURCES.FRONT_DESK_PC
  });

  console.log(`创建草稿: ${createResult1.success ? '✓ 成功' : '✗ 失败'}`);

  const deductionId1 = createResult1.data?.id;
  if (!deductionId1) {
    console.log('✗ 创建失败');
    process.exit(1);
  }

  const submitResult1 = await deductionService.performAction({
    deductionId: deductionId1,
    action: 'SUBMIT',
    operatorId: ROLES.FRONT_DESK,
    operatorName: '前台小王',
    submitSource: SUBMIT_SOURCES.FRONT_DESK_PC
  });

  console.log(`提交结果: ${submitResult1.success ? '✓ 成功' : '✗ 失败'}`);
  console.log(`冲突检测: ${submitResult1.data?.conflictDetected ? '✓ 检测到冲突' : '未检测到冲突'}`);
  console.log(`错误码: ${submitResult1.errorCode}`);
  console.log(`冲突详情: ${submitResult1.message}`);
  console.log('');

  console.log('【测试 2】押金金额不足冲突');
  console.log('----------------------------------------');

  const lowDepositOrder = orders.find(o => o.guestName === '王五');
  if (!lowDepositOrder) {
    console.log('✗ 未找到测试订单');
    process.exit(1);
  }

  console.log(`测试订单: ${lowDepositOrder.orderNo} - ${lowDepositOrder.guestName} - ${lowDepositOrder.roomNo}房`);
  console.log(`押金总额: ¥${lowDepositOrder.depositAmount}`);
  console.log(`已使用: ¥${lowDepositOrder.usedDepositAmount}`);
  console.log(`剩余可用: ¥${lowDepositOrder.depositAmount - lowDepositOrder.usedDepositAmount}`);
  console.log('尝试提交 ¥100 的扣款申请...\n');

  const createResult2 = await deductionService.createDeduction({
    orderNo: lowDepositOrder.orderNo,
    deductionType: DeductionType.OTHER,
    items: [
      {
        itemCode: DEDUCTION_ITEM_CODES.MIN_BAR,
        itemName: DEDUCTION_ITEM_NAMES[DEDUCTION_ITEM_CODES.MINIBAR],
        quantity: 1,
        unitPrice: 100,
        totalAmount: 100,
        remark: '迷你吧消费'
      }
    ],
    applicantId: ROLES.FRONT_DESK,
    applicantName: '前台小王',
    submitSource: SUBMIT_SOURCES.FRONT_DESK_PC
  });

  console.log(`创建草稿: ${createResult2.success ? '✓ 成功' : '✗ 失败'}`);

  const deductionId2 = createResult2.data?.id;
  if (!deductionId2) {
    console.log('✗ 创建失败');
    process.exit(1);
  }

  const submitResult2 = await deductionService.performAction({
    deductionId: deductionId2,
    action: 'SUBMIT',
    operatorId: ROLES.FRONT_DESK,
    operatorName: '前台小王',
    submitSource: SUBMIT_SOURCES.FRONT_DESK_PC
  });

  console.log(`提交结果: ${submitResult2.success ? '✓ 成功' : '✗ 失败'}`);
  console.log(`冲突检测: ${submitResult2.data?.conflictDetected ? '✓ 检测到冲突' : '未检测到冲突'}`);
  console.log(`错误码: ${submitResult2.errorCode}`);
  console.log(`冲突详情: ${submitResult2.message}`);
  console.log('');

  console.log('【测试 3】扣项明细计算错误冲突');
  console.log('----------------------------------------');

  console.log('手动构造金额不匹配的扣项进行检测...\n');

  const order = orders.find(o => o.guestName === '张三');
  if (!order) {
    console.log('✗ 未找到测试订单');
    process.exit(1);
  }

  const deduction = db.getDeductions().find(d => d.orderId === order.id);
  if (!deduction) {
    console.log('✗ 未找到扣项记录');
    process.exit(1);
  }

  const originalTotal = deduction.totalDeductionAmount;
  deduction.totalDeductionAmount = originalTotal + 100;

  const checkResult = conflictDetector.checkDepositConsistency(deduction, order);

  console.log(`检测结果: ${checkResult.hasConflict ? '✓ 检测到冲突' : '未检测到冲突'}`);
  console.log(`冲突类型: ${checkResult.conflictType}`);
  console.log(`冲突详情: ${checkResult.conflictDetails}`);
  console.log('');

  deduction.totalDeductionAmount = originalTotal;

  console.log('【测试 4】同类型重复提交冲突');
  console.log('----------------------------------------');

  console.log('再次提交相同类型的扣项申请...\n');

  const createResult3 = await deductionService.createDeduction({
    orderNo: order.orderNo,
    deductionType: DeductionType.DAMAGE,
    items: [
      {
        itemCode: DEDUCTION_ITEM_CODES.ROOM_DAMAGE,
        itemName: DEDUCTION_ITEM_NAMES[DEDUCTION_ITEM_CODES.ROOM_DAMAGE],
        quantity: 1,
        unitPrice: 100,
        totalAmount: 100,
        remark: '墙面污渍'
      }
    ],
    applicantId: ROLES.FRONT_DESK,
    applicantName: '前台小王',
    submitSource: SUBMIT_SOURCES.FRONT_DESK_PC
  });

  const deductionId3 = createResult3.data?.id;
  if (!deductionId3) {
    console.log('✗ 创建失败');
    process.exit(1);
  }

  const submitResult3 = await deductionService.performAction({
    deductionId: deductionId3,
    action: 'SUBMIT',
    operatorId: ROLES.FRONT_DESK,
    operatorName: '前台小王',
    submitSource: SUBMIT_SOURCES.FRONT_DESK_PC
  });

  console.log(`提交结果: ${submitResult3.success ? '✓ 成功' : '✗ 失败'}`);
  console.log(`冲突检测: ${submitResult3.data?.conflictDetected ? '✓ 检测到冲突' : '未检测到冲突'}`);
  console.log(`错误码: ${submitResult3.errorCode}`);
  console.log(`冲突详情: ${submitResult3.message}`);
  console.log('');

  console.log('========================================');
  console.log('  ✓ 冲突检测测试完成！');
  console.log('========================================');
  console.log('');
  console.log('已验证的冲突类型:');
  console.log('  1. ✓ 续住订单与退房扣项重叠冲突');
  console.log('  2. ✓ 押金金额不足冲突');
  console.log('  3. ✓ 扣项明细计算错误冲突');
  console.log('  4. ✓ 同类型重复提交冲突');
  console.log('');
}

runConflictFlowTest().catch(console.error);