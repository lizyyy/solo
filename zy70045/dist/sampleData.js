"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSampleData = createSampleData;
const shiftService_1 = require("./services/shiftService");
const productionService_1 = require("./services/productionService");
const downtimeService_1 = require("./services/downtimeService");
const handoverService_1 = require("./services/handoverService");
const revisionService_1 = require("./services/revisionService");
function createSampleData() {
    console.log('=== 创建示例数据 ===');
    const lineId = 'line-001';
    console.log('1. 创建早班 (8:00-16:00)');
    const morningShift = shiftService_1.shiftService.startShift({
        lineId,
        teamId: 'team-morning',
        teamName: '早班A组',
        startTime: new Date('2026-05-09T08:00:00'),
    });
    console.log(`   班次ID: ${morningShift.id}`);
    console.log('2. 添加产量记录');
    const prod1 = productionService_1.productionService.addProduction({
        shiftId: morningShift.id,
        productId: 'prod-001',
        productName: '产品A',
        quantity: 500,
        createdBy: 'user-zhangsan',
        timestamp: new Date('2026-05-09T10:00:00'),
    });
    productionService_1.productionService.confirmProduction(prod1.id);
    const prod2 = productionService_1.productionService.addProduction({
        shiftId: morningShift.id,
        productId: 'prod-001',
        productName: '产品A',
        quantity: 450,
        createdBy: 'user-zhangsan',
        timestamp: new Date('2026-05-09T14:00:00'),
    });
    productionService_1.productionService.confirmProduction(prod2.id);
    console.log(`   总产量: 950`);
    console.log('3. 添加废品记录');
    const waste1 = productionService_1.productionService.addWaste({
        shiftId: morningShift.id,
        productId: 'prod-001',
        productName: '产品A',
        quantity: 15,
        reason: '外观划痕',
        createdBy: 'user-zhangsan',
        timestamp: new Date('2026-05-09T12:00:00'),
    });
    productionService_1.productionService.confirmWaste(waste1.id);
    const waste2 = productionService_1.productionService.addWaste({
        shiftId: morningShift.id,
        productId: 'prod-001',
        productName: '产品A',
        quantity: 10,
        reason: '尺寸不合格',
        createdBy: 'user-zhangsan',
        timestamp: new Date('2026-05-09T15:00:00'),
    });
    productionService_1.productionService.confirmWaste(waste2.id);
    console.log(`   总废品: 25`);
    console.log('4. 记录设备停机');
    const downtime = downtimeService_1.downtimeService.recordDowntime({
        lineId,
        startTime: new Date('2026-05-09T09:30:00'),
        endTime: new Date('2026-05-09T09:45:00'),
        reason: '传送带故障',
        createdBy: 'user-zhangsan',
    });
    console.log(`   停机时间: 15分钟`);
    console.log('5. 结束早班');
    const endedMorning = shiftService_1.shiftService.endShift(morningShift.id, new Date('2026-05-09T16:00:00'));
    console.log(`   班次状态: ${endedMorning.status}`);
    console.log('6. 确认交接');
    const confirmedMorning = handoverService_1.handoverService.confirmHandover(morningShift.id, {
        handoverFrom: '张三',
        handoverTo: '李四',
    });
    console.log(`   交接确认状态: ${confirmedMorning.status}`);
    console.log('7. 创建中班 (16:00-24:00)');
    const afternoonShift = shiftService_1.shiftService.startShift({
        lineId,
        teamId: 'team-afternoon',
        teamName: '中班B组',
        startTime: new Date('2026-05-09T16:00:00'),
    });
    console.log(`   班次ID: ${afternoonShift.id}`);
    console.log('8. 中班产量');
    const prod3 = productionService_1.productionService.addProduction({
        shiftId: afternoonShift.id,
        productId: 'prod-001',
        productName: '产品A',
        quantity: 800,
        createdBy: 'user-lisi',
        timestamp: new Date('2026-05-09T20:00:00'),
    });
    productionService_1.productionService.confirmProduction(prod3.id);
    console.log(`   总产量: 800`);
    console.log('9. 中班废品');
    const waste3 = productionService_1.productionService.addWaste({
        shiftId: afternoonShift.id,
        productId: 'prod-001',
        productName: '产品A',
        quantity: 8,
        reason: '包装损坏',
        createdBy: 'user-lisi',
        timestamp: new Date('2026-05-09T22:00:00'),
    });
    productionService_1.productionService.confirmWaste(waste3.id);
    console.log(`   总废品: 8`);
    console.log('10. 结束中班');
    const endedAfternoon = shiftService_1.shiftService.endShift(afternoonShift.id, new Date('2026-05-09T24:00:00'));
    const confirmedAfternoon = handoverService_1.handoverService.confirmHandover(afternoonShift.id, {
        handoverFrom: '李四',
        handoverTo: '王五',
    });
    console.log(`   交接确认状态: ${confirmedAfternoon.status}`);
    console.log('=== 模拟修正场景 ===');
    console.log('11. 记录修正历史：早班实际产量应该是1000而非950');
    const revisedProd = revisionService_1.revisionService.reviseProduction(prod2.id, {
        revisedBy: 'admin-wang',
        reason: '发现少统计了50件产品',
        changes: {
            quantity: 500,
        },
    });
    console.log(`   修正后产量: ${revisedProd.quantity}`);
    console.log('12. 生成日报');
    const report = handoverService_1.handoverService.generateDailyReport('2026-05-09', lineId);
    console.log(`   日期: ${report.date}`);
    console.log(`   产线: ${report.lineId}`);
    console.log(`   班次数量: ${report.shifts.length}`);
    console.log(`   日总产量: ${report.dailyTotal.production}`);
    console.log(`   日总废品: ${report.dailyTotal.waste}`);
    console.log(`   日净产量: ${report.dailyTotal.netProduction}`);
    console.log('=== 示例数据创建完成 ===');
    console.log('');
    console.log('查询建议：');
    console.log('1. 查看班次列表: GET /api/shifts?lineId=line-001');
    console.log('2. 查看早班详情: GET /api/shifts/{morningShift.id}');
    console.log('3. 查看早班快照历史: GET /api/shifts/{morningShift.id}/snapshots/history');
    console.log('4. 查看日报: GET /api/reports/daily?date=2026-05-09&lineId=line-001');
    console.log('5. 查看修正历史: GET /api/revisions/production/{prod2.id}');
    return {
        morningShiftId: morningShift.id,
        afternoonShiftId: afternoonShift.id,
        lineId,
    };
}
if (require.main === module) {
    createSampleData();
}
//# sourceMappingURL=sampleData.js.map