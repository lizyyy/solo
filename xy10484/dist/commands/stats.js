"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerStatsCommand = registerStatsCommand;
const store_1 = require("../utils/store");
const analyzer_1 = require("../core/analyzer");
function registerStatsCommand(program) {
    program
        .command('stats')
        .description('查看数据统计')
        .action(() => {
        const store = (0, store_1.loadStore)();
        console.log('\n========================================');
        console.log('物流签收异常 CLI - 数据统计');
        console.log('========================================\n');
        console.log('【基础数据');
        console.log(`  订单数量: ${store.orders.length}`);
        console.log(`  签收记录: ${store.signRecords.length}`);
        console.log(`  拒收记录: ${store.refuseRecords.length}`);
        console.log(`  赔付记录: ${store.claimRecords.length}`);
        console.log('');
        const pendingAbnormals = store.abnormals.filter((a) => !a.reviewed).length;
        const reviewedAbnormals = store.abnormals.filter((a) => a.reviewed).length;
        console.log('【异常统计');
        console.log(`  异常总数: ${store.abnormals.length}`);
        console.log(`  待处理: ${pendingAbnormals}`);
        console.log(`  已复核: ${reviewedAbnormals}`);
        const abnormalByType = {};
        for (const abnormal of store.abnormals) {
            const label = analyzer_1.ABNORMAL_TYPE_LABELS[abnormal.type];
            abnormalByType[label] = (abnormalByType[label] || 0) + 1;
        }
        for (const [type, count] of Object.entries(abnormalByType)) {
            console.log(`    ${type}: ${count} 条`);
        }
        console.log('');
        console.log('【问题统计】');
        console.log(`  问题总数: ${store.issues.length}`);
        const issueByType = {};
        for (const issue of store.issues) {
            const label = analyzer_1.ISSUE_TYPE_LABELS[issue.type];
            issueByType[label] = (issueByType[label] || 0) + 1;
        }
        for (const [type, count] of Object.entries(issueByType)) {
            console.log(`    ${type}: ${count} 条`);
        }
        console.log('');
        console.log('【已处理批次');
        if (store.processedBatches.length === 0) {
            console.log('  暂无');
        }
        else {
            for (const batch of store.processedBatches) {
                console.log(`  - ${batch}`);
            }
        }
        console.log('');
    });
}
