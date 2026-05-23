"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.readVisitFile = readVisitFile;
exports.readChannelFile = readChannelFile;
// @ts-ignore
const XLSX = require('xlsx');
const phone_1 = require("../utils/phone");
const columnMatcher_1 = require("../utils/columnMatcher");
const chalk_1 = __importDefault(require("chalk"));
function readVisitFile(filePath) {
    console.log(chalk_1.default.blue(`📖 正在读取来访表: ${filePath}`));
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    if (data.length < 2) {
        throw new Error('来访表数据为空或只有表头');
    }
    const headers = data[0].map(h => String(h || '').trim());
    const records = [];
    const badRecords = [];
    const phoneColumn = (0, columnMatcher_1.findColumnByConfig)(headers, '电话');
    if (!phoneColumn) {
        throw new Error('来访表中未找到电话列，请检查文件格式或使用 --phone-column 指定');
    }
    for (let i = 1; i < data.length; i++) {
        const rowData = data[i];
        const row = {};
        headers.forEach((header, idx) => {
            row[header] = rowData[idx];
        });
        const rawPhone = String(row[phoneColumn] || '').trim();
        const normalizedPhone = (0, phone_1.normalizePhone)(rawPhone);
        if (!rawPhone || !(0, phone_1.isValidPhone)(normalizedPhone)) {
            badRecords.push({
                来源文件: '来访表',
                原始行号: i + 1,
                错误原因: !rawPhone ? '电话为空' : '电话格式无效',
                原始数据: row
            });
            continue;
        }
        const record = {
            原始行号: i + 1,
            客户电话: rawPhone,
            归一化电话: normalizedPhone,
            客户姓名: (0, columnMatcher_1.getColumnValue)(row, headers, '客户姓名'),
            来访日期: (0, columnMatcher_1.getColumnValue)(row, headers, '来访日期'),
            置业顾问: (0, columnMatcher_1.getColumnValue)(row, headers, '置业顾问'),
            渠道名称: (0, columnMatcher_1.getColumnValue)(row, headers, '渠道名称'),
            认领状态: (0, columnMatcher_1.getColumnValue)(row, headers, '认领状态'),
            ...row
        };
        records.push(record);
    }
    console.log(chalk_1.default.green(`  ✅ 来访表读取完成: 共 ${data.length - 1} 行，有效 ${records.length} 条`));
    return {
        records,
        badRecords,
        totalCount: data.length - 1
    };
}
function readChannelFile(filePath) {
    console.log(chalk_1.default.blue(`📖 正在读取渠道表: ${filePath}`));
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    if (data.length < 2) {
        throw new Error('渠道表数据为空或只有表头');
    }
    const headers = data[0].map(h => String(h || '').trim());
    const records = [];
    const badRecords = [];
    const phoneColumn = (0, columnMatcher_1.findColumnByConfig)(headers, '电话');
    const channelColumn = (0, columnMatcher_1.findColumnByConfig)(headers, '渠道名称');
    if (!phoneColumn) {
        throw new Error('渠道表中未找到电话列，请检查文件格式或使用 --phone-column 指定');
    }
    for (let i = 1; i < data.length; i++) {
        const rowData = data[i];
        const row = {};
        headers.forEach((header, idx) => {
            row[header] = rowData[idx];
        });
        const rawPhone = String(row[phoneColumn] || '').trim();
        const normalizedPhone = (0, phone_1.normalizePhone)(rawPhone);
        const channelName = channelColumn ? String(row[channelColumn] || '').trim() : '未知渠道';
        if (!rawPhone || !(0, phone_1.isValidPhone)(normalizedPhone)) {
            badRecords.push({
                来源文件: '渠道表',
                原始行号: i + 1,
                错误原因: !rawPhone ? '电话为空' : '电话格式无效',
                原始数据: row
            });
            continue;
        }
        if (!channelName) {
            badRecords.push({
                来源文件: '渠道表',
                原始行号: i + 1,
                错误原因: '渠道名称为空',
                原始数据: row
            });
            continue;
        }
        const record = {
            原始行号: i + 1,
            客户电话: rawPhone,
            归一化电话: normalizedPhone,
            客户姓名: (0, columnMatcher_1.getColumnValue)(row, headers, '客户姓名'),
            渠道名称: channelName,
            置业顾问: (0, columnMatcher_1.getColumnValue)(row, headers, '置业顾问'),
            认领状态: (0, columnMatcher_1.getColumnValue)(row, headers, '认领状态'),
            ...row
        };
        records.push(record);
    }
    console.log(chalk_1.default.green(`  ✅ 渠道表读取完成: 共 ${data.length - 1} 行，有效 ${records.length} 条`));
    return {
        records,
        badRecords,
        totalCount: data.length - 1
    };
}
