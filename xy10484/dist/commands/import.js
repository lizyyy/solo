"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerImportCommand = registerImportCommand;
const path_1 = __importDefault(require("path"));
const parser_1 = require("../utils/parser");
const importer_1 = require("../core/importer");
const store_1 = require("../utils/store");
function registerImportCommand(program) {
    program
        .command('import')
        .description('导入数据文件')
        .option('-o, --orders <file>', '订单数据文件 (JSON/CSV)')
        .option('-s, --sign-records <file>', '签收记录文件 (JSON/CSV)')
        .option('-r, --refuse-records <file>', '拒收记录文件 (JSON/CSV)')
        .option('-c, --claim-records <file>', '赔付记录文件 (JSON/CSV)')
        .option('--no-analyze', '导入后不运行异常分析')
        .action(async (options) => {
        (0, store_1.ensureStore)();
        let ordersImported = 0;
        let signRecordsImported = 0;
        let refuseRecordsImported = 0;
        let claimRecordsImported = 0;
        let duplicateBatches = [];
        if (options.orders) {
            const orders = (0, parser_1.parseOrders)(path_1.default.resolve(options.orders));
            ordersImported = (0, importer_1.importOrders)(orders);
            console.log(`导入订单: ${ordersImported} 条`);
        }
        if (options.signRecords) {
            const records = (0, parser_1.parseSignRecords)(path_1.default.resolve(options.signRecords));
            const result = (0, importer_1.importSignRecords)(records);
            signRecordsImported = result.imported;
            duplicateBatches = result.duplicateBatches;
            console.log(`导入签收记录: ${signRecordsImported} 条`);
            if (duplicateBatches.length > 0) {
                console.log(`跳过重复批次: ${duplicateBatches.join(', ')}`);
            }
        }
        if (options.refuseRecords) {
            const records = (0, parser_1.parseRefuseRecords)(path_1.default.resolve(options.refuseRecords));
            refuseRecordsImported = (0, importer_1.importRefuseRecords)(records);
            console.log(`导入拒收记录: ${refuseRecordsImported} 条`);
        }
        if (options.claimRecords) {
            const records = (0, parser_1.parseClaimRecords)(path_1.default.resolve(options.claimRecords));
            claimRecordsImported = (0, importer_1.importClaimRecords)(records);
            console.log(`导入赔付记录: ${claimRecordsImported} 条`);
        }
        if (options.analyze !== false) {
            console.log('\n正在分析异常...');
            const analysisResult = (0, importer_1.runAnalysis)();
            console.log(`发现新异常: ${analysisResult.newAbnormals} 条`);
            console.log(`发现新问题: ${analysisResult.newIssues} 条`);
        }
        console.log('\n导入完成！');
    });
}
