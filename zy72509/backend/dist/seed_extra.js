"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = require("./database");
const recordService_1 = require("./services/recordService");
(0, database_1.initDatabase)();
console.log('正在补充测试数据（用于验证同手机号重传去重）...');
(0, recordService_1.createRecord)({
    session_id: 'sess_006',
    user_query: '你好，帮我查一下余额，我的手机号是13812345678，谢谢',
    annotator_comment: '用户查询余额，敏感信息需要拦截',
    model_output: '好的，正在为您查询13812345678的余额信息。',
    phone_number: '13812345678',
    is_intercepted: true,
    imported_from: '补测同手机号-重传样例',
});
console.log('✓ 已添加 sess_006，与 sess_001 共享手机号 13812345678，用于验证导出去重');
console.log('');
console.log('预期结果：');
console.log('  - 自检: 导出一致检测到 138****5678 对应2条记录');
console.log('  - 导出: 按脱敏手机号去重后，只保留最早1条');
process.exit(0);
