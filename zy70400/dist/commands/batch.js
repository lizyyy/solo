"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.previewBatchProcess = previewBatchProcess;
exports.executeBatchProcess = executeBatchProcess;
exports.correctRecord = correctRecord;
const chalk_1 = __importDefault(require("chalk"));
const cli_table3_1 = __importDefault(require("cli-table3"));
const inquirer_1 = __importDefault(require("inquirer"));
const storage_1 = require("../storage");
const types_1 = require("../types");
async function previewBatchProcess(batchId) {
    const batch = storage_1.Storage.getBatchById(batchId);
    if (!batch) {
        console.log(chalk_1.default.red(`批次 ${batchId} 不存在`));
        return;
    }
    const records = storage_1.Storage.queryRecords({ batchId });
    const pendingRecords = records.filter(r => r.status === types_1.ProcessingStatus.PENDING);
    console.log(chalk_1.default.blue.bold(`\n批量处理预览 - 批次: ${batchId}\n`));
    console.log(chalk_1.default.white(`批次名称: ${batch.batchName}`));
    console.log(chalk_1.default.white(`来源: ${batch.source}`));
    console.log(chalk_1.default.white(`处理依据: ${batch.processingBasis}`));
    console.log(chalk_1.default.yellow(`\n待处理记录: ${pendingRecords.length} 条`));
    if (pendingRecords.length > 0) {
        const table = new cli_table3_1.default({
            head: [
                chalk_1.default.cyan('ID'),
                chalk_1.default.cyan('客户姓名'),
                chalk_1.default.cyan('客服'),
                chalk_1.default.cyan('录音ID'),
                chalk_1.default.cyan('摘要')
            ],
            colWidths: [12, 12, 10, 15, 30]
        });
        pendingRecords.forEach(record => {
            table.push([
                record.id.substring(0, 8),
                record.customerName,
                record.agentName,
                record.recordingId,
                record.summary.substring(0, 25) + '...'
            ]);
        });
        console.log(table.toString());
    }
    console.log(chalk_1.default.blue(`\n预览完成。使用 --execute 参数执行批量处理`));
}
async function executeBatchProcess(batchId) {
    await previewBatchProcess(batchId);
    const answers = await inquirer_1.default.prompt([
        {
            type: 'confirm',
            name: 'confirm',
            message: chalk_1.default.yellow('确认要执行批量处理吗？'),
            default: false
        }
    ]);
    if (!answers.confirm) {
        console.log(chalk_1.default.gray('已取消操作'));
        return;
    }
    const records = storage_1.Storage.queryRecords({ batchId, status: types_1.ProcessingStatus.PENDING });
    let successCount = 0;
    let abnormalCount = 0;
    for (const record of records) {
        const truncatedFields = [];
        if (record.summary.length < 10 && record.summary.length > 0) {
            truncatedFields.push('summary');
        }
        if (record.customerName.includes('...')) {
            truncatedFields.push('customerName');
        }
        const hasTruncatedField = record.isFieldTruncated || truncatedFields.length > 0;
        if (hasTruncatedField) {
            const allTruncatedFields = [...new Set([...(record.truncatedFields || []), ...truncatedFields])];
            storage_1.Storage.updateRecord(record.id, {
                status: types_1.ProcessingStatus.ABNORMAL,
                abnormalType: types_1.AbnormalType.FIELD_TRUNCATED,
                abnormalReason: '批处理检测到字段截断，需要人工复核',
                isFieldTruncated: true,
                truncatedFields: allTruncatedFields,
                processingResult: '字段截断，需要人工复核'
            });
            abnormalCount++;
            console.log(chalk_1.default.red(`  ${record.id.substring(0, 8)} - 标记为异常: 字段截断 (${allTruncatedFields.join(', ')})`));
        }
        else {
            storage_1.Storage.updateRecord(record.id, {
                status: types_1.ProcessingStatus.SUCCESS,
                processingResult: '处理成功'
            });
            successCount++;
            console.log(chalk_1.default.green(`  ${record.id.substring(0, 8)} - 处理成功`));
        }
    }
    console.log(chalk_1.default.blue.bold(`\n批量处理完成!`));
    console.log(chalk_1.default.green(`成功: ${successCount} 条`));
    console.log(chalk_1.default.red(`异常: ${abnormalCount} 条`));
}
async function correctRecord(recordId) {
    const record = storage_1.Storage.getRecordById(recordId);
    if (!record) {
        console.log(chalk_1.default.red(`记录 ${recordId} 不存在`));
        return;
    }
    console.log(chalk_1.default.blue.bold('\n当前记录详情:\n'));
    console.log(chalk_1.default.white(`ID: ${record.id}`));
    console.log(chalk_1.default.white(`批次号: ${record.batchId}`));
    console.log(chalk_1.default.white(`客户姓名: ${record.customerName}`));
    console.log(chalk_1.default.white(`客服: ${record.agentName}`));
    console.log(chalk_1.default.white(`摘要: ${record.summary}`));
    console.log(chalk_1.default.white(`状态: ${record.status}`));
    const answers = await inquirer_1.default.prompt([
        {
            type: 'input',
            name: 'correctedBy',
            message: '修正人姓名:'
        },
        {
            type: 'input',
            name: 'correctionReason',
            message: '修正原因:'
        },
        {
            type: 'input',
            name: 'newSummary',
            message: '修正后的摘要:',
            default: record.summary
        },
        {
            type: 'input',
            name: 'newCustomerName',
            message: '修正后的客户姓名:',
            default: record.customerName
        }
    ]);
    const updated = storage_1.Storage.manuallyCorrectRecord(recordId, answers.correctedBy, answers.correctionReason, {
        summary: answers.newSummary,
        customerName: answers.newCustomerName
    });
    if (updated) {
        console.log(chalk_1.default.green.bold('\n人工修正成功!'));
        console.log(chalk_1.default.yellow(`修正人: ${updated.correctedBy}`));
        console.log(chalk_1.default.yellow(`修正原因: ${updated.correctionReason}`));
        console.log(chalk_1.default.yellow(`修正时间: ${updated.correctionTime}`));
    }
}
