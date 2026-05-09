"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkCommand = exports.listSourcesCommand = exports.listSnapshotsCommand = void 0;
const chalk_1 = __importDefault(require("chalk"));
const store_1 = require("../storage/store");
const checker_1 = require("../services/checker");
const listSnapshotsCommand = () => {
    if (!(0, store_1.isInitialized)()) {
        console.log(chalk_1.default.red('✗ 项目未初始化'));
        return;
    }
    const snapshots = (0, store_1.getSnapshots)();
    if (snapshots.length === 0) {
        console.log(chalk_1.default.yellow('暂无索引快照'));
        return;
    }
    console.log(chalk_1.default.blue('📸 索引快照列表:\n'));
    snapshots.forEach((s, i) => {
        console.log(chalk_1.default.white(`${i + 1}. ${s.name}`));
        console.log(chalk_1.default.gray(`   ID: ${s.id}`));
        console.log(chalk_1.default.gray(`   商品数: ${s.productCount}`));
        console.log(chalk_1.default.gray(`   创建时间: ${s.createdAt}`));
        if (s.description) {
            console.log(chalk_1.default.gray(`   描述: ${s.description}`));
        }
        console.log();
    });
};
exports.listSnapshotsCommand = listSnapshotsCommand;
const listSourcesCommand = () => {
    if (!(0, store_1.isInitialized)()) {
        console.log(chalk_1.default.red('✗ 项目未初始化'));
        return;
    }
    const sources = (0, store_1.getSources)();
    if (sources.length === 0) {
        console.log(chalk_1.default.yellow('暂无源数据'));
        return;
    }
    console.log(chalk_1.default.blue('📂 源数据列表:\n'));
    sources.forEach((s, i) => {
        console.log(chalk_1.default.white(`${i + 1}. ${s.name}`));
        console.log(chalk_1.default.gray(`   ID: ${s.id}`));
        console.log(chalk_1.default.gray(`   商品数: ${s.productCount}`));
        console.log(chalk_1.default.gray(`   来源: ${s.sourceType}`));
        console.log(chalk_1.default.gray(`   创建时间: ${s.createdAt}`));
        if (s.description) {
            console.log(chalk_1.default.gray(`   描述: ${s.description}`));
        }
        console.log();
    });
};
exports.listSourcesCommand = listSourcesCommand;
const checkCommand = (snapshotId, sourceId, options) => {
    if (!(0, store_1.isInitialized)()) {
        console.log(chalk_1.default.red('✗ 项目未初始化'));
        console.log(chalk_1.default.gray('   请先运行: sir init'));
        (0, store_1.addHistoryEntry)('check', '检查失败', 'failed', '项目未初始化');
        return;
    }
    if (!snapshotId || !sourceId) {
        console.log(chalk_1.default.red('✗ 必须指定快照 ID 和源数据 ID'));
        console.log(chalk_1.default.gray('   用法: sir check <快照ID> <源数据ID>'));
        (0, store_1.addHistoryEntry)('check', '检查失败', 'failed', '缺少参数');
        return;
    }
    const snapshot = (0, store_1.getSnapshotById)(snapshotId);
    if (!snapshot) {
        console.log(chalk_1.default.red(`✗ 快照不存在: ${snapshotId}`));
        console.log(chalk_1.default.gray('   可运行: sir list snapshots 查看可用快照'));
        (0, store_1.addHistoryEntry)('check', '检查失败', 'failed', `快照不存在: ${snapshotId}`);
        return;
    }
    const source = (0, store_1.getSourceById)(sourceId);
    if (!source) {
        console.log(chalk_1.default.red(`✗ 源数据不存在: ${sourceId}`));
        console.log(chalk_1.default.gray('   可运行: sir list sources 查看可用源数据'));
        (0, store_1.addHistoryEntry)('check', '检查失败', 'failed', `源数据不存在: ${sourceId}`);
        return;
    }
    try {
        console.log(chalk_1.default.blue('🔍 开始比对索引快照和源数据...'));
        console.log(chalk_1.default.gray(`   快照: ${snapshot.name} (${snapshot.productCount} 商品)`));
        console.log(chalk_1.default.gray(`   源数据: ${source.name} (${source.productCount} 商品)`));
        const indexProducts = (0, store_1.getSnapshotProducts)(snapshotId);
        const sourceProducts = (0, store_1.getSourceProducts)(sourceId);
        if (!indexProducts || !sourceProducts) {
            console.log(chalk_1.default.red('✗ 无法读取数据文件'));
            (0, store_1.addHistoryEntry)('check', '检查失败', 'failed', '无法读取数据文件');
            return;
        }
        console.log(chalk_1.default.blue('⚙️  正在执行字段比对...'));
        const result = (0, checker_1.compareAllProducts)(indexProducts, sourceProducts);
        console.log(chalk_1.default.blue('💾 正在保存检查结果...'));
        const checkResult = (0, store_1.saveCheckResult)({
            snapshotId,
            sourceId,
            totalProducts: sourceProducts.length,
            missingFieldsCount: result.missingFieldsCount,
            mismatchedFieldsCount: result.mismatchedFieldsCount,
            productDiffs: result.productDiffs,
            summary: result.summary,
        });
        console.log(chalk_1.default.green('✓ 检查完成'));
        console.log();
        console.log(chalk_1.default.white('📊 检查结果概要:'));
        console.log(chalk_1.default.gray(`   结果 ID: ${checkResult.id}`));
        console.log(chalk_1.default.gray(`   总检查商品: ${result.summary.totalChecked}`));
        console.log(chalk_1.default.gray(`   有问题商品: ${result.summary.withIssues} / ${result.summary.totalChecked}`));
        console.log(chalk_1.default.gray(`   缺失字段总数: ${result.summary.missingFieldsTotal}`));
        console.log(chalk_1.default.gray(`   不一致字段总数: ${result.summary.mismatchedFieldsTotal}`));
        if (result.summary.mostCommonMissingFields.length > 0) {
            console.log();
            console.log(chalk_1.default.yellow('⚠️  最常缺失的字段:'));
            result.summary.mostCommonMissingFields.forEach(({ field, count }) => {
                console.log(chalk_1.default.gray(`   - ${field}: ${count} 次`));
            });
        }
        if (options.verbose) {
            const issues = result.productDiffs.filter((p) => p.hasIssue);
            const limit = options.limit || 10;
            console.log();
            console.log(chalk_1.default.white('🔎 问题详情 (最多显示 ' + limit + ' 个):'));
            issues.slice(0, limit).forEach((diff, index) => {
                console.log();
                console.log(chalk_1.default.white(`  ${index + 1}. ${diff.productName} (ID: ${diff.productId})`));
                if (diff.missingFields.length > 0) {
                    console.log(chalk_1.default.red(`     缺失: ${diff.missingFields.join(', ')}`));
                }
                if (diff.mismatchedFields.length > 0) {
                    console.log(chalk_1.default.yellow(`     不一致: ${diff.mismatchedFields.map((m) => m.fieldName).join(', ')}`));
                }
            });
        }
        (0, store_1.addHistoryEntry)('check', `执行检查: ${snapshot.name} vs ${source.name}`, 'success', `问题商品: ${result.summary.withIssues}/${result.summary.totalChecked}, 结果ID: ${checkResult.id}`);
    }
    catch (e) {
        console.log(chalk_1.default.red(`✗ 检查失败: ${e.message}`));
        (0, store_1.addHistoryEntry)('check', '检查失败', 'failed', e.message);
    }
};
exports.checkCommand = checkCommand;
//# sourceMappingURL=check.js.map