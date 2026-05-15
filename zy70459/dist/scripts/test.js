"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const validationService_1 = __importDefault(require("../services/validationService"));
const queryService_1 = __importDefault(require("../services/queryService"));
const summaryService_1 = __importDefault(require("../services/summaryService"));
const database_1 = require("../database");
const runTests = async () => {
    console.log('=== 开始测试冻结窗口校验服务 ===\n');
    console.log('1. 初始化数据库...');
    (0, database_1.initDatabase)();
    console.log('   ✓ 数据库初始化成功\n');
    console.log('2. 测试冻结窗口检查...');
    const now = new Date();
    const { inWindow, windowType } = validationService_1.default.isInFreezeWindow(now);
    console.log(`   当前时间: ${now.toLocaleString()}`);
    console.log(`   窗口类型: ${windowType}`);
    console.log(`   是否在窗口内: ${inWindow ? '是' : '否'}`);
    console.log('   ✓ 冻结窗口检查完成\n');
    console.log('3. 测试样本查询...');
    const queryResult = await queryService_1.default.queryByBusinessNo('LAB20240515001');
    console.log(`   业务单号: ${queryResult.businessNo}`);
    console.log(`   状态: ${queryResult.status}`);
    console.log('   ✓ 样本查询完成\n');
    console.log('4. 测试失败记录查询...');
    const failures = await queryService_1.default.getFailureRecords({ pageSize: 5 });
    console.log(`   总失败数: ${failures.total}`);
    failures.items.forEach((f, i) => {
        console.log(`   ${i + 1}. ${f.businessNo} - ${f.failureType}`);
    });
    console.log('   ✓ 失败记录查询完成\n');
    console.log('5. 测试异常样本查询...');
    const anomalies = await queryService_1.default.getAnomalySamples({ pageSize: 5 });
    console.log(`   总异常样本数: ${anomalies.total}`);
    anomalies.items.forEach((a, i) => {
        console.log(`   ${i + 1}. ${a.businessNo} - ${a.anomalyType}`);
    });
    console.log('   ✓ 异常样本查询完成\n');
    console.log('6. 测试摘要生成...');
    const summary = await summaryService_1.default.generateSummary();
    console.log(`   总样本数: ${summary.statistics.total}`);
    console.log(`   成功数: ${summary.statistics.successCount}`);
    console.log(`   失败数: ${summary.statistics.failedCount}`);
    console.log(`   含网关错误数: ${summary.statistics.hasGatewayError}`);
    console.log(`   异常样本数: ${summary.statistics.anomalyCount}`);
    console.log('   ✓ 摘要生成完成\n');
    console.log('7. 测试错误统计...');
    const errorStats = await summaryService_1.default.getErrorStatistics();
    console.log('   按错误类型统计:');
    Object.entries(errorStats.byErrorType).forEach(([type, count]) => {
        console.log(`     ${type}: ${count}`);
    });
    console.log('   按科室统计:');
    Object.entries(errorStats.byDepartment).forEach(([dept, stats]) => {
        console.log(`     ${dept}: 总数 ${stats.total}, 失败数 ${stats.failed}`);
    });
    console.log('   ✓ 错误统计完成\n');
    console.log('8. 测试摘要报告生成...');
    const report = await summaryService_1.default.generateSummaryReport(['LAB20240515001', 'LAB20240515005']);
    console.log(`   报告长度: ${report.length} 字符`);
    console.log('   ✓ 摘要报告生成完成\n');
    (0, database_1.closeDb)();
    console.log('=== 所有测试通过! ===');
};
runTests().catch(console.error);
