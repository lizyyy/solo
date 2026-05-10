"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.importSellers = importSellers;
exports.importBuyers = importBuyers;
exports.runMatching = runMatching;
exports.lockDeal = lockDeal;
exports.unlockDeal = unlockDeal;
exports.exportResults = exportResults;
exports.listSellers = listSellers;
exports.listBuyers = listBuyers;
const fs_1 = require("fs");
const chalk_1 = __importDefault(require("chalk"));
const DataStore_1 = require("../store/DataStore");
const Matcher_1 = require("../matching/Matcher");
async function importSellers(filePath) {
    await DataStore_1.dataStore.init();
    console.log(chalk_1.default.blue('📚 正在导入卖家清单...'));
    try {
        const content = await fs_1.promises.readFile(filePath, 'utf-8');
        const records = JSON.parse(content);
        const result = await DataStore_1.dataStore.importSellers(records);
        printImportResult(result, '卖家');
    }
    catch (error) {
        console.error(chalk_1.default.red(`❌ 导入失败: ${error}`));
        process.exit(1);
    }
}
async function importBuyers(filePath) {
    await DataStore_1.dataStore.init();
    console.log(chalk_1.default.blue('🛒 正在导入买家需求...'));
    try {
        const content = await fs_1.promises.readFile(filePath, 'utf-8');
        const records = JSON.parse(content);
        const result = await DataStore_1.dataStore.importBuyers(records);
        printImportResult(result, '买家');
    }
    catch (error) {
        console.error(chalk_1.default.red(`❌ 导入失败: ${error}`));
        process.exit(1);
    }
}
function printImportResult(result, type) {
    console.log('\n' + chalk_1.default.bold(`📊 ${type}导入结果`));
    console.log(chalk_1.default.gray('─'.repeat(40)));
    console.log(`  总计: ${chalk_1.default.cyan(result.totalRecords)} 条`);
    console.log(`  成功导入: ${chalk_1.default.green(result.imported)} 条`);
    console.log(`  合并更新: ${chalk_1.default.yellow(result.merged)} 条`);
    console.log(`  重复跳过: ${chalk_1.default.gray(result.duplicates)} 条`);
    console.log(`  错误: ${chalk_1.default.red(result.errors)} 条`);
    if (result.messages.length > 0) {
        console.log('\n' + chalk_1.default.bold('📝 详细信息:'));
        for (const msg of result.messages) {
            if (msg.startsWith('导入:')) {
                console.log('  ' + chalk_1.default.green('✓ ') + msg);
            }
            else if (msg.startsWith('合并:')) {
                console.log('  ' + chalk_1.default.yellow('⚠ ') + msg);
            }
            else if (msg.startsWith('重复:')) {
                console.log('  ' + chalk_1.default.gray('› ') + msg);
            }
            else {
                console.log('  ' + chalk_1.default.red('✗ ') + msg);
            }
        }
    }
}
async function runMatching(buyerId, sellerId) {
    await DataStore_1.dataStore.init();
    console.log(chalk_1.default.blue('🔍 开始撮合匹配...'));
    console.log('');
    let results;
    try {
        if (buyerId) {
            results = await Matcher_1.matcher.matchByBuyer(buyerId);
        }
        else if (sellerId) {
            results = await Matcher_1.matcher.matchBySeller(sellerId);
        }
        else {
            results = await Matcher_1.matcher.matchAll();
        }
        const matchableResults = results.filter(r => r.canBeMatched);
        const unmatchableResults = results.filter(r => !r.canBeMatched);
        console.log(chalk_1.default.bold('📊 撮合结果统计'));
        console.log(chalk_1.default.gray('─'.repeat(40)));
        console.log(`  可匹配: ${chalk_1.default.green(matchableResults.length)} 对`);
        console.log(`  不可匹配: ${chalk_1.default.red(unmatchableResults.length)} 对`);
        console.log('');
        if (matchableResults.length > 0) {
            console.log(chalk_1.default.bold.green('✨ 可匹配推荐'));
            console.log(chalk_1.default.gray('─'.repeat(60)));
            for (let i = 0; i < Math.min(5, matchableResults.length); i++) {
                printMatchResult(matchableResults[i], i + 1, true);
            }
            if (matchableResults.length > 5) {
                console.log(chalk_1.default.gray(`\n  ...还有 ${matchableResults.length - 5} 个匹配结果\n`));
            }
        }
        if (unmatchableResults.length > 0) {
            console.log(chalk_1.default.bold.red('❌ 不可匹配（原因分析）'));
            console.log(chalk_1.default.gray('─'.repeat(60)));
            for (let i = 0; i < Math.min(3, unmatchableResults.length); i++) {
                printMatchResult(unmatchableResults[i], i + 1, false);
            }
            if (unmatchableResults.length > 3) {
                console.log(chalk_1.default.gray(`\n  ...还有 ${unmatchableResults.length - 3} 个不匹配结果`));
            }
        }
        if (results.length === 0) {
            console.log(chalk_1.default.yellow('⚠  没有足够的数据进行撮合。请先导入卖家清单和买家需求。'));
        }
    }
    catch (error) {
        console.error(chalk_1.default.red(`❌ 撮合失败: ${error}`));
        process.exit(1);
    }
}
function printMatchResult(result, index, isMatchable) {
    const statusColor = isMatchable ? chalk_1.default.green : chalk_1.default.red;
    const statusIcon = isMatchable ? '✓' : '✗';
    console.log('\n' + statusColor(`${statusIcon} #${index}`));
    console.log(`  课程: ${chalk_1.default.cyan(result.courseName)}`);
    console.log(`  书名: ${chalk_1.default.bold(result.bookTitle)}`);
    console.log(`  买家: ${chalk_1.default.blue(result.buyerName)} → 卖家: ${chalk_1.default.magenta(result.sellerName)}`);
    console.log(`  价格: ¥${result.sellerPrice} (预算¥${result.buyerPrice})`);
    console.log(`  版本: 买家要第${result.buyerEdition}版 / 卖家有第${result.sellerEdition}版`);
    console.log(`  取书地点: ${result.sellerLocation}`);
    if (isMatchable) {
        console.log(`  ${chalk_1.default.green(`匹配度: ${result.matchScore}%`)}`);
        console.log('');
        console.log(chalk_1.default.gray('  ') + result.explanation.replace(/\n/g, '\n  '));
    }
    else {
        console.log(`  ${chalk_1.default.red('不可交易')}`);
        console.log('');
        console.log(chalk_1.default.gray('  ') + result.explanation.replace(/\n/g, '\n  '));
        if (result.missingConditions.length > 1) {
            console.log('');
            console.log(chalk_1.default.yellow('  ⚠  其他问题:'));
            for (let i = 1; i < result.missingConditions.length; i++) {
                console.log(chalk_1.default.gray(`     • ${result.missingConditions[i]}`));
            }
        }
    }
}
async function lockDeal(sellerId, buyerId) {
    await DataStore_1.dataStore.init();
    console.log(chalk_1.default.blue('🔒 正在锁定交易...'));
    try {
        const result = await DataStore_1.dataStore.lockDeal(sellerId, buyerId);
        if (result.success) {
            console.log(chalk_1.default.green('✓ ' + result.message));
            console.log(chalk_1.default.gray('  该书将为您保留，其他买家暂时无法锁定'));
        }
        else {
            console.log(chalk_1.default.red('✗ ' + result.message));
        }
    }
    catch (error) {
        console.error(chalk_1.default.red(`❌ 锁定失败: ${error}`));
        process.exit(1);
    }
}
async function unlockDeal(sellerId, buyerId) {
    await DataStore_1.dataStore.init();
    console.log(chalk_1.default.blue('🔓 正在取消锁定...'));
    try {
        const result = await DataStore_1.dataStore.unlockDeal(sellerId, buyerId);
        if (result.success) {
            console.log(chalk_1.default.green('✓ ' + result.message));
            console.log(chalk_1.default.gray('  该书已回到可撮合池，可以重新匹配'));
        }
        else {
            console.log(chalk_1.default.red('✗ ' + result.message));
        }
    }
    catch (error) {
        console.error(chalk_1.default.red(`❌ 取消锁定失败: ${error}`));
        process.exit(1);
    }
}
async function exportResults(outputPath) {
    await DataStore_1.dataStore.init();
    console.log(chalk_1.default.blue('📤 正在导出撮合结果...'));
    try {
        const results = await Matcher_1.matcher.matchAll();
        const exportData = {
            generatedAt: new Date().toISOString(),
            statistics: {
                total: results.length,
                matchable: results.filter(r => r.canBeMatched).length,
                unmatchable: results.filter(r => !r.canBeMatched).length
            },
            matchableResults: results.filter(r => r.canBeMatched),
            unmatchableResults: results.filter(r => !r.canBeMatched)
        };
        await fs_1.promises.writeFile(outputPath, JSON.stringify(exportData, null, 2), 'utf-8');
        console.log(chalk_1.default.green('✓ 导出成功!'));
        console.log(`  文件: ${chalk_1.default.cyan(outputPath)}`);
        console.log(`  可匹配: ${chalk_1.default.green(exportData.statistics.matchable)} 对`);
        console.log(`  不可匹配: ${chalk_1.default.red(exportData.statistics.unmatchable)} 对`);
    }
    catch (error) {
        console.error(chalk_1.default.red(`❌ 导出失败: ${error}`));
        process.exit(1);
    }
}
async function listSellers() {
    await DataStore_1.dataStore.init();
    const sellers = DataStore_1.dataStore.getSellers();
    console.log(chalk_1.default.bold('📚 卖家清单列表'));
    console.log(chalk_1.default.gray('─'.repeat(60)));
    if (sellers.length === 0) {
        console.log(chalk_1.default.yellow('  暂无卖家数据'));
        return;
    }
    for (const seller of sellers) {
        const statusText = seller.status === 'locked'
            ? chalk_1.default.red('🔒 已锁定')
            : chalk_1.default.green('✓ 可交易');
        console.log('');
        console.log(`  ID: ${chalk_1.default.cyan(seller.id)}`);
        console.log(`  课程: ${seller.courseName}`);
        console.log(`  书名: ${chalk_1.default.bold(seller.bookTitle)} (第${seller.edition}版)`);
        console.log(`  价格: ¥${seller.price} | 成色: ${getConditionText(seller.condition)}`);
        console.log(`  取书地点: ${seller.pickupLocation}`);
        console.log(`  卖家: ${seller.sellerName} | 状态: ${statusText}`);
    }
}
async function listBuyers() {
    await DataStore_1.dataStore.init();
    const buyers = DataStore_1.dataStore.getBuyers();
    console.log(chalk_1.default.bold('🛒 买家需求列表'));
    console.log(chalk_1.default.gray('─'.repeat(60)));
    if (buyers.length === 0) {
        console.log(chalk_1.default.yellow('  暂无买家数据'));
        return;
    }
    for (const buyer of buyers) {
        const statusText = buyer.status === 'locked'
            ? chalk_1.default.red('🔒 已锁定')
            : chalk_1.default.green('✓ 可匹配');
        console.log('');
        console.log(`  ID: ${chalk_1.default.cyan(buyer.id)}`);
        console.log(`  课程: ${buyer.courseName}`);
        console.log(`  书名: ${chalk_1.default.bold(buyer.bookTitle)} (想要第${buyer.desiredEdition}版)`);
        console.log(`  预算: ¥${buyer.maxPrice} | 可接受成色: ${buyer.acceptableConditions.map(getConditionText).join(', ')}`);
        console.log(`  取书地点: ${buyer.preferredPickupLocations.join(', ')}`);
        console.log(`  买家: ${buyer.buyerName} | 状态: ${statusText}`);
    }
}
function getConditionText(condition) {
    const mapping = {
        'new': '全新',
        'like_new': '几乎全新',
        'good': '良好',
        'fair': '一般',
        'poor': '较差'
    };
    return mapping[condition] || condition;
}
