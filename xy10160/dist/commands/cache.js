"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cacheRefreshCommand = void 0;
const chalk_1 = __importDefault(require("chalk"));
const moment_1 = __importDefault(require("moment"));
const store_1 = require("../storage/store");
const simulateCacheRefresh = (productIds) => {
    const success = [];
    const failed = [];
    productIds.forEach((id, index) => {
        if (index % 15 === 11) {
            failed.push(id);
        }
        else {
            success.push(id);
        }
    });
    return { success, failed };
};
const cacheRefreshCommand = (options) => {
    if (!(0, store_1.isInitialized)()) {
        console.log(chalk_1.default.red('✗ 项目未初始化'));
        console.log(chalk_1.default.gray('   请先运行: sir init'));
        (0, store_1.addHistoryEntry)('cache', '缓存刷新失败', 'failed', '项目未初始化');
        return;
    }
    let targetProductIds = [];
    let sourceType = '';
    let sourceId = '';
    if (options.replayTaskId) {
        const task = (0, store_1.getReplayTaskById)(options.replayTaskId);
        if (!task) {
            console.log(chalk_1.default.red(`✗ 回放任务不存在: ${options.replayTaskId}`));
            (0, store_1.addHistoryEntry)('cache', '缓存刷新失败', 'failed', `回放任务不存在: ${options.replayTaskId}`);
            return;
        }
        targetProductIds = task.productIds;
        sourceType = '回放任务';
        sourceId = task.id;
    }
    else if (options.checkResultId) {
        const result = (0, store_1.getCheckResultById)(options.checkResultId);
        if (!result) {
            console.log(chalk_1.default.red(`✗ 检查结果不存在: ${options.checkResultId}`));
            (0, store_1.addHistoryEntry)('cache', '缓存刷新失败', 'failed', `检查结果不存在: ${options.checkResultId}`);
            return;
        }
        targetProductIds = result.productDiffs
            .filter((p) => p.hasIssue)
            .map((p) => p.productId);
        sourceType = '检查结果';
        sourceId = result.id;
    }
    else if (options.productIds) {
        targetProductIds = options.productIds.split(',').map((id) => id.trim()).filter(Boolean);
        sourceType = '手动指定';
        sourceId = 'manual';
    }
    if (targetProductIds.length === 0) {
        console.log(chalk_1.default.red('✗ 未指定任何商品 ID'));
        console.log(chalk_1.default.gray('   使用 --replay-task-id, --check-result-id, 或 --product-ids 指定'));
        (0, store_1.addHistoryEntry)('cache', '缓存刷新失败', 'failed', '无商品 ID');
        return;
    }
    console.log(chalk_1.default.blue('🗄️  准备缓存刷新...'));
    console.log(chalk_1.default.gray(`   来源: ${sourceType}`));
    if (sourceId !== 'manual') {
        console.log(chalk_1.default.gray(`   来源 ID: ${sourceId}`));
    }
    console.log(chalk_1.default.gray(`   待刷新商品数: ${targetProductIds.length}`));
    if (options.dryRun) {
        console.log();
        console.log(chalk_1.default.yellow('📋 预演模式 - 不会实际刷新缓存'));
        console.log(chalk_1.default.gray('   将刷新以下商品:'));
        targetProductIds.slice(0, 20).forEach((id, i) => {
            console.log(chalk_1.default.gray(`   ${i + 1}. ${id}`));
        });
        if (targetProductIds.length > 20) {
            console.log(chalk_1.default.gray(`   ... 还有 ${targetProductIds.length - 20} 个商品`));
        }
        (0, store_1.addHistoryEntry)('cache', `预演缓存刷新 (${sourceType})`, 'success', `商品数: ${targetProductIds.length}`);
        return;
    }
    try {
        console.log(chalk_1.default.blue('▶️  开始刷新缓存...'));
        const result = simulateCacheRefresh(targetProductIds);
        const status = result.failed.length === 0
            ? 'success'
            : result.success.length === 0
                ? 'failed'
                : 'partial';
        const errors = result.failed.length > 0
            ? [`${result.failed.length} 个商品缓存刷新失败: ${result.failed.slice(0, 5).join(', ')}${result.failed.length > 5 ? '...' : ''}`]
            : [];
        console.log(chalk_1.default.blue('💾 正在保存刷新记录...'));
        const record = (0, store_1.saveCacheRecord)({
            timestamp: (0, moment_1.default)().toISOString(),
            productIds: targetProductIds,
            status,
            refreshedCount: result.success.length,
            failedCount: result.failed.length,
            errors,
        });
        const statusColor = {
            success: chalk_1.default.green,
            failed: chalk_1.default.red,
            partial: chalk_1.default.yellow,
        };
        console.log(chalk_1.default.green('✓ 缓存刷新完成'));
        console.log();
        console.log(chalk_1.default.white('📊 刷新结果:'));
        console.log(chalk_1.default.gray(`   记录 ID: ${record.id}`));
        console.log(chalk_1.default.gray(`   状态: ${statusColor[status](status)}`));
        console.log(chalk_1.default.gray(`   成功: ${result.success.length}`));
        console.log(chalk_1.default.gray(`   失败: ${result.failed.length}`));
        if (result.failed.length > 0) {
            console.log();
            console.log(chalk_1.default.yellow('⚠️  失败的商品 ID (最多 10 个):'));
            result.failed.slice(0, 10).forEach((id) => {
                console.log(chalk_1.default.gray(`   - ${id}`));
            });
        }
        (0, store_1.addHistoryEntry)('cache', `执行缓存刷新 (${sourceType})`, status === 'failed' ? 'failed' : 'success', `成功: ${result.success.length}, 失败: ${result.failed.length}, 记录ID: ${record.id}`);
    }
    catch (e) {
        console.log(chalk_1.default.red(`✗ 缓存刷新失败: ${e.message}`));
        (0, store_1.addHistoryEntry)('cache', '缓存刷新失败', 'failed', e.message);
    }
};
exports.cacheRefreshCommand = cacheRefreshCommand;
//# sourceMappingURL=cache.js.map