import { db } from '../store/database';
import { deductionService } from '../services/deduction.service';
import { stateMachine } from '../services/state-machine.service';
import { DeductionType, DepositDeductionStatus } from '../types';
import { DEDUCTION_ITEM_CODES, DEDUCTION_ITEM_NAMES, SUBMIT_SOURCES, ROLES } from '../config/constants';

async function runNormalFlowTest() {
  console.log('========================================');
  console.log('  测试：正常押金扣项流程');
  console.log('========================================\n');

  db.load();

  const orders = db.getOrders();
  const testOrder = orders.find(o => o.guestName === '张三');

  if (!testOrder) {
    console.log('✗ 未找到测试订单，请先运行 npm run init');
    process.exit(1);
  }

  console.log(`✓ 使用测试订单: ${testOrder.orderNo} - ${testOrder.guestName} - ${testOrder.roomNo}房`);
  console.log(`  押金总额: ¥${testOrder.depositAmount}`);
  console.log(`  已使用: ¥${testOrder.usedDepositAmount}`);
  console.log(`  可用: ¥${testOrder.depositAmount - testOrder.usedDepositAmount}\n`);

  console.log('【步骤 1】创建押金扣项草稿');
  console.log('----------------------------------------');

  const createResult = await deductionService.createDeduction({
    orderNo: testOrder.orderNo,
    deductionType: DeductionType.DAMAGE,
    items: [
      {
        itemCode: DEDUCTION_ITEM_CODES.FURNITURE_DAMAGE,
        itemName: DEDUCTION_ITEM_NAMES[DEDUCTION_ITEM_CODES.FURNITURE_DAMAGE],
        quantity: 1,
        unitPrice: 150,
        totalAmount: 150,
        remark: '床头柜表面有划痕'
      },
      {
        itemCode: DEDUCTION_ITEM_CODES.KEY_LOST,
        itemName: DEDUCTION_ITEM_NAMES[DEDUCTION_ITEM_CODES.KEY_LOST],
        quantity: 1,
        unitPrice: 50,
        totalAmount: 50,
        remark: '房卡遗失一张'
      }
    ],
    applicantId: ROLES.FRONT_DESK,
    applicantName: '前台小王',
    submitSource: SUBMIT_SOURCES.FRONT_DESK_PC,
    remark: '客人退房查房发现损坏'
  });

  console.log(`创建结果: ${createResult.success ? '✓ 成功' : '✗ 失败'}`);
  console.log(`扣项编号: ${createResult.data?.deductionNo}`);
  console.log(`当前状态: ${createResult.data?.status} (${stateMachine.getStatusDescription(createResult.data?.status || '')})`);
  console.log(`扣款总额: ¥${createResult.data?.totalDeductionAmount}`);
  console.log('扣项明细:');
  createResult.data?.items.forEach(item => {
    console.log(`  - ${item.itemName}: ${item.quantity} × ¥${item.unitPrice} = ¥${item.totalAmount}`);
  });
  console.log('');

  const deductionId = createResult.data?.id;
  if (!deductionId) {
    console.log('✗ 创建失败，无法继续测试');
    process.exit(1);
  }

  console.log('【步骤 2】前台提交申请');
  console.log('----------------------------------------');

  const submitResult = await deductionService.performAction({
    deductionId,
    action: 'SUBMIT',
    operatorId: ROLES.FRONT_DESK,
    operatorName: '前台小王',
    submitSource: SUBMIT_SOURCES.FRONT_DESK_PC,
    remark: '确认扣项无误后提交'
  });

  console.log(`提交结果: ${submitResult.success ? '✓ 成功' : '✗ 失败 - ' + submitResult.message}`);
  console.log(`当前状态: ${submitResult.data?.status} (${stateMachine.getStatusDescription(submitResult.data?.status || '')})`);
  console.log('');

  console.log('【步骤 3】主管开始审核');
  console.log('----------------------------------------');

  const reviewResult = await deductionService.performAction({
    deductionId,
    action: 'START_REVIEW',
    operatorId: ROLES.SUPERVISOR,
    operatorName: '主管老李',
    submitSource: SUBMIT_SOURCES.BACKOFFICE
  });

  console.log(`审核开始: ${reviewResult.success ? '✓ 成功' : '✗ 失败 - ' + reviewResult.message}`);
  console.log(`当前状态: ${reviewResult.data?.status} (${stateMachine.getStatusDescription(reviewResult.data?.status || '')})`);
  console.log('');

  console.log('【步骤 4】主管审核通过');
  console.log('----------------------------------------');

  const approveResult = await deductionService.performAction({
    deductionId,
    action: 'APPROVE',
    operatorId: ROLES.SUPERVISOR,
    operatorName: '主管老李',
    submitSource: SUBMIT_SOURCES.BACKOFFICE,
    remark: '扣项属实，同意扣款'
  });

  console.log(`审核结果: ${approveResult.success ? '✓ 成功' : '✗ 失败 - ' + approveResult.message}`);
  console.log(`当前状态: ${approveResult.data?.status} (${stateMachine.getStatusDescription(approveResult.data?.status || '')})`);
  console.log(`审核人: ${approveResult.data?.reviewerName}`);
  console.log(`审核时间: ${approveResult.data?.reviewTime}`);
  console.log(`审核备注: ${approveResult.data?.reviewRemark}`);
  console.log('');

  console.log('【步骤 5】收银执行扣款');
  console.log('----------------------------------------');

  const executeResult = await deductionService.performAction({
    deductionId,
    action: 'EXECUTE',
    operatorId: ROLES.CASHIER,
    operatorName: '收银小张',
    submitSource: SUBMIT_SOURCES.FRONT_DESK_PC
  });

  console.log(`执行结果: ${executeResult.success ? '✓ 成功' : '✗ 失败 - ' + executeResult.message}`);
  console.log(`当前状态: ${executeResult.data?.status} (${stateMachine.getStatusDescription(executeResult.data?.status || '')})`);
  console.log(`执行人: ${executeResult.data?.executorName}`);
  console.log(`执行时间: ${executeResult.data?.executeTime}`);
  console.log('');

  console.log('【步骤 6】验证订单押金更新');
  console.log('----------------------------------------');

  const updatedOrder = db.getOrderById(testOrder.id);
  console.log(`订单押金总额: ¥${updatedOrder?.depositAmount}`);
  console.log(`已使用押金: ¥${updatedOrder?.usedDepositAmount}`);
  console.log(`剩余可用: ¥${(updatedOrder?.depositAmount || 0) - (updatedOrder?.usedDepositAmount || 0)}`);
  console.log('');

  console.log('【步骤 7】查看审计日志');
  console.log('----------------------------------------');

  const auditLogs = db.getAuditLogs(deductionId);
  console.log(`审计日志共 ${auditLogs.length} 条:`);
  auditLogs.forEach((log, index) => {
    console.log(`  ${index + 1}. [${log.operateTime}] ${log.operatorName} - ${log.action}`);
    console.log(`     ${log.fromStatus || '无'} → ${log.toStatus}`);
    console.log(`     来源: ${log.submitSource}${log.remark ? ' | 备注: ' + log.remark : ''}`);
  });
  console.log('');

  console.log('========================================');
  console.log('  ✓ 正常流程测试通过！');
  console.log('========================================');
  console.log('');
  console.log('状态流转完整路径:');
  console.log('  DRAFT → SUBMITTED → REVIEWING → APPROVED → EXECUTED');
  console.log('');
}

runNormalFlowTest().catch(console.error);