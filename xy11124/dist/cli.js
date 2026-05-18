#!/usr/bin/env node
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
const commander_1 = require("commander");
const path = __importStar(require("path"));
const screener_1 = require("./screener");
const reporter_1 = require("./reporter");
const program = new commander_1.Command();
program
    .name('postpartum-screening')
    .description('产后康复中心理疗禁忌筛查 CLI 工具')
    .version('1.0.0');
program
    .command('run')
    .description('运行理疗禁忌筛查')
    .argument('<files...>', '输入数据文件（支持.json和.yaml格式）')
    .option('-d, --date <date>', '筛查日期 (YYYY-MM-DD)', new Date().toISOString().split('T')[0])
    .option('-f, --force', '强制重新筛查（忽略去重状态）', false)
    .option('-o, --output <path>', '输出JSON报告文件路径')
    .option('-m, --markdown <path>', '输出Markdown报告文件路径')
    .option('--no-console', '不输出控制台报告')
    .action((files, options) => {
    const absoluteFiles = files.map((f) => path.resolve(f));
    const result = (0, screener_1.runScreening)(absoluteFiles, options.date, options.force);
    if (options.console !== false) {
        console.log((0, reporter_1.generateConsoleReport)(result));
    }
    if (options.output) {
        (0, reporter_1.generateJsonReport)(result, path.resolve(options.output));
        console.log(`JSON报告已保存到: ${options.output}`);
    }
    if (options.markdown) {
        (0, reporter_1.generateMarkdownReport)(result, path.resolve(options.markdown));
        console.log(`Markdown报告已保存到: ${options.markdown}`);
    }
});
program
    .command('clear')
    .description('清除去重状态缓存')
    .action(() => {
    (0, screener_1.clearDedupeState)();
    console.log('✓ 去重状态缓存已清除');
});
program
    .command('explain')
    .description('显示业务规则解释')
    .action(() => {
    console.log(`
══════════════════════════════════════════════════════════════
            产后康复中心理疗禁忌筛查 - 业务规则
══════════════════════════════════════════════════════════════

【禁忌过期检测】
  每个禁忌项都包含有效日期范围。如果筛查日期超过禁忌的到期日期，
  系统将标记为"禁忌过期"，级别为 critical（严重）。

  风险说明：过期的禁忌记录无法反映患者当前的身体状况，
  继续使用这些数据进行理疗决策存在医疗安全风险。

【套餐混项检测】
  理疗套餐按类别标准化配置禁忌类型：
  - 盆底康复：盆底肌肉严重损伤、子宫复旧不良、活动性出血
  - 子宫复旧：活动性出血、急性感染、发热
  - 形体恢复：严重贫血、高血压、心脏病
  - 乳腺护理：急性感染、发热、恶性肿瘤
  - 产后心理：精神疾病、产后抑郁
  - 综合调理：高血压、心脏病、糖尿病、肝肾功能异常

  如果套餐包含非标准类别的禁忌类型，系统将标记为"套餐混项"，
  级别为 warning（警告）。

  风险说明：不规范的套餐配置可能导致禁忌筛查判断失误，
  影响患者安全和理疗效果。

【去重机制】
  - 基于文件内容哈希生成批次ID，同一批数据不会重复处理
  - 基于患者ID+套餐ID+筛查日期生成记录哈希，避免重复记录
  - 使用 .screening-state.json 文件持久化处理状态
  - 可使用 --force 参数强制绕过去重

【排序规则】
  筛查结果按以下优先级排序，便于diff比对：
  1. 结果级别: fail > warning > pass
  2. 患者ID: 字母顺序
  3. 套餐ID: 字母顺序

══════════════════════════════════════════════════════════════
    `);
});
program.parse(process.argv);
