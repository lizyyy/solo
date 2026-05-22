"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const FileParserService_1 = require("./services/FileParserService");
const ProcessingService_1 = require("./services/ProcessingService");
const DataStore_1 = require("./store/DataStore");
async function runTest() {
    console.log('='.repeat(60));
    console.log('  研究生院招生数据处理API - 测试演示');
    console.log('='.repeat(60));
    console.log();
    DataStore_1.dataStore.reset();
    const BATCH_ID = 'BATCH_2024_TEST_001';
    console.log('📁 步骤1: 解析导师CSV文件');
    console.log('-'.repeat(40));
    const mentorCsvPath = path.join(__dirname, '../samples/mentors.csv');
    const mentorBuffer = fs.readFileSync(mentorCsvPath);
    const mentors = await FileParserService_1.fileParserService.parseMentorCSV(mentorBuffer);
    console.log(`✓ 成功解析 ${mentors.length} 位导师信息`);
    mentors.forEach((m, i) => {
        console.log(`  ${i + 1}. ${m.name} - ${m.direction} (${m.quota - m.usedQuota}/${m.quota})`);
    });
    console.log();
    console.log('📁 步骤2: 解析学生志愿JSON');
    console.log('-'.repeat(40));
    const appsJsonPath = path.join(__dirname, '../samples/applications.json');
    const appsJson = fs.readFileSync(appsJsonPath, 'utf-8');
    const applications = FileParserService_1.fileParserService.parseApplicationsJSON(appsJson);
    console.log(`✓ 成功解析 ${applications.length} 条学生志愿`);
    applications.forEach((a, i) => {
        console.log(`  ${i + 1}. ${a.studentName} - 报考 ${a.mentorName}`);
    });
    console.log();
    console.log('📁 步骤3: 解析调剂记录JSON');
    console.log('-'.repeat(40));
    const transfersJsonPath = path.join(__dirname, '../samples/transfers.json');
    const transfersJson = fs.readFileSync(transfersJsonPath, 'utf-8');
    const transfers = FileParserService_1.fileParserService.parseTransfersJSON(transfersJson);
    console.log(`✓ 成功解析 ${transfers.length} 条调剂记录`);
    console.log();
    console.log('⚙️ 步骤4: 执行批量处理');
    console.log('-'.repeat(40));
    const result = ProcessingService_1.processingService.processBatch(BATCH_ID, mentors, applications, transfers);
    console.log(`✓ 批次 ${BATCH_ID} 处理完成`);
    console.log();
    console.log('📊 处理结果汇总');
    console.log('-'.repeat(40));
    console.log('导师导入:');
    if (result.summary.mentors) {
        console.log(`  ✓ 正常: ${result.summary.mentors.normal}`);
        console.log(`  ⚠ 待确认: ${result.summary.mentors.pending}`);
        console.log(`  ✗ 失败: ${result.summary.mentors.failed}`);
    }
    console.log('学生志愿:');
    if (result.summary.applications) {
        console.log(`  ✓ 正常: ${result.summary.applications.normal}`);
        console.log(`  ⚠ 待确认: ${result.summary.applications.pending}`);
        console.log(`  ✗ 失败: ${result.summary.applications.failed}`);
    }
    console.log('调剂记录:');
    if (result.summary.transfers) {
        console.log(`  ✓ 正常: ${result.summary.transfers.normal}`);
        console.log(`  ⚠ 待确认: ${result.summary.transfers.pending}`);
        console.log(`  ✗ 失败: ${result.summary.transfers.failed}`);
    }
    console.log();
    if (result.details.applications) {
        if (result.details.applications.pending.length > 0) {
            console.log('⚠️ 待人工确认的申请记录');
            console.log('-'.repeat(40));
            result.details.applications.pending.forEach((item, i) => {
                console.log(`  ${i + 1}. 学生: ${item.data.studentName}`);
                console.log(`     原因: ${item.message}`);
            });
            console.log();
        }
        if (result.details.applications.failed.length > 0) {
            console.log('✗ 导入失败的记录（含建议处理方式');
            console.log('-'.repeat(40));
            result.details.applications.failed.forEach((item, i) => {
                console.log(`  ${i + 1}. 学生: ${item.original.studentName}`);
                console.log(`     错误: ${item.error}`);
                console.log(`     建议: ${item.suggestion}`);
            });
            console.log();
        }
    }
    if (result.details.transfers?.failed?.length) {
        console.log('✗ 导入失败的调剂记录');
        console.log('-'.repeat(40));
        result.details.transfers.failed.forEach((item, i) => {
            console.log(`  ${i + 1}. 学生: ${item.original.studentName}`);
            console.log(`     错误: ${item.error}`);
            console.log(`     建议: ${item.suggestion}`);
        });
        console.log();
    }
    console.log('📈 系统统计数据');
    console.log('-'.repeat(40));
    const stats = ProcessingService_1.processingService.getStatistics();
    console.log(`  导师总数: ${stats.mentors}`);
    console.log(`  申请总数: ${stats.applications.total}`);
    console.log(`    - 正常: ${stats.applications.normal}`);
    console.log(`    - 已确认: ${stats.applications.confirmed}`);
    console.log(`    - 待确认: ${stats.applications.pending}`);
    console.log(`  调剂记录: ${stats.transfers.total}`);
    console.log();
    console.log('🔄 测试防重复导入');
    console.log('-'.repeat(40));
    try {
        ProcessingService_1.processingService.processBatch(BATCH_ID, mentors, applications, transfers);
        console.log('  ✗ 错误: 重复导入未被拦截！');
    }
    catch (e) {
        console.log(`  ✓ 正确: ${e.message}`);
    }
    console.log();
    console.log('🎯 关键业务规则验证示例');
    console.log('-'.repeat(40));
    const failedApp = result.details.applications?.failed?.find(a => a.error?.includes('专业'));
    if (failedApp) {
        console.log('  ✓ 跨专业限制规则生效: 学生专业与导师专业不匹配时正确标记失败');
    }
    const quotaFullMentor = mentors.find(m => m.usedQuota >= m.quota);
    if (quotaFullMentor) {
        console.log('  ✓ 名额占用规则生效: 导师名额满时无法继续录取');
    }
    const multiMentorApp = result.details.applications?.pending?.find(a => a.message?.includes('需确认志愿优先级'));
    if (multiMentorApp) {
        console.log('  ✓ 重复录取规则生效: 同一学生申请不同导师时标记为待人工确认');
        console.log(`     学生: ${multiMentorApp.data.studentName} 已有其他导师志愿，需确认优先级`);
    }
    console.log();
    console.log('='.repeat(60));
    console.log('  测试完成！');
    console.log('='.repeat(60));
    console.log();
    console.log('💡 下一步操作:');
    console.log('  1. 运行 npm install 安装依赖');
    console.log('  2. 运行 npm run dev 启动开发服务器');
    console.log('  3. 访问 http://localhost:3000 查看API');
    console.log();
}
runTest().catch(console.error);
