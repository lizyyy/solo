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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeInit = executeInit;
const path = __importStar(require("path"));
const dayjs_1 = __importDefault(require("dayjs"));
const storage_1 = require("../utils/storage");
const sample_data_1 = require("../data/sample-data");
async function executeInit(options) {
    const dataDir = path.resolve(options.dataDir);
    const storage = new storage_1.StorageService(dataDir);
    if (storage.exists()) {
        console.log(`项目已存在: ${dataDir}`);
        console.log('如果需要重新初始化，请先删除该目录。');
        return;
    }
    const config = {
        name: options.name,
        declarationYear: options.year,
        declarationMonth: options.month,
        currentCity: '',
        dataDir: dataDir,
        createdAt: (0, dayjs_1.default)().toISOString(),
        updatedAt: (0, dayjs_1.default)().toISOString(),
    };
    storage.init(config);
    console.log(`\n✅ 项目初始化成功: ${options.name}`);
    console.log(`   数据目录: ${dataDir}`);
    console.log(`   申报年度: ${options.year}年${options.month}月`);
    if (options.withSample) {
        console.log('\n📦 正在生成样例数据...');
        const employeeIdMap = new Map();
        sample_data_1.SAMPLE_EMPLOYEES.forEach((emp) => {
            const newEmployee = storage.addEmployee(emp);
            employeeIdMap.set(emp.employeeNo, newEmployee.id);
        });
        const salaries = (0, sample_data_1.generateSampleSalaries)(employeeIdMap, options.year);
        salaries.forEach((salary) => {
            storage.addSalary(salary);
        });
        const employmentRecords = (0, sample_data_1.generateSampleEmploymentRecords)(employeeIdMap, options.year);
        employmentRecords.forEach((record) => {
            storage.addEmploymentRecord(record);
        });
        sample_data_1.SAMPLE_CITY_RULES.forEach((rule) => {
            storage.addCityRule(rule);
        });
        const historicalDeclarations = (0, sample_data_1.generateSampleHistoricalDeclarations)(employeeIdMap, options.year);
        historicalDeclarations.forEach((declaration) => {
            storage.addHistoricalDeclaration(declaration);
        });
        storage.addOperationLog({
            command: 'init',
            operator: options.operator,
            parameters: {
                name: options.name,
                year: options.year,
                month: options.month,
                withSample: true,
            },
            status: 'success',
            message: '初始化项目并生成样例数据',
        });
        console.log('   ✅ 员工数据: 6 人（北京、上海、成都）');
        console.log('   ✅ 工资记录: 完整年度数据');
        console.log('   ✅ 入离职记录: 含入职、离职、跨城市调动');
        console.log('   ✅ 城市规则: 北京、上海、成都2025年上下限');
        console.log('   ✅ 历史申报: 含已提交和已审批记录');
        console.log('\n📋 样例数据场景:');
        console.log('   1. 张三 (北京) - 高薪员工，含年终奖');
        console.log('   2. 李四 (上海) - 7月新入职，试用期员工');
        console.log('   3. 王五 (成都) - 超高薪，超过上限');
        console.log('   4. 赵六 (北京) - 3月已离职，低工资');
        console.log('   5. 钱七 (北京) - 有重复申报历史');
        console.log('   6. 孙八 (上海) - 5月从北京调动到上海，需补缴');
    }
    else {
        storage.addOperationLog({
            command: 'init',
            operator: options.operator,
            parameters: {
                name: options.name,
                year: options.year,
                month: options.month,
                withSample: false,
            },
            status: 'success',
            message: '初始化空项目',
        });
    }
    console.log('\n💡 下一步:');
    console.log('   ssc check --data-dir ./data  # 检查数据完整性');
    console.log('   ssc report --data-dir ./data # 生成申报报告');
}
