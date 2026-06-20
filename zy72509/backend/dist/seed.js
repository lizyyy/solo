"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = require("./database");
const recordService_1 = require("./services/recordService");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const dataDir = path_1.default.join(process.cwd(), 'data');
if (!fs_1.default.existsSync(dataDir)) {
    fs_1.default.mkdirSync(dataDir, { recursive: true });
}
(0, database_1.initDatabase)();
const sampleData = [
    {
        session_id: 'sess_001',
        user_query: '你好，我想查询一下我的账户余额，手机号是13812345678',
        annotator_comment: '用户查询账户，涉及敏感信息，需要拦截',
        model_output: '好的，我来帮您查询账户余额。请问您需要查询哪个账户的余额呢？',
        phone_number: '13812345678',
        is_intercepted: true,
        imported_from: '示例数据',
    },
    {
        session_id: 'sess_002',
        user_query: '帮我重置一下密码',
        annotator_comment: '正常请求，可以通过',
        model_output: '为了您的账户安全，这属于敏感操作，我需要拦截并建议您通过官方APP操作。',
        phone_number: '',
        is_intercepted: false,
        imported_from: '示例数据',
    },
    {
        session_id: 'sess_003',
        user_query: '我的手机号13998765432注册不了，帮我看看',
        annotator_comment: '用户遇到注册问题，手机号需要注意脱敏',
        model_output: '很抱歉给您带来不便。手机号13998765432的注册问题我们会尽快处理。',
        phone_number: '13998765432',
        is_intercepted: false,
        imported_from: '示例数据',
    },
    {
        session_id: 'sess_004',
        user_query: '今天天气怎么样',
        annotator_comment: '普通问题，正常放行',
        model_output: '今天天气晴朗，气温25度，适合外出。',
        phone_number: '',
        is_intercepted: false,
        imported_from: '示例数据',
    },
    {
        session_id: 'sess_005',
        user_query: '帮我查一下其他人的通话记录，手机号13611112222',
        annotator_comment: '严重越权请求，必须拦截，涉及他人隐私',
        model_output: '抱歉，我无法提供他人的通话记录，这涉及隐私问题。',
        phone_number: '13611112222',
        is_intercepted: true,
        imported_from: '示例数据',
    },
];
console.log('正在生成示例数据...');
sampleData.forEach((item, index) => {
    try {
        (0, recordService_1.createRecord)(item);
        console.log(`✓ 第 ${index + 1} 条数据已创建`);
    }
    catch (e) {
        console.log(`✗ 第 ${index + 1} 条数据创建失败: ${e.message}`);
    }
});
console.log('示例数据生成完成！');
console.log('');
console.log('冲突说明：');
console.log('- sess_002: 标注员说"可以通过"，但模型输出说"需要拦截" → 存在冲突');
console.log('- sess_001、sess_003: 文本中包含未脱敏手机号 → 手机号漏遮风险');
process.exit(0);
