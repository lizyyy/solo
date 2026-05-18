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
const os = __importStar(require("os"));
const iconv = __importStar(require("iconv-lite"));
const FileImporter_1 = require("../src/importer/FileImporter");
describe('FileImporter', () => {
    let tempDir;
    let importer;
    beforeEach(() => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shuttle-test-'));
        importer = new FileImporter_1.FileImporter();
    });
    afterEach(() => {
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true });
        }
    });
    const createTestFile = (filename, content) => {
        const filePath = path.join(tempDir, filename);
        fs.writeFileSync(filePath, content, 'utf8');
        return filePath;
    };
    describe('正常导入测试', () => {
        it('应该正确导入有效的CSV文件', () => {
            const csvContent = `员工编号,姓名,部门,手机号,线路名称,上车点
E001,张三,技术部,13800138001,1号线,公司大门
E002,李四,行政部,13800138002,2号线,科技园区`;
            const filePath = createTestFile('valid.csv', csvContent);
            const result = importer.importFile(filePath);
            expect(result.records.length).toBe(2);
            expect(result.records[0].employeeId).toBe('E001');
            expect(result.records[0].employeeName).toBe('张三');
            expect(result.records[0].phone).toBe('13800138001');
            expect(result.records[0].routeName).toBe('1号线');
        });
        it('应该支持不同的列名映射', () => {
            const csvContent = `工号,姓名,手机号,线路
E001,张三,13800138001,1号线`;
            const filePath = createTestFile('alt-columns.csv', csvContent);
            const result = importer.importFile(filePath);
            expect(result.records.length).toBe(1);
            expect(result.records[0].employeeId).toBe('E001');
        });
        it('应该处理可选列缺失的情况', () => {
            const csvContent = `员工编号,姓名,手机号,线路名称
E001,张三,13800138001,1号线`;
            const filePath = createTestFile('missing-optional.csv', csvContent);
            const result = importer.importFile(filePath);
            expect(result.records.length).toBe(1);
            expect(result.records[0].department).toBe('');
            expect(result.records[0].boardingPoint).toBe('');
        });
    });
    describe('缺列测试', () => {
        it('缺少员工编号列时应该抛出错误', () => {
            const csvContent = `姓名,手机号,线路名称
张三,13800138001,1号线`;
            const filePath = createTestFile('missing-employee-id.csv', csvContent);
            expect(() => importer.importFile(filePath)).toThrow(FileImporter_1.ColumnMappingError);
            expect(() => importer.importFile(filePath)).toThrow('缺少必要的列');
        });
        it('缺少姓名列时应该抛出错误', () => {
            const csvContent = `员工编号,手机号,线路名称
E001,13800138001,1号线`;
            const filePath = createTestFile('missing-name.csv', csvContent);
            expect(() => importer.importFile(filePath)).toThrow(FileImporter_1.ColumnMappingError);
        });
        it('缺少手机号列时应该抛出错误', () => {
            const csvContent = `员工编号,姓名,线路名称
E001,张三,1号线`;
            const filePath = createTestFile('missing-phone.csv', csvContent);
            expect(() => importer.importFile(filePath)).toThrow(FileImporter_1.ColumnMappingError);
        });
        it('缺少线路名称列时应该抛出错误', () => {
            const csvContent = `员工编号,姓名,手机号
E001,张三,13800138001`;
            const filePath = createTestFile('missing-route.csv', csvContent);
            expect(() => importer.importFile(filePath)).toThrow(FileImporter_1.ColumnMappingError);
        });
    });
    describe('空文件测试', () => {
        it('空文件应该抛出FileImportError', () => {
            const filePath = createTestFile('empty.csv', '');
            expect(() => importer.importFile(filePath)).toThrow(FileImporter_1.FileImportError);
            expect(() => importer.importFile(filePath)).toThrow('文件为空');
        });
        it('只有表头没有数据的文件应该正常导入但记录数为0', () => {
            const csvContent = `员工编号,姓名,手机号,线路名称`;
            const filePath = createTestFile('only-header.csv', csvContent);
            const result = importer.importFile(filePath);
            expect(result.records.length).toBe(0);
        });
    });
    describe('无效记录测试', () => {
        it('应该正确识别缺少必要信息的行', () => {
            const csvContent = `员工编号,姓名,手机号,线路名称
E001,张三,13800138001,1号线
,,,"`;
            const filePath = createTestFile('invalid-rows.csv', csvContent);
            const result = importer.importFile(filePath);
            expect(result.records.length).toBe(1);
            expect(result.invalidRecords.length).toBeGreaterThan(0);
        });
        it('应该标记线路名称为空的记录为无效', () => {
            const csvContent = `员工编号,姓名,手机号,线路名称
E001,张三,13800138001,
E002,李四,13800138002,2号线`;
            const filePath = createTestFile('missing-route-value.csv', csvContent);
            const result = importer.importFile(filePath);
            expect(result.records.length).toBe(1);
            expect(result.invalidRecords.length).toBe(1);
            expect(result.invalidRecords[0].errors).toContain('线路名称不能为空');
        });
    });
    describe('编码测试', () => {
        it('应该支持UTF-8编码文件', () => {
            const csvContent = `员工编号,姓名,手机号,线路名称
E001,张三,13800138001,1号线`;
            const filePath = createTestFile('utf8.csv', csvContent);
            const result = importer.importFile(filePath, { encoding: 'UTF-8' });
            expect(result.records.length).toBe(1);
            expect(result.records[0].employeeName).toBe('张三');
        });
        it('应该支持GBK编码文件', () => {
            const csvContent = `员工编号,姓名,手机号,线路名称
E001,张三,13800138001,1号线`;
            const filePath = path.join(tempDir, 'gbk.csv');
            const gbkBuffer = iconv.encode(csvContent, 'gbk');
            fs.writeFileSync(filePath, gbkBuffer);
            const result = importer.importFile(filePath, { encoding: 'GBK' });
            expect(result.records.length).toBe(1);
            expect(result.records[0].employeeName).toBe('张三');
        });
        it('Auto编码应该能自动检测中文文件', () => {
            const csvContent = `员工编号,姓名,手机号,线路名称
E001,张三,13800138001,1号线`;
            const filePath = path.join(tempDir, 'auto-gbk.csv');
            const gbkBuffer = iconv.encode(csvContent, 'gbk');
            fs.writeFileSync(filePath, gbkBuffer);
            const result = importer.importFile(filePath, { encoding: 'Auto' });
            expect(result.records.length).toBe(1);
            expect(result.records[0].employeeName).toBe('张三');
        });
    });
    describe('批量导入测试', () => {
        it('应该能够导入多个文件', () => {
            const file1 = createTestFile('file1.csv', `员工编号,姓名,手机号,线路名称
E001,张三,13800138001,1号线`);
            const file2 = createTestFile('file2.csv', `员工编号,姓名,手机号,线路名称
E002,李四,13800138002,2号线`);
            const result = importer.importFiles([file1, file2]);
            expect(result.records.length).toBe(2);
            expect(result.fileResults.length).toBe(2);
            expect(result.fileResults.every(fr => fr.success)).toBe(true);
        });
        it('部分文件失败时应该继续处理其他文件', () => {
            const validFile = createTestFile('valid.csv', `员工编号,姓名,手机号,线路名称
E001,张三,13800138001,1号线`);
            const invalidFile = createTestFile('invalid.csv', `姓名,手机号
张三,13800138001`);
            const result = importer.importFiles([validFile, invalidFile]);
            expect(result.records.length).toBe(1);
            expect(result.fileResults.length).toBe(2);
            expect(result.fileResults[0].success).toBe(true);
            expect(result.fileResults[1].success).toBe(false);
            expect(result.fileResults[1].error).toBeDefined();
        });
        it('应该正确处理不存在的文件', () => {
            const validFile = createTestFile('valid.csv', `员工编号,姓名,手机号,线路名称
E001,张三,13800138001,1号线`);
            const nonExistentFile = path.join(tempDir, 'nonexistent.csv');
            const result = importer.importFiles([validFile, nonExistentFile]);
            expect(result.records.length).toBe(1);
            expect(result.fileResults.length).toBe(2);
            expect(result.fileResults[0].success).toBe(true);
            expect(result.fileResults[1].success).toBe(false);
        });
    });
    describe('文件不存在测试', () => {
        it('导入不存在的文件应该抛出FileImportError', () => {
            const nonExistentFile = path.join(tempDir, 'nonexistent.csv');
            expect(() => importer.importFile(nonExistentFile)).toThrow(FileImporter_1.FileImportError);
            expect(() => importer.importFile(nonExistentFile)).toThrow('文件不存在');
        });
    });
});
//# sourceMappingURL=FileImporter.test.js.map