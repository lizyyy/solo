import { db } from '../store/database';
import { OrderType, DeductionType } from '../types';
import { DEDUCTION_ITEM_CODES, DEDUCTION_ITEM_NAMES, SUBMIT_SOURCES, ROLES } from '../config/constants';

console.log('========================================');
console.log('  初始化短租公寓押金扣项系统数据');
console.log('========================================\n');

db.clear();
console.log('✓ 已清空现有数据\n');

const today = new Date();
const checkInDate = new Date(today);
checkInDate.setDate(today.getDate() - 2);

const checkOutDate = new Date(today);
checkOutDate.setDate(today.getDate() + 1);

const normalOrder = db.addOrder({
  orderNo: db.generateOrderNo(),
  orderType: OrderType.NORMAL,
  guestName: '张三',
  guestPhone: '13800138001',
  roomNo: '806',
  roomType: '豪华大床房',
  checkInDate: checkInDate,
  checkOutDate: checkOutDate,
  depositAmount: 500,
  usedDepositAmount: 0,
  status: 'CHECKED_IN',
  createTime: new Date()
});
console.log('✓ 创建测试订单 1 (正常入住 - 张三 - 806房)');
console.log(`  订单号: ${normalOrder.orderNo}`);
console.log(`  押金: ¥${normalOrder.depositAmount}`);
console.log(`  已使用: ¥${normalOrder.usedDepositAmount}`);
console.log('');

const extendOrder = db.addOrder({
  orderNo: db.generateOrderNo(),
  orderType: OrderType.EXTEND,
  guestName: '李四',
  guestPhone: '13800138002',
  roomNo: '1208',
  roomType: '行政套房',
  checkInDate: checkInDate,
  checkOutDate: new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000),
  originalCheckOutDate: checkOutDate,
  parentOrderId: undefined,
  depositAmount: 1000,
  usedDepositAmount: 0,
  status: 'EXTENDED',
  createTime: new Date()
});
console.log('✓ 创建测试订单 2 (续住 - 李四 - 1208房)');
console.log(`  订单号: ${extendOrder.orderNo}`);
console.log(`  押金: ¥${extendOrder.depositAmount}`);
console.log(`  已使用: ¥${extendOrder.usedDepositAmount}`);
console.log('');

const orderForConflict = db.addOrder({
  orderNo: db.generateOrderNo(),
  orderType: OrderType.NORMAL,
  guestName: '王五',
  guestPhone: '13800138003',
  roomNo: '1503',
  roomType: '标准双床房',
  checkInDate: checkInDate,
  checkOutDate: checkOutDate,
  depositAmount: 300,
  usedDepositAmount: 250,
  status: 'CHECKED_IN',
  createTime: new Date()
});
console.log('✓ 创建测试订单 3 (冲突测试用 - 王五 - 1503房)');
console.log(`  订单号: ${orderForConflict.orderNo}`);
console.log(`  押金: ¥${orderForConflict.depositAmount}`);
console.log(`  已使用: ¥${orderForConflict.usedDepositAmount}`);
console.log('');

console.log('✓ 创建预置的押金扣项申请 (用于演示冲突)');
const conflictCheckoutDeduction = db.addDeduction({
  deductionNo: db.generateDeductionNo(),
  orderId: extendOrder.id,
  orderNo: extendOrder.orderNo,
  guestName: extendOrder.guestName,
  guestPhone: extendOrder.guestPhone,
  roomNo: extendOrder.roomNo,
  deductionType: DeductionType.CHECK_OUT,
  status: 'SUBMITTED',
  totalDeductionAmount: 200,
  items: [
    {
      id: 'item-conflict-1',
      itemCode: DEDUCTION_ITEM_CODES.DEEP_CLEANING,
      itemName: DEDUCTION_ITEM_NAMES[DEDUCTION_ITEM_CODES.DEEP_CLEANING],
      quantity: 1,
      unitPrice: 200,
      totalAmount: 200,
      remark: '房间有异味需要深度清洁'
    }
  ],
  applicantId: 'frontdesk001',
  applicantName: '前台小王',
  submitSource: SUBMIT_SOURCES.FRONT_DESK_PC,
  applyTime: new Date(),
  remark: '客人退房时发现地毯有污渍'
});
console.log(`  扣项编号: ${conflictCheckoutDeduction.deductionNo}`);
console.log(`  类型: 退房扣项`);
console.log(`  状态: 已提交`);
console.log('');

db.addAuditLog({
  deductionId: conflictCheckoutDeduction.id,
  action: 'CREATE',
  fromStatus: undefined,
  toStatus: 'DRAFT',
  operatorId: 'frontdesk001',
  operatorName: '前台小王',
  submitSource: SUBMIT_SOURCES.FRONT_DESK_PC,
  remark: '创建押金扣项申请'
});

db.addAuditLog({
  deductionId: conflictCheckoutDeduction.id,
  action: 'SUBMIT',
  fromStatus: 'DRAFT',
  toStatus: 'SUBMITTED',
  operatorId: 'frontdesk001',
  operatorName: '前台小王',
  submitSource: SUBMIT_SOURCES.FRONT_DESK_PC,
  remark: '提交押金扣项申请'
});

console.log('========================================');
console.log('  系统角色配置');
console.log('========================================');
console.log('  FRONT_DESK  - 前台员工：可创建、提交、撤回申请');
console.log('  SUPERVISOR  - 主管：可审核、批准、驳回申请');
console.log('  MANAGER     - 经理：拥有所有权限');
console.log('  CASHIER     - 收银：可执行扣款操作');
console.log('');

console.log('========================================');
console.log('  提交来源配置');
console.log('========================================');
console.log('  FRONT_DESK_PC  - 前台电脑');
console.log('  MOBILE_APP     - 移动应用');
console.log('  WECHAT_MINIAPP - 微信小程序');
console.log('  BACKOFFICE     - 后台管理系统');
console.log('');

console.log('========================================');
console.log('  扣项类型配置');
console.log('========================================');
console.log('  CHECK_OUT   - 退房扣项');
console.log('  EXTEND_STAY - 续住押金补扣');
console.log('  DAMAGE      - 物品损坏赔偿');
console.log('  CLEANING    - 清洁费用');
console.log('  OTHER       - 其他费用');
console.log('');

console.log('========================================');
console.log('  状态流转说明');
console.log('========================================');
console.log('  DRAFT -> SUBMITTED    提交申请');
console.log('  DRAFT -> CANCELLED    取消草稿');
console.log('  SUBMITTED -> REVIEWING  开始审核');
console.log('  SUBMITTED -> CANCELLED  撤回申请');
console.log('  REVIEWING -> APPROVED   审核通过');
console.log('  REVIEWING -> REJECTED   审核驳回');
console.log('  REJECTED -> DRAFT       修改后重提');
console.log('  APPROVED -> EXECUTED    执行扣款');
console.log('  APPROVED -> CANCELLED   取消审批');
console.log('');

console.log('========================================');
console.log('  初始化完成！');
console.log('========================================');
console.log('');
console.log('测试场景说明：');
console.log('1. 正常流程：使用订单 1 (张三 806房) 完整走一遍流程');
console.log('   - 创建草稿 → 提交 → 审核 → 执行扣款');
console.log('');
console.log('2. 冲突场景：使用订单 2 (李四 1208房) 测试续住/退房冲突');
console.log('   - 该订单已有退房扣项申请，再次提交续住扣项会触发冲突检测');
console.log('');
console.log('3. 押金不足：使用订单 3 (王五 1503房) 测试金额校验');
console.log('   - 押金剩余 ¥50，提交超过 ¥50 的扣款会触发冲突');
console.log('');
console.log('运行 npm run dev 启动服务');
console.log('运行 npm run test:normal 测试正常流程');
console.log('运行 npm run test:conflict 测试冲突场景');
console.log('');