"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runDemo = runDemo;
const chalk_1 = __importDefault(require("chalk"));
const store_1 = require("../storage/store");
const importer_1 = require("../utils/importer");
const rules_1 = require("../engine/rules");
const commands_1 = require("../commands");
const contracts = [
    {
        contractNo: "HT-2026-001",
        name: "智能客服系统开发项目",
        client: "科技股份有限公司",
        startDate: "2026-01-01",
        endDate: "2026-12-31",
        totalAmount: 1000000,
        status: "active",
    },
    {
        contractNo: "HT-2026-002",
        name: "数据中台建设项目",
        client: "金融服务集团",
        startDate: "2026-02-01",
        endDate: "2026-11-30",
        totalAmount: 800000,
        status: "active",
    },
    {
        contractNo: "HT-2026-003",
        name: "移动端APP升级项目",
        client: "电子商务平台",
        startDate: "2026-03-01",
        endDate: "2026-09-30",
        totalAmount: 500000,
        status: "active",
    },
];
const milestones = [
    {
        milestoneNo: "MS-001-01",
        contractNo: "HT-2026-001",
        name: "需求分析与设计",
        amount: 200000,
        expectedDeliveryDate: "2026-02-28",
        description: "完成需求调研、原型设计和技术方案",
    },
    {
        milestoneNo: "MS-001-02",
        contractNo: "HT-2026-001",
        name: "核心功能开发",
        amount: 400000,
        expectedDeliveryDate: "2026-06-30",
        description: "完成核心功能模块开发",
    },
    {
        milestoneNo: "MS-001-03",
        contractNo: "HT-2026-001",
        name: "系统测试与上线",
        amount: 400000,
        expectedDeliveryDate: "2026-11-30",
        description: "完成测试、部署和上线",
    },
    {
        milestoneNo: "MS-002-01",
        contractNo: "HT-2026-002",
        name: "数据仓库搭建",
        amount: 300000,
        expectedDeliveryDate: "2026-04-30",
        description: "搭建数据仓库基础设施",
    },
    {
        milestoneNo: "MS-002-02",
        contractNo: "HT-2026-002",
        name: "数据治理平台",
        amount: 300000,
        expectedDeliveryDate: "2026-07-31",
        description: "实现数据质量监控和治理",
    },
    {
        milestoneNo: "MS-002-03",
        contractNo: "HT-2026-002",
        name: "数据应用开发",
        amount: 200000,
        expectedDeliveryDate: "2026-10-31",
        description: "开发数据应用和报表",
    },
    {
        milestoneNo: "MS-003-01",
        contractNo: "HT-2026-003",
        name: "UI界面重构",
        amount: 150000,
        expectedDeliveryDate: "2026-04-30",
        description: "完成移动端UI界面重构",
    },
    {
        milestoneNo: "MS-003-02",
        contractNo: "HT-2026-003",
        name: "性能优化",
        amount: 150000,
        expectedDeliveryDate: "2026-06-30",
        description: "完成应用性能优化",
    },
    {
        milestoneNo: "MS-003-03",
        contractNo: "HT-2026-003",
        name: "新功能开发",
        amount: 200000,
        expectedDeliveryDate: "2026-08-31",
        description: "开发新功能模块",
    },
];
const deliveries = [
    {
        proofNo: "DP-001-01",
        milestoneNo: "MS-001-01",
        deliveryDate: "2026-02-25",
        description: "需求规格说明书、技术方案文档",
        status: "approved",
    },
    {
        proofNo: "DP-001-02",
        milestoneNo: "MS-001-02",
        deliveryDate: "2026-06-20",
        description: "核心功能代码、单元测试报告",
        status: "approved",
    },
    {
        proofNo: "DP-002-01",
        milestoneNo: "MS-002-01",
        deliveryDate: "2026-04-20",
        description: "数据仓库部署文档、初始化脚本",
        status: "approved",
    },
    {
        proofNo: "DP-002-02",
        milestoneNo: "MS-002-02",
        deliveryDate: "2026-07-15",
        description: "数据治理平台代码、配置文档",
        status: "approved",
    },
    {
        proofNo: "DP-003-01",
        milestoneNo: "MS-003-01",
        deliveryDate: "2026-04-15",
        description: "UI设计稿、前端代码",
        status: "approved",
    },
];
const acceptances = [
    {
        formNo: "AC-001-01",
        milestoneNo: "MS-001-01",
        acceptanceDate: "2026-03-05",
        acceptedAmount: 200000,
        description: "需求分析阶段验收",
        status: "signed",
    },
    {
        formNo: "AC-001-02",
        milestoneNo: "MS-001-02",
        acceptanceDate: "2026-07-10",
        acceptedAmount: 350000,
        description: "核心功能开发部分验收（客户提出性能优化需求）",
        status: "signed",
    },
    {
        formNo: "AC-002-01",
        milestoneNo: "MS-002-01",
        acceptanceDate: "2026-04-25",
        acceptedAmount: 300000,
        description: "数据仓库验收",
        status: "signed",
    },
    {
        formNo: "AC-002-02",
        milestoneNo: "MS-002-02",
        acceptanceDate: "2026-01-10",
        acceptedAmount: 300000,
        description: "数据治理平台验收",
        status: "signed",
    },
    {
        formNo: "AC-003-01",
        milestoneNo: "MS-003-01",
        acceptanceDate: "2026-04-10",
        acceptedAmount: 150000,
        description: "UI界面验收",
        status: "signed",
    },
];
const invoices = [
    {
        invoiceNo: "INV-2026-0001",
        milestoneNo: "MS-001-01",
        invoiceDate: "2026-03-10",
        amount: 200000,
        taxRate: 0.06,
        status: "issued",
    },
    {
        invoiceNo: "INV-2026-0002",
        milestoneNo: "MS-001-02",
        invoiceDate: "2026-07-15",
        amount: 350000,
        taxRate: 0.06,
        status: "issued",
    },
    {
        invoiceNo: "INV-2026-0003",
        milestoneNo: "MS-002-01",
        invoiceDate: "2026-04-28",
        amount: 300000,
        taxRate: 0.06,
        status: "issued",
    },
    {
        invoiceNo: "INV-2026-0005",
        milestoneNo: "MS-002-02",
        invoiceDate: "2026-07-20",
        amount: 350000,
        taxRate: 0.06,
        status: "issued",
    },
];
const payments = [
    {
        paymentNo: "PAY-2026-0001",
        invoiceNo: "INV-2026-0001",
        paymentDate: "2026-03-25",
        amount: 200000,
        payer: "科技股份有限公司",
        remark: "第一期付款",
    },
    {
        paymentNo: "PAY-2026-0002",
        invoiceNo: "INV-2026-0002",
        paymentDate: "2026-08-05",
        amount: 350000,
        payer: "科技股份有限公司",
        remark: "第二期部分付款",
    },
    {
        paymentNo: "PAY-2026-0003",
        invoiceNo: "INV-2026-0003",
        paymentDate: "2026-05-10",
        amount: 300000,
        payer: "金融服务集团",
        remark: "数据仓库阶段付款",
    },
    {
        paymentNo: "PAY-2026-0004",
        paymentDate: "2026-04-20",
        amount: 150000,
        payer: "电子商务平台",
        remark: "UI界面款项",
    },
    {
        paymentNo: "PAY-2026-0001",
        paymentDate: "2026-03-26",
        amount: 200000,
        payer: "科技股份有限公司",
        remark: "重复付款测试",
    },
];
function runDemo(options = {}) {
    const store = options.dataDir ? new store_1.DataStore(options.dataDir) : new store_1.DataStore();
    const engine = new rules_1.BusinessRulesEngine(store);
    const importer = new importer_1.DataImporter(store, engine);
    console.log(chalk_1.default.cyan("========================================"));
    console.log(chalk_1.default.cyan("    合同里程碑回款 CLI 演示"));
    console.log(chalk_1.default.cyan("========================================"));
    console.log("");
    if (store.exists() && !options.force) {
        console.log(chalk_1.default.yellow("⚠️  数据库已存在，使用 --force 参数可覆盖"));
        console.log(chalk_1.default.gray(`数据目录: ${store.getDataDir()}`));
        process.exit(1);
    }
    console.log(chalk_1.default.blue("📁 初始化数据库..."));
    store.initialize();
    console.log(chalk_1.default.green("✅ 数据库已初始化"));
    console.log("");
    console.log(chalk_1.default.blue("📥 导入演示数据..."));
    console.log("");
    console.log(chalk_1.default.gray("1. 导入合同数据..."));
    importer.importData(contracts, "contract", "demo");
    console.log(chalk_1.default.gray("2. 导入里程碑数据..."));
    importer.importData(milestones, "milestone", "demo");
    console.log(chalk_1.default.gray("3. 导入交付证明..."));
    importer.importData(deliveries, "delivery", "demo");
    console.log(chalk_1.default.gray("4. 导入验收单..."));
    importer.importData(acceptances, "acceptance", "demo");
    console.log(chalk_1.default.gray("5. 导入发票..."));
    importer.importData(invoices, "invoice", "demo");
    console.log(chalk_1.default.gray("6. 导入收款流水..."));
    const paymentResult = importer.importData(payments, "payment", "demo");
    console.log("");
    console.log(chalk_1.default.green("✅ 演示数据导入完成！"));
    console.log("");
    console.log(chalk_1.default.cyan("========================================"));
    console.log(chalk_1.default.cyan("    数据一致性检查"));
    console.log(chalk_1.default.cyan("========================================"));
    console.log("");
    (0, commands_1.runCheck)({ dataDir: store.getDataDir() });
    console.log("");
    console.log(chalk_1.default.cyan("========================================"));
    console.log(chalk_1.default.cyan("    合同汇总报告"));
    console.log(chalk_1.default.cyan("========================================"));
    console.log("");
    (0, commands_1.runReport)({ dataDir: store.getDataDir() });
    console.log("");
    console.log(chalk_1.default.cyan("========================================"));
    console.log(chalk_1.default.cyan("    合同详情示例"));
    console.log(chalk_1.default.cyan("========================================"));
    console.log("");
    (0, commands_1.runDetail)("HT-2026-001", {
        dataDir: store.getDataDir(),
        showHistory: true,
        showIssues: true,
    });
    console.log("");
    console.log(chalk_1.default.cyan("========================================"));
    console.log(chalk_1.default.cyan("    演示说明"));
    console.log(chalk_1.default.cyan("========================================"));
    console.log("");
    console.log(chalk_1.default.yellow("内置场景覆盖:"));
    console.log(chalk_1.default.white("  1. ✅ 正常回款 - HT-2026-001 里程碑 MS-001-01"));
    console.log(chalk_1.default.white("  2. ⚠️  部分验收 - HT-2026-001 里程碑 MS-001-02 (40万里程碑仅验收35万)"));
    console.log(chalk_1.default.white("  3. 📄 发票未开 - HT-2026-003 里程碑已验收但未开票"));
    console.log(chalk_1.default.white("  4. ⏰ 超期未收 - HT-2026-002 里程碑 MS-002-02 (验收日期早于交付日期)"));
    console.log(chalk_1.default.white("  5. 💰 金额超额 - 发票金额超过里程碑金额"));
    console.log(chalk_1.default.white("  6. 🔄 重复流水 - 同一收款流水号重复导入"));
    console.log("");
    console.log(chalk_1.default.cyan("可用命令:"));
    console.log(chalk_1.default.white("  cmp check                    - 检查数据一致性"));
    console.log(chalk_1.default.white("  cmp report                   - 查看汇总报告"));
    console.log(chalk_1.default.white("  cmp detail <合同编号>        - 查看合同详情"));
    console.log(chalk_1.default.white("  cmp detail HT-2026-001       - 查看智能客服系统项目详情"));
    console.log(chalk_1.default.white("  cmp detail HT-2026-001 --history --issues"));
    console.log(chalk_1.default.white("                              - 查看带历史记录和问题的详情"));
    console.log("");
    console.log(chalk_1.default.green("演示完成！数据已保存到: ") + store.getDataDir());
}
//# sourceMappingURL=run-demo.js.map