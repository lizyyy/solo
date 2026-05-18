#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const path = __importStar(require("path"));
const csv_handler_1 = require("./csv-handler");
const impact_analyzer_1 = require("./impact-analyzer");
const program = new commander_1.Command();
program
    .name('coupon-impact')
    .description('优惠券发放包主播撤券影响分析工具 - 统计撤券影响用户及损失金额')
    .version('1.0.0')
    .option('-b, --batches <path>', '券批次CSV文件路径')
    .option('-r, --records <path>', '领取记录CSV文件路径')
    .option('-o, --orders <path>', '订单明细CSV文件路径')
    .option('-O, --output <path>', '输出结果CSV文件路径', 'coupon-withdrawal-impact.csv')
    .option('-s, --stats <path>', '统计报告输出路径', 'coupon-withdrawal-impact-statistics.txt');
program.addHelpText('before', `
╔══════════════════════════════════════════════════════════════╗
║            优惠券发放包主播撤券影响分析工具 v1.0             ║
╠══════════════════════════════════════════════════════════════╣
║  功能：读取券批次、领取记录、订单明细，生成撤券影响分析表    ║
║  业务规则：按使用状态和退款情况统计撤券影响用户及损失金额    ║
╚══════════════════════════════════════════════════════════════╝
`);
program.addHelpText('after', `
使用示例:
  $ coupon-impact --batches batches.csv --records records.csv --orders orders.csv
  $ coupon-impact -b batches.csv -r records.csv -o orders.csv -O result.csv
  $ npm run test:normal
  $ npm run test:abnormal

输出字段说明:
  批次ID/批次名称    - 撤券的优惠券批次信息
  主播ID/主播名称    - 关联的主播信息
  用户ID/用户名称    - 受影响的用户信息
  券码               - 优惠券唯一编码
  领取时间/过期时间  - 优惠券时间信息
  使用状态           - UNUSED(未使用)/USED(已使用)/EXPIRED(已过期)/REFUNDED(已退款)
  订单ID/下单时间    - 关联订单信息
  订单金额/优惠金额  - 订单金额信息
  退款状态/退款金额  - 退款相关信息
  影响等级           - HIGH(高)/MEDIUM(中)/LOW(低)
  影响描述           - 详细影响说明
  损失金额           - 预估损失金额
`);
async function main() {
    program.parse(process.argv);
    const options = program.opts();
    if (!options.batches || !options.records || !options.orders) {
        console.error('❌ 错误: 必须提供 --batches, --records, --orders 参数');
        program.help();
        process.exit(1);
    }
    try {
        console.log('╔══════════════════════════════════════════════════════════════╗');
        console.log('║            优惠券发放包主播撤券影响分析工具                   ║');
        console.log('╚══════════════════════════════════════════════════════════════╝');
        console.log('');
        console.log('📂 正在读取数据文件...');
        console.log(`   - 券批次: ${options.batches}`);
        console.log(`   - 领取记录: ${options.records}`);
        console.log(`   - 订单明细: ${options.orders}`);
        console.log('');
        const batches = (0, csv_handler_1.readCouponBatches)(options.batches);
        const records = (0, csv_handler_1.readCouponRecords)(options.records);
        const orders = (0, csv_handler_1.readOrderDetails)(options.orders);
        console.log(`✅ 数据加载完成:`);
        console.log(`   - 券批次: ${batches.length} 条`);
        console.log(`   - 领取记录: ${records.length} 条`);
        console.log(`   - 订单明细: ${orders.length} 条`);
        console.log('');
        console.log('🔍 正在分析撤券影响...');
        const { impacts, statistics } = (0, impact_analyzer_1.analyzeWithdrawalImpact)(batches, records, orders);
        console.log('');
        console.log('📊 撤券影响分析结果:');
        console.log('   ──────────────────────────────────');
        console.log(`   受影响用户数: ${statistics.totalAffectedUsers}`);
        console.log(`   受影响券数:   ${statistics.totalAffectedCoupons}`);
        console.log(`   总损失金额:   ¥${statistics.totalLossAmount.toFixed(2)}`);
        console.log('');
        console.log('   按影响等级分布:');
        console.log(`     HIGH(高影响):   ${statistics.byImpactLevel.HIGH}`);
        console.log(`     MEDIUM(中影响): ${statistics.byImpactLevel.MEDIUM}`);
        console.log(`     LOW(低影响):    ${statistics.byImpactLevel.LOW}`);
        console.log('');
        console.log('   按使用状态分布:');
        Object.entries(statistics.byUseStatus).forEach(([k, v]) => {
            console.log(`     ${k}: ${v}`);
        });
        console.log('');
        console.log('💾 正在输出结果...');
        const outputPath = path.resolve(options.output);
        const statsPath = path.resolve(options.stats);
        (0, csv_handler_1.writeImpactResult)(outputPath, impacts);
        (0, csv_handler_1.writeStatistics)(statsPath, statistics);
        console.log(`   - 详细影响表: ${outputPath}`);
        console.log(`   - 统计报告:   ${statsPath}`);
        console.log('');
        console.log('╔══════════════════════════════════════════════════════════════╗');
        console.log('║                    ✅ 分析完成                                ║');
        console.log('╚══════════════════════════════════════════════════════════════╝');
    }
    catch (error) {
        console.error('❌ 分析过程出错:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}
main();
