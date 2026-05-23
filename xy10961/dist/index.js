"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const parser_1 = require("./cli/parser");
const reader_1 = require("./io/reader");
const merger_1 = require("./core/merger");
const writer_1 = require("./io/writer");
const chalk_1 = __importDefault(require("chalk"));
async function main() {
    try {
        console.log(chalk_1.default.cyan('\n' + '='.repeat(60)));
        console.log(chalk_1.default.cyan('🏢 售楼处来访合并工具'));
        console.log(chalk_1.default.cyan('='.repeat(60)));
        const options = (0, parser_1.parseCLIArgs)();
        const visitResult = (0, reader_1.readVisitFile)(options.来访表路径);
        const channelResult = (0, reader_1.readChannelFile)(options.渠道表路径);
        const allBadRecords = [...visitResult.badRecords, ...channelResult.badRecords];
        const result = (0, merger_1.mergeData)(visitResult.records, channelResult.records, allBadRecords, visitResult.totalCount, channelResult.totalCount);
        (0, writer_1.writeOutput)(result, options.输出目录);
    }
    catch (error) {
        console.error(chalk_1.default.red('\n❌ 程序运行出错:'));
        console.error(chalk_1.default.red(`  ${error.message}`));
        console.error(chalk_1.default.gray('\n  请检查输入文件格式和路径是否正确\n'));
        process.exit(1);
    }
}
main();
