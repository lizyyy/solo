"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.replayStatusCommand = exports.replayCommand = void 0;
const chalk_1 = __importDefault(require("chalk"));
const moment_1 = __importDefault(require("moment"));
const store_1 = require("../storage/store");
const simulateReplay = (productIds) => {
    const success = [];
    const failed = [];
    productIds.forEach((id, index) => {
        if (index % 10 === 7) {
            failed.push(id);
        }
        else {
            success.push(id);
        }
    });
    return { success, failed };
};
const replayCommand = (checkResultId, options) => {
    if (!(0, store_1.isInitialized)()) {
        console.log(chalk_1.default.red('✗ 项目未初始化'));
        console.log(chalk_1.default.gray('   请先运行: sir init'));
        (0, store_1.addHistoryEntry)('replay', '回放失败', 'failed', '项目未初始化');
        return;
    }
    if (!checkResultId) {
        console.log(chalk_1.default.red('✗ 必须指定检查结果 ID'));
        console.log(chalk_1.default.gray('   用法: sir replay <检查结果ID> --name <任务名称>'));
        (0, store_1.addHistoryEntry)('replay', '回放失败', 'failed', '缺少检查结果 ID');
        return;
    }
    if (!options.name) {
        console.log(chalk_1.default.red('✗ 必须指定 --name 参数'));
        (0, store_1.addHistoryEntry)('replay', '回放失败', 'failed', '未指定名称');
        return;
    }
    const checkResult = (0, store_1.getCheckResultById)(checkResultId);
    if (!checkResult) {
        console.log(chalk_1.default.red(`✗ 检查结果不存在: ${checkResultId}`));
        console.log(chalk_1.default.gray('   可运行: sir list checks 查看可用检查结果'));
        (0, store_1.addHistoryEntry)('replay', '回放失败', 'failed', `检查结果不存在: ${checkResultId}`);
        return;
    }
    let targetProductIds;
    if (options.productIds) {
        const specifiedIds = options.productIds.split(',').map((id) => id.trim()).filter(Boolean);
        const issues = checkResult.productDiffs.filter((p) => p.hasIssue).map((p) => p.productId);
        const invalidIds = specifiedIds.filter((id) => !issues.includes(id));
        if (invalidIds.length > 0) {
            console.log(chalk_1.default.yellow(`⚠️  以下商品 ID 不在问题商品列表中，将被忽略:`));
            invalidIds.forEach((id) => console.log(chalk_1.default.gray(`   - ${id}`)));
        }
        targetProductIds = specifiedIds.filter((id) => issues.includes(id));
        if (targetProductIds.length === 0) {
            console.log(chalk_1.default.red('✗ 没有有效的商品 ID 可回放'));
            (0, store_1.addHistoryEntry)('replay', '回放失败', 'failed', '无有效商品 ID');
            return;
        }
    }
    else {
        targetProductIds = checkResult.productDiffs
            .filter((p) => p.hasIssue)
            .map((p) => p.productId);
        if (targetProductIds.length === 0) {
            console.log(chalk_1.default.yellow('⚠️  该检查结果没有需要回放的问题商品'));
            (0, store_1.addHistoryEntry)('replay', '回放跳过', 'success', '无问题商品');
            return;
        }
    }
    console.log(chalk_1.default.blue('🔄 准备重建回放任务...'));
    console.log(chalk_1.default.gray(`   任务名称: ${options.name}`));
    console.log(chalk_1.default.gray(`   检查结果: ${checkResultId}`));
    console.log(chalk_1.default.gray(`   待回放商品数: ${targetProductIds.length}`));
    if (options.dryRun) {
        console.log();
        console.log(chalk_1.default.yellow('📋 预演模式 - 不会实际执行回放'));
        console.log(chalk_1.default.gray('   将回放以下商品:'));
        targetProductIds.slice(0, 20).forEach((id, i) => {
            console.log(chalk_1.default.gray(`   ${i + 1}. ${id}`));
        });
        if (targetProductIds.length > 20) {
            console.log(chalk_1.default.gray(`   ... 还有 ${targetProductIds.length - 20} 个商品`));
        }
        (0, store_1.addHistoryEntry)('replay', `预演回放: ${options.name}`, 'success', `商品数: ${targetProductIds.length}`);
        return;
    }
    try {
        console.log(chalk_1.default.blue('💾 正在创建回放任务...'));
        const task = (0, store_1.saveReplayTask)({
            name: options.name,
            description: options.description,
            checkResultId,
            productIds: targetProductIds,
            status: 'pending',
            successCount: 0,
            failedCount: 0,
            errors: [],
        });
        console.log(chalk_1.default.blue('▶️  开始执行回放...'));
        const startTime = (0, moment_1.default)().toISOString();
        (0, store_1.updateReplayTask)(task.id, { status: 'running', startTime });
        const result = simulateReplay(targetProductIds);
        const endTime = (0, moment_1.default)().toISOString();
        const finalStatus = result.failed.length > 0 ? 'failed' : 'completed';
        const errors = result.failed.length > 0
            ? [`${result.failed.length} 个商品回放失败: ${result.failed.slice(0, 5).join(', ')}${result.failed.length > 5 ? '...' : ''}`]
            : [];
        (0, store_1.updateReplayTask)(task.id, {
            status: finalStatus,
            endTime,
            successCount: result.success.length,
            failedCount: result.failed.length,
            errors,
        });
        console.log(chalk_1.default.green('✓ 回放任务完成'));
        console.log();
        console.log(chalk_1.default.white('📊 执行结果:'));
        console.log(chalk_1.default.gray(`   任务 ID: ${task.id}`));
        console.log(chalk_1.default.gray(`   状态: ${finalStatus === 'completed' ? chalk_1.default.green('成功') : chalk_1.default.yellow('部分失败')}`));
        console.log(chalk_1.default.gray(`   成功: ${result.success.length}`));
        console.log(chalk_1.default.gray(`   失败: ${result.failed.length}`));
        if (result.failed.length > 0) {
            console.log();
            console.log(chalk_1.default.yellow('⚠️  失败的商品 ID (最多 10 个):'));
            result.failed.slice(0, 10).forEach((id) => {
                console.log(chalk_1.default.gray(`   - ${id}`));
            });
        }
        (0, store_1.addHistoryEntry)('replay', `执行回放: ${options.name}`, finalStatus === 'completed' ? 'success' : 'failed', `成功: ${result.success.length}, 失败: ${result.failed.length}, 任务ID: ${task.id}`);
    }
    catch (e) {
        console.log(chalk_1.default.red(`✗ 回放失败: ${e.message}`));
        (0, store_1.addHistoryEntry)('replay', '回放失败', 'failed', e.message);
    }
};
exports.replayCommand = replayCommand;
const replayStatusCommand = (taskId) => {
    if (!(0, store_1.isInitialized)()) {
        console.log(chalk_1.default.red('✗ 项目未初始化'));
        return;
    }
    if (!taskId) {
        console.log(chalk_1.default.red('✗ 必须指定任务 ID'));
        return;
    }
    const task = (0, store_1.getReplayTaskById)(taskId);
    if (!task) {
        console.log(chalk_1.default.red(`✗ 任务不存在: ${taskId}`));
        return;
    }
    const statusColor = {
        pending: chalk_1.default.blue,
        running: chalk_1.default.yellow,
        completed: chalk_1.default.green,
        failed: chalk_1.default.red,
    };
    console.log(chalk_1.default.white('📋 回放任务详情:\n'));
    console.log(chalk_1.default.gray(`   名称: ${task.name}`));
    console.log(chalk_1.default.gray(`   ID: ${task.id}`));
    console.log(chalk_1.default.gray(`   状态: ${statusColor[task.status](task.status)}`));
    console.log(chalk_1.default.gray(`   关联检查结果: ${task.checkResultId}`));
    console.log(chalk_1.default.gray(`   总商品数: ${task.productIds.length}`));
    console.log(chalk_1.default.gray(`   成功: ${task.successCount}`));
    console.log(chalk_1.default.gray(`   失败: ${task.failedCount}`));
    if (task.startTime) {
        console.log(chalk_1.default.gray(`   开始时间: ${task.startTime}`));
    }
    if (task.endTime) {
        console.log(chalk_1.default.gray(`   结束时间: ${task.endTime}`));
    }
    if (task.errors.length > 0) {
        console.log();
        console.log(chalk_1.default.yellow('⚠️  错误信息:'));
        task.errors.forEach((err, i) => {
            console.log(chalk_1.default.gray(`   ${i + 1}. ${err}`));
        });
    }
};
exports.replayStatusCommand = replayStatusCommand;
//# sourceMappingURL=replay.js.map