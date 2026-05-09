"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initCommand = void 0;
const chalk_1 = __importDefault(require("chalk"));
const store_1 = require("../storage/store");
const store_2 = require("../storage/store");
const initCommand = (options) => {
    if ((0, store_1.isInitialized)()) {
        if (!options.force) {
            console.log(chalk_1.default.yellow('⚠️  项目已初始化'));
            console.log(chalk_1.default.gray(`   数据目录: ${(0, store_2.getDataDir)()}`));
            console.log(chalk_1.default.gray('   使用 --force 强制重新初始化（会清除已有数据）'));
            (0, store_1.addHistoryEntry)('init', '检测到已初始化，跳过', 'success', '项目已存在，使用 --force 可覆盖');
            return;
        }
        console.log(chalk_1.default.yellow('⚠️  强制重新初始化，将清除所有数据...'));
    }
    const initialized = (0, store_1.initializeStore)();
    if (initialized) {
        console.log(chalk_1.default.green('✓ 初始化成功'));
        console.log(chalk_1.default.gray(`   数据目录: ${(0, store_2.getDataDir)()}`));
        (0, store_1.addHistoryEntry)('init', '初始化完成', 'success', `数据目录: ${(0, store_2.getDataDir)()}`);
    }
    else {
        console.log(chalk_1.default.red('✗ 初始化失败'));
        (0, store_1.addHistoryEntry)('init', '初始化失败', 'failed', '无法创建数据目录');
    }
};
exports.initCommand = initCommand;
//# sourceMappingURL=init.js.map