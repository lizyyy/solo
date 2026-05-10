#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const fs_1 = require("fs");
const path_1 = require("path");
const RuleMatcher_1 = require("./services/RuleMatcher");
const InventoryManager_1 = require("./services/InventoryManager");
const ReplayEngine_1 = require("./services/ReplayEngine");
const ExportService_1 = require("./services/ExportService");
const program = new commander_1.Command();
const DATA_DIR = (0, path_1.join)(__dirname, '..', 'data');
const OUTPUT_DIR = (0, path_1.join)(__dirname, '..', 'output');
function ensureDirs() {
    if (!(0, fs_1.existsSync)(DATA_DIR)) {
        (0, fs_1.mkdirSync)(DATA_DIR, { recursive: true });
    }
    if (!(0, fs_1.existsSync)(OUTPUT_DIR)) {
        (0, fs_1.mkdirSync)(OUTPUT_DIR, { recursive: true });
    }
}
function loadRules() {
    const path = (0, path_1.join)(DATA_DIR, 'rules.json');
    if (!(0, fs_1.existsSync)(path)) {
        throw new Error(`规则文件不存在: ${path}`);
    }
    return JSON.parse((0, fs_1.readFileSync)(path, 'utf-8'));
}
function loadOrders() {
    const path = (0, path_1.join)(DATA_DIR, 'orders.json');
    if (!(0, fs_1.existsSync)(path)) {
        throw new Error(`订单文件不存在: ${path}`);
    }
    return JSON.parse((0, fs_1.readFileSync)(path, 'utf-8'));
}
function loadInventory() {
    const path = (0, path_1.join)(DATA_DIR, 'inventory.json');
    if (!(0, fs_1.existsSync)(path)) {
        throw new Error(`库存文件不存在: ${path}`);
    }
    return JSON.parse((0, fs_1.readFileSync)(path, 'utf-8'));
}
function loadReplayState() {
    const path = (0, path_1.join)(OUTPUT_DIR, 'replay-state.json');
    if (!(0, fs_1.existsSync)(path)) {
        return null;
    }
    return JSON.parse((0, fs_1.readFileSync)(path, 'utf-8'));
}
function saveReplayState(state) {
    const path = (0, path_1.join)(OUTPUT_DIR, 'replay-state.json');
    (0, fs_1.writeFileSync)(path, JSON.stringify(state, null, 2), 'utf-8');
}
program
    .name('gift-replay')
    .description('电商赠品规则回放 CLI 工具')
    .version('1.0.0');
program
    .command('preview')
    .description('预览促销规则')
    .option('--rule-id <ruleId>', '查看特定规则详情')
    .action((options) => {
    ensureDirs();
    const rules = loadRules();
    const matcher = new RuleMatcher_1.RuleMatcher(rules);
    const allRules = matcher.getAllRules();
    if (options.ruleId) {
        const rule = matcher.getRuleById(options.ruleId);
        if (!rule) {
            console.log(`规则不存在: ${options.ruleId}`);
            return;
        }
        console.log(JSON.stringify(rule, null, 2));
        return;
    }
    console.log('=== 促销规则列表 ===\n');
    for (const rule of allRules) {
        console.log(`规则ID: ${rule.id}`);
        console.log(`名称: ${rule.name}`);
        console.log(`版本: v${rule.version}`);
        console.log(`优先级: ${rule.priority}`);
        console.log(`生效时间: ${rule.effectiveTime} ~ ${rule.expireTime}`);
        console.log(`条件:`);
        if (rule.conditions.minAmount) {
            console.log(`  - 满额: ¥${rule.conditions.minAmount}`);
        }
        if (rule.conditions.includeCategories && rule.conditions.includeCategories.length > 0) {
            console.log(`  - 包含品类: ${rule.conditions.includeCategories.join(', ')}`);
        }
        console.log(`赠品:`);
        for (const gift of rule.gifts) {
            console.log(`  - ${gift.giftName} (${gift.giftSku}) x${gift.quantity}`);
        }
        console.log('---\n');
    }
});
program
    .command('replay')
    .description('回放历史订单赠品')
    .option('--order-id <orderId>', '只回放特定订单')
    .option('--confirm', '立即确认占用库存')
    .action((options) => {
    ensureDirs();
    const rules = loadRules();
    const orders = loadOrders();
    const inventory = loadInventory();
    const existingState = loadReplayState();
    const matcher = new RuleMatcher_1.RuleMatcher(rules);
    const inventoryManager = new InventoryManager_1.InventoryManager(inventory, existingState?.grants || []);
    const engine = new ReplayEngine_1.ReplayEngine(matcher, inventoryManager);
    let ordersToReplay = orders;
    if (options.orderId) {
        ordersToReplay = orders.filter((o) => o.orderId === options.orderId);
        if (ordersToReplay.length === 0) {
            console.log(`订单不存在: ${options.orderId}`);
            return;
        }
    }
    const results = engine.replayOrders(ordersToReplay);
    if (options.confirm) {
        const confirmResult = engine.confirmAllReservations();
        console.log(`\n确认结果: 成功 ${confirmResult.confirmed} 个, 失败 ${confirmResult.failed} 个`);
    }
    console.log(`\n=== 回放结果 (共 ${results.length} 个订单) ===\n`);
    for (const result of results) {
        console.log(result.explanation);
        console.log('');
    }
    const state = engine.getReplayState();
    saveReplayState(state);
    console.log(`回放状态已保存: ${(0, path_1.join)(OUTPUT_DIR, 'replay-state.json')}`);
});
program
    .command('diff')
    .description('查看回放结果与实际赠品的差异')
    .option('--order-id <orderId>', '只查看特定订单的差异')
    .action((options) => {
    ensureDirs();
    const rules = loadRules();
    const orders = loadOrders();
    const inventory = loadInventory();
    const existingState = loadReplayState();
    const matcher = new RuleMatcher_1.RuleMatcher(rules);
    const inventoryManager = new InventoryManager_1.InventoryManager(inventory, existingState?.grants || []);
    const engine = new ReplayEngine_1.ReplayEngine(matcher, inventoryManager);
    let ordersToCheck = orders;
    if (options.orderId) {
        ordersToCheck = orders.filter((o) => o.orderId === options.orderId);
        if (ordersToCheck.length === 0) {
            console.log(`订单不存在: ${options.orderId}`);
            return;
        }
    }
    engine.replayOrders(ordersToCheck);
    const diffs = ordersToCheck.map((o) => engine.getDiff(o));
    console.log(`\n=== 差异报告 ===\n`);
    for (const diff of diffs) {
        console.log(`订单 ${diff.orderId} (${diff.orderCreateTime})`);
        console.log(`差异类型: ${diff.diffType}`);
        console.log(`详情: ${diff.diffDetails}`);
        if (diff.expectedGifts.length > 0) {
            console.log(`期望赠品: ${diff.expectedGifts.map((g) => `${g.giftName}x${g.quantity}`).join(', ')}`);
        }
        if (diff.actualGifts.length > 0) {
            console.log(`实际赠品: ${diff.actualGifts.map((g) => `${g.giftName}x${g.quantity}`).join(', ')}`);
        }
        console.log('');
    }
    const matchCount = diffs.filter((d) => d.diffType === 'match').length;
    const mismatchCount = diffs.length - matchCount;
    console.log(`总计: ${diffs.length} 个订单, 匹配 ${matchCount} 个, 不匹配 ${mismatchCount} 个`);
});
program
    .command('confirm')
    .description('确认占用库存')
    .option('--order-id <orderId>', '只确认特定订单')
    .option('--gift-sku <giftSku>', '只确认特定赠品')
    .action((options) => {
    ensureDirs();
    const rules = loadRules();
    const orders = loadOrders();
    const inventory = loadInventory();
    const existingState = loadReplayState();
    const matcher = new RuleMatcher_1.RuleMatcher(rules);
    const inventoryManager = new InventoryManager_1.InventoryManager(inventory, existingState?.grants || []);
    const engine = new ReplayEngine_1.ReplayEngine(matcher, inventoryManager);
    let ordersToConfirm = orders;
    if (options.orderId) {
        ordersToConfirm = orders.filter((o) => o.orderId === options.orderId);
    }
    engine.replayOrders(ordersToConfirm);
    let confirmed = 0;
    for (const result of engine.getResults()) {
        for (const gift of result.recommendedGifts) {
            if (gift.status === 'pending') {
                if (options.giftSku && gift.giftSku !== options.giftSku) {
                    continue;
                }
                const success = engine.confirmReservation(result.orderId, gift.giftSku, gift.quantity, gift.sourceRuleId);
                if (success) {
                    gift.status = 'granted';
                    confirmed++;
                    console.log(`✓ 已确认: 订单 ${result.orderId} - ${gift.giftName} x${gift.quantity}`);
                }
                else {
                    console.log(`✗ 确认失败: 订单 ${result.orderId} - ${gift.giftName}`);
                }
            }
        }
    }
    const state = engine.getReplayState();
    saveReplayState(state);
    console.log(`\n共确认 ${confirmed} 个赠品`);
});
program
    .command('export')
    .description('导出回放报告')
    .option('--format <format>', '导出格式: csv 或 json', 'csv')
    .option('--type <type>', '报告类型: result 或 diff', 'result')
    .option('--output <output>', '输出文件名')
    .action((options) => {
    ensureDirs();
    const rules = loadRules();
    const orders = loadOrders();
    const inventory = loadInventory();
    const existingState = loadReplayState();
    const matcher = new RuleMatcher_1.RuleMatcher(rules);
    const inventoryManager = new InventoryManager_1.InventoryManager(inventory, existingState?.grants || []);
    const engine = new ReplayEngine_1.ReplayEngine(matcher, inventoryManager);
    engine.replayOrders(orders);
    const config = {
        includeConflicts: true,
        includeExplanations: true,
        format: options.format,
    };
    const exportService = new ExportService_1.ExportService(config);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const ext = options.format === 'json' ? 'json' : 'csv';
    const fileName = options.output || `gift-${options.type}-${timestamp}.${ext}`;
    const outputPath = (0, path_1.join)(OUTPUT_DIR, fileName);
    if (options.type === 'diff') {
        const diffs = orders.map((o) => engine.getDiff(o));
        const path = exportService.exportDiffReports(diffs, outputPath);
        console.log(`差异报告已导出: ${path}`);
    }
    else {
        const path = exportService.exportReplayResults(engine.getResults(), outputPath);
        console.log(`回放报告已导出: ${path}`);
    }
});
program
    .command('reset')
    .description('重置回放状态')
    .action(() => {
    ensureDirs();
    const statePath = (0, path_1.join)(OUTPUT_DIR, 'replay-state.json');
    if ((0, fs_1.existsSync)(statePath)) {
        const state = JSON.parse((0, fs_1.readFileSync)(statePath, 'utf-8'));
        state.grants = [];
        state.processedOrders = [];
        saveReplayState(state);
        console.log('回放状态已重置，库存占用记录已清除');
    }
    else {
        console.log('没有回放状态需要重置');
    }
});
program.parse(process.argv);
//# sourceMappingURL=index.js.map