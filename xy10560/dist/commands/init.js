"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initCommand = initCommand;
const store_1 = require("../store/store");
function initCommand(options) {
    const store = new store_1.DataStore(options.storePath);
    if (store.exists()) {
        console.log(`⚠️  数据存储已存在: ${store.getStorePath()}`);
        console.log('   如需重新初始化，请先删除该文件');
        return;
    }
    store.initialize();
    console.log(`✅ 数据存储初始化完成`);
    console.log(`   存储路径: ${store.getStorePath()}`);
    console.log('');
    console.log('下一步:');
    console.log('  1. 运行 import 命令导入数据');
    console.log('  2. 或使用 --sample 选项加载样例数据');
}
