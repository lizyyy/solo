"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.detailCommand = detailCommand;
const store_1 = require("../store/store");
const reporter_1 = require("../services/reporter");
function detailCommand(options) {
    const store = new store_1.DataStore(options.storePath);
    if (!store.exists()) {
        console.error('❌ 错误: 数据存储不存在，请先运行 init 命令');
        process.exit(1);
    }
    const reporter = new reporter_1.Reporter(store);
    const startTime = new Date();
    console.log('📋 证书详情');
    console.log('='.repeat(60));
    console.log('');
    const result = reporter.checkCertificateById(options.certificateId);
    if (!result) {
        console.error(`❌ 错误: 未找到证书 ID: ${options.certificateId}`);
        process.exit(1);
    }
    console.log(reporter.formatCheckResult(result, true));
    console.log('');
    console.log('📝 执行历史');
    console.log('-'.repeat(60));
    const records = store.getExecutionRecordsByTarget(options.certificateId);
    if (records.length === 0) {
        console.log('   暂无执行记录');
    }
    else {
        for (const record of records.slice(0, 10)) {
            const statusEmoji = record.status === 'success' ? '✅' :
                record.status === 'failed' ? '❌' : '⚠️';
            console.log(`   ${statusEmoji} [${new Date(record.startedAt).toLocaleString()}]`);
            console.log(`      动作: ${record.action}`);
            console.log(`      操作者: ${record.operator}`);
            console.log(`      耗时: ${record.durationMs}ms`);
            if (record.details.changes && record.details.changes.length > 0) {
                console.log(`      变更:`);
                for (const change of record.details.changes) {
                    console.log(`        - ${change}`);
                }
            }
            if (record.details.errorMessage) {
                console.log(`      错误: ${record.details.errorMessage}`);
            }
            console.log('');
        }
    }
    const cert = store.getCertificate(options.certificateId);
    if (cert) {
        console.log('📄 原始数据');
        console.log('-'.repeat(60));
        console.log(JSON.stringify(cert, null, 2));
    }
    store.addExecutionRecord({
        action: 'system_check',
        targetType: 'certificate',
        targetId: options.certificateId,
        status: 'success',
        startedAt: startTime.toISOString(),
        completedAt: new Date().toISOString(),
        durationMs: new Date().getTime() - startTime.getTime(),
        operator: options.operator,
        details: {
            metadata: { certificateName: result.certificateName }
        }
    });
}
