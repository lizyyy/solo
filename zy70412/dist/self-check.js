#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const schema_diff_1 = require("./schema-diff");
const logistics_processor_1 = require("./logistics-processor");
const result_store_1 = require("./result-store");
const batch_processor_1 = require("./batch-processor");
const uuid_1 = require("uuid");
const fs_extra_1 = __importDefault(require("fs-extra"));
const chalk_1 = __importDefault(require("chalk"));
let passed = 0;
let failed = 0;
function test(name, fn) {
    try {
        fn();
        console.log(chalk_1.default.green(`✓ ${name}`));
        passed++;
    }
    catch (e) {
        console.log(chalk_1.default.red(`✗ ${name}`));
        console.log(chalk_1.default.red(`  Error: ${e.message}`));
        failed++;
    }
}
function assertEqual(actual, expected, message) {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(`${message || 'Assertion failed'}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    }
}
function assert(condition, message) {
    if (!condition) {
        throw new Error(message || 'Assertion failed');
    }
}
function assertExists(value, message) {
    if (value === undefined || value === null) {
        throw new Error(message || 'Expected value to exist');
    }
}
async function runSelfCheck() {
    console.log(chalk_1.default.blue('='.repeat(60)));
    console.log(chalk_1.default.blue.bold('JSON Schema Diff - 自检脚本'));
    console.log(chalk_1.default.blue('='.repeat(60)));
    console.log();
    console.log(chalk_1.default.yellow('1. Schema 差异比较测试'));
    console.log(chalk_1.default.yellow('-'.repeat(40)));
    const differ = new schema_diff_1.SchemaDiffer();
    test('检测新增字段', () => {
        const diffs = differ.compare({ a: 1 }, { a: 1, b: 2 });
        assertEqual(diffs.length, 1);
        assertEqual(diffs[0].type, 'added');
        assertEqual(diffs[0].path, 'b');
    });
    test('检测删除字段', () => {
        const diffs = differ.compare({ a: 1, b: 2 }, { a: 1 });
        assertEqual(diffs.length, 1);
        assertEqual(diffs[0].type, 'removed');
    });
    test('检测修改字段', () => {
        const diffs = differ.compare({ a: 1 }, { a: 2 });
        assertEqual(diffs.length, 1);
        assertEqual(diffs[0].type, 'modified');
    });
    test('检测嵌套差异', () => {
        const diffs = differ.compare({ a: { b: 1, c: 2 } }, { a: { b: 2, d: 3 } });
        assert(diffs.length >= 2);
    });
    test('hasCriticalDiffs 检测关键差异', () => {
        const removedDiffs = differ.compare({ a: 1 }, {});
        assert(differ.hasCriticalDiffs(removedDiffs) === true);
        const addedDiffs = differ.compare({}, { a: 1 });
        assert(differ.hasCriticalDiffs(addedDiffs) === false);
    });
    test('summarizeDiffs 差异摘要', () => {
        const diffs = differ.compare({ a: 1, b: 2 }, { a: 2, c: 3 });
        const summary = differ.summarizeDiffs(diffs);
        assertEqual(summary.minor.length, 2);
    });
    console.log();
    console.log(chalk_1.default.yellow('2. 物流处理器测试'));
    console.log(chalk_1.default.yellow('-'.repeat(40)));
    const processor = new logistics_processor_1.LogisticsProcessor();
    const validItem = {
        id: (0, uuid_1.v4)(),
        orderId: 'TEST001',
        waybillNo: 'SFTEST001',
        status: 'intercepted',
        interceptionTime: new Date().toISOString(),
        reason: '测试',
        grayRelease: true,
        compensationActions: [
            { id: (0, uuid_1.v4)(), name: '退款', description: '', required: true, executed: true },
            { id: (0, uuid_1.v4)(), name: '优惠券', description: '', required: true, executed: true }
        ]
    };
    test('验证有效的拦截记录', () => {
        const referenceSchema = {
            status: 'intercepted',
            grayRelease: true,
            hasCompensationActions: true,
            allCompensationsExecuted: true,
            requiredCompensationsCount: 2
        };
        const result = processor.validateInterception(validItem, referenceSchema);
        assert(result.valid === true);
    });
    test('检测补偿动作缺失', () => {
        const item = {
            ...validItem,
            id: (0, uuid_1.v4)(),
            compensationActions: [
                { id: (0, uuid_1.v4)(), name: '退款', description: '', required: true, executed: true },
                { id: (0, uuid_1.v4)(), name: '优惠券', description: '', required: true, executed: false }
            ]
        };
        const referenceSchema = {
            status: 'intercepted',
            grayRelease: true,
            hasCompensationActions: true,
            allCompensationsExecuted: true,
            requiredCompensationsCount: 2
        };
        const result = processor.validateInterception(item, referenceSchema);
        assert(result.valid === false);
        assertExists(result.failedPath);
        assert(result.failedPath.includes('COMPENSATION_MISSING'));
        assert(result.missingCompensations.length === 1);
    });
    test('检测灰度发布失败', () => {
        const item = {
            ...validItem,
            id: (0, uuid_1.v4)(),
            status: 'failed'
        };
        const referenceSchema = {
            status: 'intercepted',
            grayRelease: true,
            hasCompensationActions: true,
            allCompensationsExecuted: true,
            requiredCompensationsCount: 2
        };
        const result = processor.validateInterception(item, referenceSchema);
        assert(result.valid === false);
        assertExists(result.failedPath);
        assert(result.failedPath.includes('GRAY_RELEASE_FAILED'));
    });
    test('检测拦截时间缺失', () => {
        const item = {
            ...validItem,
            id: (0, uuid_1.v4)(),
            interceptionTime: undefined
        };
        const referenceSchema = {
            status: 'intercepted',
            grayRelease: true,
            hasCompensationActions: true,
            allCompensationsExecuted: true,
            requiredCompensationsCount: 2
        };
        const result = processor.validateInterception(item, referenceSchema);
        assert(result.valid === false);
        assertExists(result.failedPath);
        assert(result.failedPath.includes('INTERCEPTION_TIME_MISSING'));
    });
    test('批量预览功能', () => {
        const items = [
            validItem,
            { ...validItem, id: (0, uuid_1.v4)(), status: 'failed' }
        ];
        const preview = processor.createPreview(items);
        assertEqual(preview.totalCount, 2);
        assertExists(preview.failureGroups['GRAY_RELEASE_FAILED']);
    });
    test('失败分组功能', () => {
        const items = [
            validItem,
            { ...validItem, id: (0, uuid_1.v4)(), status: 'failed' }
        ];
        const groups = processor.groupByFailure(items);
        assertExists(groups['GRAY_RELEASE_FAILED']);
        assertExists(groups['SUCCESS']);
    });
    console.log();
    console.log(chalk_1.default.yellow('3. 结果存储测试'));
    console.log(chalk_1.default.yellow('-'.repeat(40)));
    const testDataDir = './test-data-' + Date.now();
    const store = new result_store_1.ResultStore(testDataDir);
    test('存储结果', () => {
        const result = store.storeResult({
            batchId: (0, uuid_1.v4)(),
            itemId: (0, uuid_1.v4)(),
            orderId: 'TEST001',
            waybillNo: 'SFTEST001',
            status: 'failed',
            schemaDiffs: [],
            failureReason: '测试失败',
            failureGroup: 'TEST_GROUP',
            lakehousePartition: 'date=2024-01-01/gray=true'
        });
        assert(result.id !== undefined);
        assertEqual(result.orderId, 'TEST001');
    });
    test('查找之前的结果', () => {
        const found = store.findPreviousResult('TEST001', []);
        assert(found !== null);
        assertEqual(found?.orderId, 'TEST001');
    });
    test('添加人工备注', () => {
        const result = store.storeResult({
            batchId: (0, uuid_1.v4)(),
            itemId: (0, uuid_1.v4)(),
            orderId: 'TEST002',
            waybillNo: 'SFTEST002',
            status: 'failed',
            schemaDiffs: []
        });
        const updated = store.addHumanRemark(result.id, '已人工审核通过', 'admin');
        assert(updated !== null);
        assertEqual(updated?.humanRemarks, '已人工审核通过');
    });
    test('加载失败项', () => {
        const failures = store.loadFailures();
        assert(failures.length >= 2);
    });
    test('按分组过滤失败项', () => {
        const failures = store.getFailuresByGroup('TEST_GROUP');
        assertEqual(failures.length, 1);
    });
    test('湖仓分区管理', () => {
        store.addPartitions([{
                name: 'date=2024-01-01/gray=true',
                date: '2024-01-01',
                region: 'cn',
                recordCount: 100
            }]);
        const partitions = store.getPartitions();
        assertEqual(partitions.length, 1);
        const confirmed = store.confirmPartition('date=2024-01-01/gray=true', 'admin');
        assert(confirmed?.humanConfirmed === true);
    });
    test('获取未确认分区', () => {
        store.addPartitions([{
                name: 'date=2024-01-02/gray=true',
                date: '2024-01-02',
                region: 'cn',
                recordCount: 50
            }]);
        const unconfirmed = store.getUnconfirmedPartitions();
        assert(unconfirmed.length === 1);
    });
    console.log();
    console.log(chalk_1.default.yellow('4. 批量处理器测试'));
    console.log(chalk_1.default.yellow('-'.repeat(40)));
    const batchStore = new result_store_1.ResultStore(testDataDir + '-batch');
    const batchProcessor = new batch_processor_1.BatchProcessor(batchStore);
    test('批量预览', () => {
        const items = [validItem];
        const result = batchProcessor.preview(items);
        assertEqual(result.previewMode, true);
        assertEqual(result.totalCount, 1);
    });
    test('批量执行', () => {
        const items = [validItem];
        const result = batchProcessor.execute(items, 'tester', true);
        assertEqual(result.previewMode, false);
        assert(result.batchId !== undefined);
    });
    test('结果复用 - 相同内容再次提交', () => {
        const items = [validItem];
        const result1 = batchProcessor.execute(items, 'tester', true);
        const result2 = batchProcessor.execute(items, 'tester', true);
        assertEqual(result2.skippedCount, 1);
    });
    console.log();
    console.log(chalk_1.default.blue('='.repeat(60)));
    console.log(chalk_1.default.blue.bold('测试结果汇总'));
    console.log(chalk_1.default.blue('='.repeat(60)));
    console.log(`通过: ${chalk_1.default.green(passed)}`);
    console.log(`失败: ${chalk_1.default.red(failed)}`);
    console.log(`总计: ${passed + failed}`);
    if (failed > 0) {
        console.log();
        console.log(chalk_1.default.red.bold('❌ 存在测试失败，请检查代码！'));
        process.exit(1);
    }
    else {
        console.log();
        console.log(chalk_1.default.green.bold('✓ 所有测试通过！'));
    }
    await fs_extra_1.default.remove(testDataDir);
    await fs_extra_1.default.remove(testDataDir + '-batch');
    console.log();
}
runSelfCheck().catch(console.error);
