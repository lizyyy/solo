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
exports.importCommand = importCommand;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const store_1 = require("../store/store");
const executor_1 = require("../services/executor");
const sampleData_1 = require("../services/sampleData");
function importCommand(options) {
    const store = new store_1.DataStore(options.storePath);
    if (!store.exists()) {
        console.error('❌ 错误: 数据存储不存在，请先运行 init 命令');
        process.exit(1);
    }
    const executor = new executor_1.Executor(store);
    let importData;
    if (options.sample) {
        console.log('📦 加载内置样例数据...');
        importData = (0, sampleData_1.generateSampleData)();
    }
    else if (options.failure) {
        console.log('📦 加载失败场景样例数据...');
        importData = (0, sampleData_1.generateFailureScenarioData)();
    }
    else if (options.file) {
        const filePath = path.resolve(options.file);
        if (!fs.existsSync(filePath)) {
            console.error(`❌ 错误: 文件不存在 ${filePath}`);
            process.exit(1);
        }
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            importData = JSON.parse(content);
            console.log(`📦 从文件加载数据: ${filePath}`);
        }
        catch (err) {
            console.error(`❌ 错误: 无法解析文件 - ${err.message}`);
            process.exit(1);
        }
    }
    else {
        console.error('❌ 错误: 请指定 --sample、--failure 或 --file 参数');
        process.exit(1);
    }
    console.log(`   证书: ${importData.certificates.length} 个`);
    console.log(`   域名: ${importData.domains.length} 个`);
    console.log(`   依赖: ${importData.dependencies.length} 个`);
    console.log(`   维护窗口: ${importData.windows.length} 个`);
    console.log('');
    const result = executor.importData(importData, options.operator, {
        overwrite: options.overwrite
    });
    if (result.success) {
        console.log('✅ 导入成功');
        console.log(`   导入证书: ${result.imported.certificates} 个`);
        console.log(`   导入域名: ${result.imported.domains} 个`);
        console.log(`   导入依赖: ${result.imported.dependencies} 个`);
        console.log(`   导入维护窗口: ${result.imported.windows} 个`);
    }
    else {
        console.log('⚠️  导入部分成功');
    }
    if (result.duplicates.serialNumbers.length > 0) {
        console.log('');
        console.log('   重复序列号:');
        for (const sn of result.duplicates.serialNumbers) {
            console.log(`     - ${sn}`);
        }
    }
    if (result.duplicates.domains.length > 0) {
        console.log('');
        console.log('   重复域名:');
        for (const domain of result.duplicates.domains) {
            console.log(`     - ${domain}`);
        }
    }
    if (result.errors.length > 0) {
        console.log('');
        console.log('   错误信息:');
        for (const error of result.errors) {
            console.log(`     - ${error}`);
        }
    }
    console.log('');
    console.log(`📝 执行记录 ID: ${result.executionRecord.id}`);
    console.log(`   操作者: ${result.executionRecord.operator}`);
    console.log(`   状态: ${result.executionRecord.status}`);
    console.log(`   耗时: ${result.executionRecord.durationMs}ms`);
}
