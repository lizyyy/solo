"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runCli = runCli;
const commander_1 = require("commander");
const chalk_1 = __importDefault(require("chalk"));
const cli_table3_1 = __importDefault(require("cli-table3"));
const service_1 = require("./service");
const config_1 = require("./config");
const program = new commander_1.Command();
function createService(role = config_1.ROLES.ADMIN) {
    const user = {
        ...config_1.DEFAULT_USER,
        role,
        permissions: config_1.ROLE_PERMISSIONS[role] || []
    };
    return new service_1.RentalService(user);
}
function printResult(result) {
    if (result.success) {
        console.log(chalk_1.default.green('✓ 操作成功'));
        if (result.isDuplicate) {
            console.log(chalk_1.default.yellow('  (重复请求，返回已有记录)'));
        }
        if (result.warnings && result.warnings.length > 0) {
            console.log(chalk_1.default.yellow('  警告:'));
            result.warnings.forEach((w) => console.log(chalk_1.default.yellow(`    - ${w}`)));
        }
        if (result.data) {
            console.log('\n数据:');
            console.log(JSON.stringify(result.data, null, 2));
        }
        console.log(`\n请求ID: ${result.requestId}`);
    }
    else {
        console.log(chalk_1.default.red('✗ 操作失败'));
        console.log(chalk_1.default.red(`  错误: ${result.error}`));
        console.log(`\n请求ID: ${result.requestId}`);
    }
}
function printEquipmentTable(equipment) {
    const table = new cli_table3_1.default({
        head: ['ID', '类型', '名称', '规格', '总数量', '可用', '单位']
    });
    equipment.forEach(e => {
        table.push([
            e.id.substring(0, 8),
            e.type,
            e.name,
            e.spec,
            e.totalQuantity,
            e.availableQuantity,
            e.unit
        ]);
    });
    console.log(table.toString());
}
function printBoothTable(booths) {
    const table = new cli_table3_1.default({
        head: ['ID', '展位号', '公司', '联系人', '联系电话']
    });
    booths.forEach(b => {
        table.push([
            b.id.substring(0, 8),
            b.boothNumber,
            b.companyName,
            b.contactPerson || '-',
            b.contactPhone || '-'
        ]);
    });
    console.log(table.toString());
}
function printRecordsTable(records) {
    const table = new cli_table3_1.default({
        head: ['ID', '请求ID', '展位', '操作类型', '状态', '创建人', '时间']
    });
    records.forEach(r => {
        table.push([
            r.id.substring(0, 8),
            r.requestId.substring(0, 12),
            r.boothNumber,
            r.operationType,
            r.status,
            r.createdBy,
            new Date(r.createdAt).toLocaleString('zh-CN')
        ]);
    });
    console.log(table.toString());
}
function printAuditLogs(logs) {
    const table = new cli_table3_1.default({
        head: ['时间', '操作人', '操作类型', '变更']
    });
    logs.forEach(log => {
        const changes = log.changes.map((c) => `${c.field}: ${c.oldValue} → ${c.newValue}`).join('; ');
        table.push([
            new Date(log.timestamp).toLocaleString('zh-CN'),
            log.operator,
            log.operationType,
            changes.substring(0, 60)
        ]);
    });
    console.log(table.toString());
}
program
    .name('exhibition')
    .description('会展设备租赁管理CLI')
    .version('1.0.0');
program.command('import')
    .description('导入设备库存')
    .requiredOption('-r, --request-id <string>', '请求ID（用于幂等性）')
    .requiredOption('-t, --type <type>', '设备类型: truss/light/screen')
    .requiredOption('-n, --name <string>', '设备名称')
    .requiredOption('-s, --spec <string>', '设备规格')
    .requiredOption('-q, --quantity <number>', '数量')
    .requiredOption('-u, --unit <string>', '单位')
    .option('--price <number>', '日租价格')
    .option('--supplier <string>', '供应商')
    .action((options) => {
    const service = createService();
    const result = service.importEquipment(options.requestId, [{
            type: options.type,
            name: options.name,
            spec: options.spec,
            totalQuantity: parseInt(options.quantity),
            unit: options.unit,
            pricePerDay: options.price ? parseFloat(options.price) : undefined,
            supplier: options.supplier
        }]);
    printResult(result);
});
program.command('occupy')
    .description('租赁设备')
    .requiredOption('-r, --request-id <string>', '请求ID（用于幂等性）')
    .requiredOption('-b, --booth <string>', '展位号')
    .requiredOption('-c, --company <string>', '公司名称')
    .requiredOption('-e, --equipment <items...>', '设备ID和数量，格式: id:qty')
    .requiredOption('--by <string>', '申请人')
    .option('--contact-person <string>', '联系人')
    .option('--contact-phone <string>', '联系电话')
    .action((options) => {
    const service = createService();
    const items = options.equipment.map((item) => {
        const [id, qty] = item.split(':');
        return { equipmentId: id, quantity: parseInt(qty) };
    });
    const result = service.occupyEquipment(options.requestId, options.booth, options.company, items, options.by, options.contactPerson, options.contactPhone);
    printResult(result);
});
program.command('transfer')
    .description('调拨设备')
    .requiredOption('-r, --request-id <string>', '请求ID（用于幂等性）')
    .requiredOption('--from-booth <string>', '源展位号')
    .requiredOption('--to-booth <string>', '目标展位号')
    .requiredOption('--to-company <string>', '目标公司')
    .requiredOption('-e, --equipment <items...>', '设备ID和数量，格式: id:qty')
    .requiredOption('--by <string>', '操作人')
    .action((options) => {
    const service = createService();
    const items = options.equipment.map((item) => {
        const [id, qty] = item.split(':');
        return { equipmentId: id, quantity: parseInt(qty) };
    });
    const result = service.transferEquipment(options.requestId, options.fromBooth, options.toBooth, options.toCompany, items, options.by);
    printResult(result);
});
program.command('return')
    .description('归还设备')
    .requiredOption('-r, --request-id <string>', '请求ID（用于幂等性）')
    .requiredOption('-b, --booth <string>', '展位号')
    .requiredOption('-e, --equipment <items...>', '设备ID和数量，格式: id:qty')
    .requiredOption('--by <string>', '归还人')
    .option('--notes <string>', '备注')
    .action((options) => {
    const service = createService();
    const items = options.equipment.map((item) => {
        const [id, qty] = item.split(':');
        return { equipmentId: id, quantity: parseInt(qty) };
    });
    const result = service.returnEquipment(options.requestId, options.booth, items, options.by, options.notes);
    printResult(result);
});
program.command('damage')
    .description('报损设备')
    .requiredOption('-r, --request-id <string>', '请求ID（用于幂等性）')
    .requiredOption('-b, --booth <string>', '展位号')
    .requiredOption('-e, --equipment <string>', '设备ID')
    .requiredOption('--damage-type <string>', '损坏类型')
    .requiredOption('--desc <string>', '损坏描述')
    .requiredOption('-q, --quantity <number>', '损坏数量')
    .requiredOption('--by <string>', '报告人')
    .action((options) => {
    const service = createService();
    const result = service.reportDamage(options.requestId, options.booth, options.equipment, options.damageType, options.desc, parseInt(options.quantity), options.by);
    printResult(result);
});
program.command('equipment')
    .description('查看设备列表')
    .action(() => {
    const service = createService();
    const equipment = service.getEquipmentList();
    console.log(chalk_1.default.blue('设备列表:'));
    printEquipmentTable(equipment);
});
program.command('booths')
    .description('查看展位列表')
    .action(() => {
    const service = createService();
    const booths = service.getBoothList();
    console.log(chalk_1.default.blue('展位列表:'));
    printBoothTable(booths);
});
program.command('records')
    .description('查看租赁记录')
    .action(() => {
    const service = createService();
    const records = service.getRentalRecords();
    console.log(chalk_1.default.blue('租赁记录:'));
    printRecordsTable(records);
});
program.command('record <id>')
    .description('查看单个记录详情')
    .action((id) => {
    const service = createService();
    const record = service.getRecordById(id);
    if (record) {
        console.log(JSON.stringify(record, null, 2));
    }
    else {
        console.log(chalk_1.default.red('记录不存在'));
    }
});
program.command('summary <boothNumber>')
    .description('查看展位租赁汇总')
    .action((boothNumber) => {
    const service = createService();
    const summary = service.getBoothRentalSummary(boothNumber);
    if (summary) {
        console.log(chalk_1.default.blue(`展位 ${boothNumber} 租赁汇总:`));
        console.log(`公司: ${summary.booth.companyName}`);
        console.log('\n设备明细:');
        const table = new cli_table3_1.default({
            head: ['类型', '名称', '总租赁', '已归还', '已报损', '当前持有']
        });
        summary.summary.forEach((s) => {
            table.push([s.type, s.name, s.total, s.returned, s.damaged, s.current]);
        });
        console.log(table.toString());
    }
    else {
        console.log(chalk_1.default.red('展位不存在'));
    }
});
program.command('audit')
    .description('查看审计日志')
    .action(() => {
    const service = createService();
    const logs = service.getAuditLogs();
    console.log(chalk_1.default.blue('审计日志:'));
    printAuditLogs(logs);
});
program.command('explain <requestId>')
    .description('解释记录为什么被拦下或状态')
    .action((requestId) => {
    const service = createService();
    const record = service.getRecordByRequestId(requestId);
    if (record) {
        console.log(chalk_1.default.blue(`记录 ${requestId} 解释:`));
        console.log(`状态: ${record.status}`);
        console.log(`操作类型: ${record.operationType}`);
        console.log(`创建时间: ${new Date(record.createdAt).toLocaleString('zh-CN')}`);
        if (record.rejectionReason) {
            console.log(chalk_1.default.red(`拦截原因: ${record.rejectionReason}`));
        }
        else {
            console.log(chalk_1.default.green('记录已成功处理'));
        }
        console.log('\n明细:');
        record.items.forEach((item) => {
            console.log(`  - ${item.equipmentName}: ${item.quantity}${item.unit}`);
        });
    }
    else {
        console.log(chalk_1.default.red('记录不存在'));
    }
});
function runCli(argv) {
    program.parse(argv);
}
