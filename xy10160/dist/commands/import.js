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
exports.importSourceCommand = exports.importSnapshotCommand = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const chalk_1 = __importDefault(require("chalk"));
const store_1 = require("../storage/store");
const readProductsFromFile = (filePath) => {
    if (!fs.existsSync(filePath)) {
        throw new Error(`文件不存在: ${filePath}`);
    }
    const ext = path.extname(filePath).toLowerCase();
    const content = fs.readFileSync(filePath, 'utf-8');
    if (ext === '.json') {
        try {
            const data = JSON.parse(content);
            if (Array.isArray(data)) {
                return data;
            }
            throw new Error('JSON 文件必须是商品数组');
        }
        catch (e) {
            throw new Error(`JSON 解析失败: ${e.message}`);
        }
    }
    if (ext === '.csv') {
        const lines = content.trim().split('\n');
        if (lines.length < 2) {
            throw new Error('CSV 文件至少需要表头和一行数据');
        }
        const headers = lines[0].split(',').map((h) => h.trim());
        const products = [];
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map((v) => v.trim());
            const product = {};
            headers.forEach((header, index) => {
                let val = values[index] || '';
                const numVal = Number(val);
                if (!isNaN(numVal) && String(numVal) === val) {
                    val = numVal;
                }
                else if (val === 'true' || val === 'false') {
                    val = val === 'true';
                }
                product[header] = val;
            });
            products.push(product);
        }
        return products;
    }
    throw new Error(`不支持的文件格式: ${ext}，仅支持 .json 和 .csv`);
};
const validateProducts = (products) => {
    const errors = [];
    const seenIds = new Set();
    products.forEach((p, index) => {
        const line = index + 2;
        if (!p.id) {
            errors.push(`第 ${line} 行: 缺少必填字段 id`);
        }
        else {
            if (seenIds.has(String(p.id))) {
                errors.push(`第 ${line} 行: 重复的 id: ${p.id}`);
            }
            seenIds.add(String(p.id));
        }
        if (!p.name) {
            errors.push(`第 ${line} 行: 缺少必填字段 name`);
        }
        if (p.price === undefined || p.price === null) {
            errors.push(`第 ${line} 行: 缺少必填字段 price`);
        }
    });
    return { valid: errors.length === 0, errors };
};
const importSnapshotCommand = (filePath, options) => {
    if (!(0, store_1.isInitialized)()) {
        console.log(chalk_1.default.red('✗ 项目未初始化'));
        console.log(chalk_1.default.gray('   请先运行: sir init'));
        return;
    }
    if (!filePath) {
        console.log(chalk_1.default.red('✗ 必须指定文件路径'));
        console.log(chalk_1.default.gray('   用法: sir import snapshot <文件路径> --name <名称>'));
        (0, store_1.addHistoryEntry)('import', '导入快照失败', 'failed', '未指定文件路径');
        return;
    }
    if (!options.name) {
        console.log(chalk_1.default.red('✗ 必须指定 --name 参数'));
        (0, store_1.addHistoryEntry)('import', '导入快照失败', 'failed', '未指定名称');
        return;
    }
    try {
        console.log(chalk_1.default.blue('📥 正在读取索引快照...'));
        const products = readProductsFromFile(filePath);
        console.log(chalk_1.default.blue('🔍 正在验证数据...'));
        const validation = validateProducts(products);
        if (!validation.valid) {
            console.log(chalk_1.default.red('✗ 数据验证失败:'));
            validation.errors.slice(0, 10).forEach((e) => console.log(chalk_1.default.gray(`   - ${e}`)));
            if (validation.errors.length > 10) {
                console.log(chalk_1.default.gray(`   ... 还有 ${validation.errors.length - 10} 个错误`));
            }
            (0, store_1.addHistoryEntry)('import', '导入快照验证失败', 'failed', `文件: ${filePath}, 错误数: ${validation.errors.length}`);
            return;
        }
        console.log(chalk_1.default.blue('💾 正在保存快照...'));
        const snapshot = (0, store_1.saveSnapshot)(options.name, products, options.description);
        console.log(chalk_1.default.green('✓ 索引快照导入成功'));
        console.log(chalk_1.default.gray(`   快照 ID: ${snapshot.id}`));
        console.log(chalk_1.default.gray(`   商品数量: ${snapshot.productCount}`));
        console.log(chalk_1.default.gray(`   文件: ${snapshot.filePath}`));
        (0, store_1.addHistoryEntry)('import', `导入快照: ${options.name}`, 'success', `商品数: ${products.length}, 文件: ${filePath}`);
    }
    catch (e) {
        console.log(chalk_1.default.red(`✗ 导入失败: ${e.message}`));
        (0, store_1.addHistoryEntry)('import', '导入快照失败', 'failed', e.message);
    }
};
exports.importSnapshotCommand = importSnapshotCommand;
const importSourceCommand = (filePath, options) => {
    if (!(0, store_1.isInitialized)()) {
        console.log(chalk_1.default.red('✗ 项目未初始化'));
        console.log(chalk_1.default.gray('   请先运行: sir init'));
        return;
    }
    if (!filePath) {
        console.log(chalk_1.default.red('✗ 必须指定文件路径'));
        console.log(chalk_1.default.gray('   用法: sir import source <文件路径> --name <名称> --type <类型>'));
        (0, store_1.addHistoryEntry)('import', '导入源数据失败', 'failed', '未指定文件路径');
        return;
    }
    if (!options.name) {
        console.log(chalk_1.default.red('✗ 必须指定 --name 参数'));
        (0, store_1.addHistoryEntry)('import', '导入源数据失败', 'failed', '未指定名称');
        return;
    }
    const validTypes = ['database', 'api', 'file'];
    if (!validTypes.includes(options.type)) {
        console.log(chalk_1.default.red(`✗ 无效的类型: ${options.type}`));
        console.log(chalk_1.default.gray(`   可选值: ${validTypes.join(', ')}`));
        (0, store_1.addHistoryEntry)('import', '导入源数据失败', 'failed', `无效类型: ${options.type}`);
        return;
    }
    try {
        console.log(chalk_1.default.blue('📥 正在读取源数据...'));
        const products = readProductsFromFile(filePath);
        console.log(chalk_1.default.blue('🔍 正在验证数据...'));
        const validation = validateProducts(products);
        if (!validation.valid) {
            console.log(chalk_1.default.red('✗ 数据验证失败:'));
            validation.errors.slice(0, 10).forEach((e) => console.log(chalk_1.default.gray(`   - ${e}`)));
            if (validation.errors.length > 10) {
                console.log(chalk_1.default.gray(`   ... 还有 ${validation.errors.length - 10} 个错误`));
            }
            (0, store_1.addHistoryEntry)('import', '导入源数据验证失败', 'failed', `文件: ${filePath}, 错误数: ${validation.errors.length}`);
            return;
        }
        console.log(chalk_1.default.blue('💾 正在保存源数据...'));
        const source = (0, store_1.saveSourceData)(options.name, products, options.type, options.description);
        console.log(chalk_1.default.green('✓ 源数据导入成功'));
        console.log(chalk_1.default.gray(`   源数据 ID: ${source.id}`));
        console.log(chalk_1.default.gray(`   商品数量: ${source.productCount}`));
        console.log(chalk_1.default.gray(`   来源类型: ${source.sourceType}`));
        console.log(chalk_1.default.gray(`   文件: ${source.filePath}`));
        (0, store_1.addHistoryEntry)('import', `导入源数据: ${options.name}`, 'success', `商品数: ${products.length}, 类型: ${options.type}, 文件: ${filePath}`);
    }
    catch (e) {
        console.log(chalk_1.default.red(`✗ 导入失败: ${e.message}`));
        (0, store_1.addHistoryEntry)('import', '导入源数据失败', 'failed', e.message);
    }
};
exports.importSourceCommand = importSourceCommand;
//# sourceMappingURL=import.js.map