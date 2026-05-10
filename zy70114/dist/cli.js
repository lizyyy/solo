#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = require("./database");
const workflowService_1 = require("./services/workflowService");
const orderService_1 = require("./services/orderService");
const compensationService_1 = require("./services/compensationService");
const appealService_1 = require("./services/appealService");
const liabilityService_1 = require("./services/liabilityService");
const reportService_1 = require("./services/reportService");
const response_1 = require("./utils/response");
const args = process.argv.slice(2);
const command = args[0];
const printHelp = () => {
    console.log(`
外卖出餐超时补偿服务 - CLI 工具

用法:
  npm run dev:cli <命令> [参数]

可用命令:
  create-order --order-no <订单号> --merchant-id <商家ID> --merchant-name <商家名> 
               --user-id <用户ID> --user-name <用户名> --amount <金额> 
               --meal-minutes <预期出餐分钟数> --idempotent-key <幂等键>
  accept <订单ID>
  cooking <订单ID>
  meal-ready <订单ID>
  pickup <订单ID>
  deliver <订单ID>
  assign-rider <订单ID> <骑手ID> <骑手姓名>
  order-info <订单ID>
  order-info-by-no <订单号>
  process-overtime <订单ID>
  judge-liability <订单ID> <责任方> <判定原因>
  compensations <订单ID>
  approve-compensation <补偿ID>
  reject-compensation <补偿ID> <拒绝原因>
  execute-compensation <补偿ID>
  create-appeal <订单ID> <补偿ID> <申诉方> <申诉人ID> <申诉原因>
  start-review <申诉ID>
  review-appeal <申诉ID> <是否通过:true/false> <审核结果>
  rollback <补偿ID> <回滚原因>
  report <周期:day|week|month>

责任方可选值: merchant, rider, platform, user, unknown

示例:
  npm run dev:cli create-order --order-no ORDER001 --merchant-id M001 --merchant-name "美味汉堡店" --user-id U001 --user-name "张三" --amount 45.5 --meal-minutes 20 --idempotent-key KEY001
  npm run dev:cli accept <订单ID>
  npm run dev:cli meal-ready <订单ID>
  npm run dev:cli process-overtime <订单ID>
  npm run dev:cli report day
`);
};
const parseArgs = (args) => {
    const result = {};
    for (let i = 0; i < args.length; i++) {
        if (args[i].startsWith('--')) {
            const key = args[i].slice(2);
            const value = args[i + 1];
            if (value && !value.startsWith('--')) {
                result[key] = value;
                i++;
            }
            else {
                result[key] = 'true';
            }
        }
    }
    return result;
};
const runCommand = async () => {
    try {
        await (0, database_1.initDb)();
        switch (command) {
            case 'create-order': {
                const params = parseArgs(args.slice(1));
                const result = (0, workflowService_1.processCreateOrder)({
                    idempotentKey: params['idempotent-key'],
                    orderNo: params['order-no'],
                    merchantId: params['merchant-id'],
                    merchantName: params['merchant-name'],
                    userId: params['user-id'],
                    userName: params['user-name'],
                    orderAmount: parseFloat(params['amount']),
                    expectedMealMinutes: parseInt(params['meal-minutes']),
                    operatorId: params['operator-id'] || 'cli',
                    operatorRole: params['operator-role'] || 'platform',
                });
                console.log(`\n✅ ${result.business_message}`);
                console.log(`   订单ID: ${result.order_id}`);
                console.log(`   订单号: ${result.order_no}`);
                if (result.is_idempotent) {
                    console.log(`   ⚠️  此为幂等返回，重复请求不会重复创建`);
                }
                break;
            }
            case 'accept': {
                const orderId = args[1];
                const result = (0, workflowService_1.processMerchantAccept)(orderId, 'cli', 'merchant');
                console.log(`\n✅ ${result.business_message}`);
                break;
            }
            case 'cooking': {
                const orderId = args[1];
                const result = (0, workflowService_1.processStartCooking)(orderId, 'cli', 'merchant');
                console.log(`\n✅ ${result.business_message}`);
                break;
            }
            case 'meal-ready': {
                const orderId = args[1];
                const result = (0, workflowService_1.processMealReady)(orderId, 'cli', 'merchant');
                console.log(`\n✅ ${result.business_message}`);
                if (result.is_overtime) {
                    console.log(`   ⚠️  超时: ${result.overtime_minutes} 分钟`);
                    console.log(`   预计: ${result.expected_minutes} 分钟，实际: ${result.actual_minutes?.toFixed(1)} 分钟`);
                }
                break;
            }
            case 'pickup': {
                const orderId = args[1];
                const result = (0, workflowService_1.processRiderPickup)(orderId, 'cli', 'rider');
                console.log(`\n✅ ${result.business_message}`);
                break;
            }
            case 'deliver': {
                const orderId = args[1];
                const result = (0, workflowService_1.processDeliver)(orderId, 'cli', 'rider');
                console.log(`\n✅ ${result.business_message}`);
                break;
            }
            case 'assign-rider': {
                const orderId = args[1];
                const riderId = args[2];
                const riderName = args[3];
                const result = (0, workflowService_1.processAssignRider)(orderId, riderId, riderName, 'cli', 'platform');
                console.log(`\n✅ ${result.business_message}`);
                break;
            }
            case 'order-info': {
                const orderId = args[1];
                const info = (0, workflowService_1.getOrderFullInfo)(orderId);
                console.log((0, workflowService_1.formatOrderInfo)(info));
                break;
            }
            case 'order-info-by-no': {
                const orderNo = args[1];
                const order = (0, orderService_1.getOrderByNo)(orderNo);
                const info = (0, workflowService_1.getOrderFullInfo)(order.id);
                console.log((0, workflowService_1.formatOrderInfo)(info));
                break;
            }
            case 'process-overtime': {
                const orderId = args[1];
                const result = (0, workflowService_1.processOvertimeWorkflow)(orderId, 'cli', 'platform');
                console.log(`\n✅ ${result.business_message}`);
                console.log(`   责任方: ${result.liability.liable_party_name}`);
                console.log(`   原因: ${result.liability.reason}`);
                console.log(`\n   补偿记录:`);
                result.compensations.forEach((c, i) => {
                    console.log(`   ${i + 1}. ${c.type} -> ${c.target}: ¥${c.amount.toFixed(2)}`);
                });
                break;
            }
            case 'judge-liability': {
                const orderId = args[1];
                const liableParty = args[2];
                const reason = args.slice(3).join(' ');
                const result = (0, liabilityService_1.manualJudgeLiability)(orderId, liableParty, reason, null, 'cli', 'platform');
                console.log(`\n✅ 责任判定成功`);
                console.log(`   责任方: ${liableParty}`);
                console.log(`   原因: ${reason}`);
                break;
            }
            case 'compensations': {
                const orderId = args[1];
                const comps = (0, compensationService_1.getCompensations)(orderId);
                console.log(`\n📋 补偿记录 (共 ${comps.length} 条):`);
                comps.forEach((c, i) => {
                    const target = c.target_party === 'user' ? '用户' : c.target_party === 'rider' ? '骑手' : '商家';
                    console.log(`   ${i + 1}. ${c.id}`);
                    console.log(`      类型: ${c.compensation_type}`);
                    console.log(`      目标: ${target}`);
                    console.log(`      金额: ¥${c.amount.toFixed(2)}`);
                    console.log(`      状态: ${c.status}`);
                    console.log(`      备注: ${c.remark || '-'}`);
                });
                break;
            }
            case 'approve-compensation': {
                const compId = args[1];
                const result = (0, compensationService_1.approveCompensation)(compId, 'cli', 'platform');
                console.log(`\n✅ 补偿审批通过`);
                console.log(`   补偿ID: ${compId}`);
                break;
            }
            case 'reject-compensation': {
                const compId = args[1];
                const reason = args.slice(2).join(' ');
                const result = (0, compensationService_1.rejectCompensation)(compId, reason, 'cli', 'platform');
                console.log(`\n✅ 补偿已拒绝`);
                console.log(`   原因: ${reason}`);
                break;
            }
            case 'execute-compensation': {
                const compId = args[1];
                const result = (0, compensationService_1.executeCompensation)(compId, 'cli', 'platform');
                console.log(`\n✅ 补偿已执行`);
                console.log(`   补偿ID: ${compId}`);
                break;
            }
            case 'create-appeal': {
                const orderId = args[1];
                const compId = args[2];
                const appellantParty = args[3];
                const appellantId = args[4];
                const reason = args.slice(5).join(' ');
                const result = (0, appealService_1.createAppeal)(orderId, compId, appellantParty, appellantId, reason, null);
                console.log(`\n✅ 申诉提交成功`);
                console.log(`   申诉ID: ${result.id}`);
                console.log(`   申诉方: ${appellantParty}`);
                console.log(`   原因: ${reason}`);
                break;
            }
            case 'start-review': {
                const appealId = args[1];
                const result = (0, appealService_1.startReview)(appealId, 'cli', 'platform');
                console.log(`\n✅ 已开始审核申诉`);
                console.log(`   申诉ID: ${appealId}`);
                break;
            }
            case 'review-appeal': {
                const appealId = args[1];
                const approved = args[2] === 'true';
                const reviewResult = args.slice(3).join(' ');
                const result = (0, appealService_1.reviewAppeal)(appealId, 'cli', 'platform', approved, reviewResult);
                console.log(`\n✅ ${approved ? '申诉通过，补偿已回滚' : '申诉驳回'}`);
                console.log(`   审核结果: ${reviewResult}`);
                break;
            }
            case 'rollback': {
                const compId = args[1];
                const reason = args.slice(2).join(' ');
                (0, appealService_1.manualRollback)(compId, 'cli', 'platform', reason);
                console.log(`\n✅ 补偿已人工回滚`);
                console.log(`   原因: ${reason}`);
                break;
            }
            case 'report': {
                const period = args[1];
                const report = (0, reportService_1.generateReport)(period);
                console.log((0, reportService_1.formatReportForDisplay)(report));
                break;
            }
            case '--help':
            case '-h':
            case undefined:
                printHelp();
                break;
            default:
                console.log(`❌ 未知命令: ${command}`);
                printHelp();
                process.exit(1);
        }
    }
    catch (err) {
        if (err instanceof response_1.BusinessError) {
            console.log(`\n❌ 业务错误`);
            console.log(`   错误码: ${err.code}`);
            console.log(`   提示: ${err.businessMessage}`);
            process.exit(1);
        }
        else {
            console.error(`\n❌ 系统错误:`, err.message);
            console.error(err.stack);
            process.exit(1);
        }
    }
};
runCommand();
//# sourceMappingURL=cli.js.map