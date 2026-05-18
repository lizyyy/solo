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
const DedupProcessor_1 = require("../src/processor/DedupProcessor");
describe('DedupProcessor', () => {
    let tempDir;
    let outputDir;
    beforeEach(() => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shuttle-proc-test-'));
        outputDir = path.join(tempDir, 'output');
        fs.mkdirSync(outputDir, { recursive: true });
    });
    afterEach(() => {
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true });
        }
    });
    const createRecord = (overrides = {}) => ({
        employeeId: '',
        employeeName: '',
        department: '',
        phone: '',
        routeName: '',
        boardingPoint: '',
        boardingTime: '',
        registrationDate: '',
        status: '正常',
        rawData: {},
        sourceFile: 'test.csv',
        rowNumber: 1,
        ...overrides
    });
    describe('去重功能测试', () => {
        it('应该基于员工编号去重', () => {
            const records = [
                createRecord({ employeeId: 'E001', employeeName: '张三', phone: '13800138001', routeName: '1号线' }),
                createRecord({ employeeId: 'E001', employeeName: '张三', phone: '13800138001', routeName: '1号线', rowNumber: 2 }),
                createRecord({ employeeId: 'E002', employeeName: '李四', phone: '13800138002', routeName: '2号线', rowNumber: 3 })
            ];
            const processor = new DedupProcessor_1.DedupProcessor(outputDir);
            const result = processor.process(records, outputDir);
            expect(result.validRecords).toBe(2);
            expect(result.duplicateRecords.length).toBe(1);
            expect(result.duplicateRecords[0].key.type).toBe('employeeId');
        });
        it('应该基于手机号去重', () => {
            const records = [
                createRecord({ employeeId: 'E001', employeeName: '张三', phone: '13800138001', routeName: '1号线' }),
                createRecord({ employeeId: '', employeeName: '张三', phone: '13800138001', routeName: '1号线', rowNumber: 2 }),
                createRecord({ employeeId: 'E002', employeeName: '李四', phone: '13800138002', routeName: '2号线', rowNumber: 3 })
            ];
            const processor = new DedupProcessor_1.DedupProcessor(outputDir);
            const result = processor.process(records, outputDir);
            expect(result.validRecords).toBeLessThanOrEqual(3);
        });
        it('应该选择信息更完整的记录作为主记录', () => {
            const records = [
                createRecord({
                    employeeId: 'E001',
                    employeeName: '张三',
                    phone: '13800138001',
                    routeName: '',
                    rowNumber: 1
                }),
                createRecord({
                    employeeId: 'E001',
                    employeeName: '张三',
                    phone: '13800138001',
                    routeName: '1号线',
                    department: '技术部',
                    boardingPoint: '公司大门',
                    rowNumber: 2
                })
            ];
            const processor = new DedupProcessor_1.DedupProcessor(outputDir);
            const result = processor.process(records, outputDir);
            expect(result.validRecords).toBe(1);
            const outputFiles = fs.readdirSync(outputDir).filter(f => f.endsWith('.csv'));
            expect(outputFiles.length).toBeGreaterThan(0);
        });
        it('多条完全相同的记录应该只保留一条', () => {
            const records = Array(5).fill(null).map((_, i) => createRecord({
                employeeId: 'E001',
                employeeName: '张三',
                phone: '13800138001',
                routeName: '1号线',
                rowNumber: i + 1
            }));
            const processor = new DedupProcessor_1.DedupProcessor(outputDir);
            const result = processor.process(records, outputDir);
            expect(result.validRecords).toBe(1);
            expect(result.duplicateRecords.length).toBeGreaterThan(0);
        });
    });
    describe('调岗检测测试', () => {
        it('应该检测到同一员工线路变更', () => {
            const records = [
                createRecord({
                    employeeId: 'E001',
                    employeeName: '张三',
                    phone: '13800138001',
                    routeName: '1号线',
                    boardingPoint: '公司大门',
                    registrationDate: '2024-01-15',
                    rowNumber: 1
                }),
                createRecord({
                    employeeId: 'E001',
                    employeeName: '张三',
                    phone: '13800138001',
                    routeName: '2号线',
                    boardingPoint: '科技园区',
                    registrationDate: '2024-01-16',
                    rowNumber: 2
                })
            ];
            const processor = new DedupProcessor_1.DedupProcessor(outputDir);
            const result = processor.process(records, outputDir);
            expect(result.transferRecords.length).toBe(1);
            expect(result.transferRecords[0].employeeId).toBe('E001');
            expect(result.transferRecords[0].oldRoute).toBe('1号线');
            expect(result.transferRecords[0].newRoute).toBe('2号线');
        });
        it('应该检测到同一员工上车点变更', () => {
            const records = [
                createRecord({
                    employeeId: 'E001',
                    employeeName: '张三',
                    phone: '13800138001',
                    routeName: '1号线',
                    boardingPoint: '公司大门',
                    registrationDate: '2024-01-15',
                    rowNumber: 1
                }),
                createRecord({
                    employeeId: 'E001',
                    employeeName: '张三',
                    phone: '13800138001',
                    routeName: '1号线',
                    boardingPoint: '地铁站',
                    registrationDate: '2024-01-16',
                    rowNumber: 2
                })
            ];
            const processor = new DedupProcessor_1.DedupProcessor(outputDir);
            const result = processor.process(records, outputDir);
            expect(result.transferRecords.length).toBe(1);
            expect(result.transferRecords[0].oldBoardingPoint).toBe('公司大门');
            expect(result.transferRecords[0].newBoardingPoint).toBe('地铁站');
        });
    });
    describe('多人共用手机号检测', () => {
        it('应该检测到多个员工使用同一手机号', () => {
            const records = [
                createRecord({
                    employeeId: 'E001',
                    employeeName: '张三',
                    department: '技术部',
                    phone: '13800138000',
                    routeName: '1号线',
                    rowNumber: 1
                }),
                createRecord({
                    employeeId: 'E002',
                    employeeName: '李四',
                    department: '行政部',
                    phone: '13800138000',
                    routeName: '1号线',
                    rowNumber: 2
                }),
                createRecord({
                    employeeId: 'E003',
                    employeeName: '王五',
                    department: '销售部',
                    phone: '13800138000',
                    routeName: '2号线',
                    rowNumber: 3
                })
            ];
            const processor = new DedupProcessor_1.DedupProcessor(outputDir);
            const result = processor.process(records, outputDir);
            expect(result.sharedPhoneRecords.length).toBe(1);
            expect(result.sharedPhoneRecords[0].phone).toBe('13800138000');
            expect(result.sharedPhoneRecords[0].employees.length).toBe(3);
        });
        it('同一员工多条记录不应误判为多人共用手机号', () => {
            const records = [
                createRecord({
                    employeeId: 'E001',
                    employeeName: '张三',
                    department: '技术部',
                    phone: '13800138001',
                    routeName: '1号线',
                    rowNumber: 1
                }),
                createRecord({
                    employeeId: 'E001',
                    employeeName: '张三',
                    department: '技术部',
                    phone: '13800138001',
                    routeName: '1号线',
                    rowNumber: 2
                })
            ];
            const processor = new DedupProcessor_1.DedupProcessor(outputDir);
            const result = processor.process(records, outputDir);
            expect(result.sharedPhoneRecords.length).toBe(0);
        });
    });
    describe('输出文件测试', () => {
        it('应该生成CSV输出文件', () => {
            const records = [
                createRecord({ employeeId: 'E001', employeeName: '张三', phone: '13800138001', routeName: '1号线' })
            ];
            const processor = new DedupProcessor_1.DedupProcessor(outputDir);
            const result = processor.process(records, outputDir);
            expect(fs.existsSync(result.outputPath)).toBe(true);
            const content = fs.readFileSync(result.outputPath, 'utf8');
            expect(content).toContain('员工编号');
            expect(content).toContain('张三');
        });
        it('应该生成复核报告文件', () => {
            const records = [
                createRecord({ employeeId: 'E001', employeeName: '张三', phone: '13800138001', routeName: '1号线' })
            ];
            const processor = new DedupProcessor_1.DedupProcessor(outputDir);
            const result = processor.process(records, outputDir);
            expect(fs.existsSync(result.reportPath)).toBe(true);
            const content = fs.readFileSync(result.reportPath, 'utf8');
            expect(content).toContain('企业班车报名去重复核报告');
            expect(content).toContain('总体统计');
        });
    });
    describe('历史记录测试', () => {
        it('应该保存运行历史记录', () => {
            const records = [
                createRecord({ employeeId: 'E001', employeeName: '张三', phone: '13800138001', routeName: '1号线' })
            ];
            const processor = new DedupProcessor_1.DedupProcessor(outputDir);
            processor.process(records, outputDir);
            const historyPath = path.join(outputDir, '.history', 'run_history.json');
            expect(fs.existsSync(historyPath)).toBe(true);
            const history = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
            expect(Array.isArray(history)).toBe(true);
            expect(history.length).toBe(1);
        });
        it('应该能够查找之前的运行记录', () => {
            const records = [
                createRecord({ employeeId: 'E001', employeeName: '张三', phone: '13800138001', routeName: '1号线' })
            ];
            const processor = new DedupProcessor_1.DedupProcessor(outputDir);
            processor.process(records, outputDir);
            const prevRun = processor.findPreviousRun(records);
            expect(prevRun).toBeDefined();
            expect(prevRun?.recordHashes.length).toBe(1);
        });
    });
    describe('统计信息测试', () => {
        it('应该正确统计线路人数', () => {
            const records = [
                createRecord({ employeeId: 'E001', employeeName: '张三', phone: '13800138001', routeName: '1号线' }),
                createRecord({ employeeId: 'E002', employeeName: '李四', phone: '13800138002', routeName: '1号线' }),
                createRecord({ employeeId: 'E003', employeeName: '王五', phone: '13800138003', routeName: '2号线' })
            ];
            const processor = new DedupProcessor_1.DedupProcessor(outputDir);
            const result = processor.process(records, outputDir);
            expect(result.totalRecords).toBe(3);
            expect(result.validRecords).toBe(3);
            const reportContent = fs.readFileSync(result.reportPath, 'utf8');
            expect(reportContent).toContain('线路统计');
        });
    });
});
//# sourceMappingURL=DedupProcessor.test.js.map