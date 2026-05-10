"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getInventoryReport = getInventoryReport;
exports.getAuditReport = getAuditReport;
exports.getCaseHistoryReport = getCaseHistoryReport;
const storage_1 = require("../storage");
const caseService_1 = require("./caseService");
const cityService_1 = require("./cityService");
const damageService_1 = require("./damageService");
function getInventoryReport() {
    const db = (0, storage_1.getDB)();
    const byStatus = {};
    const cityMap = new Map();
    const itemsMap = new Map();
    for (const caseObj of db.equipmentCases) {
        const statusLabel = (0, caseService_1.getCaseStatusLabel)(caseObj.status);
        if (!byStatus[statusLabel]) {
            byStatus[statusLabel] = { count: 0, value: 0 };
        }
        byStatus[statusLabel].count++;
        byStatus[statusLabel].value += caseObj.totalValue;
        if (!cityMap.has(caseObj.currentCityId)) {
            cityMap.set(caseObj.currentCityId, { count: 0, value: 0 });
        }
        const cityData = cityMap.get(caseObj.currentCityId);
        cityData.count++;
        cityData.value += caseObj.totalValue;
        for (const item of caseObj.items) {
            if (!itemsMap.has(item.name)) {
                itemsMap.set(item.name, { quantity: 0, value: 0 });
            }
            const itemData = itemsMap.get(item.name);
            itemData.quantity += item.quantity;
            itemData.value += item.quantity * item.unitValue;
        }
    }
    const byCity = [];
    for (const [cityId, data] of cityMap) {
        const cityResult = (0, cityService_1.getCityByIdentifier)(cityId);
        byCity.push({
            cityId,
            cityName: cityResult.success ? cityResult.data.name : '未知城市',
            cityCode: cityResult.success ? cityResult.data.code : 'UNKNOWN',
            count: data.count,
            value: data.value,
        });
    }
    byCity.sort((a, b) => b.value - a.value);
    const itemsSummary = [];
    for (const [name, data] of itemsMap) {
        itemsSummary.push({
            name,
            totalQuantity: data.quantity,
            totalValue: data.value,
        });
    }
    itemsSummary.sort((a, b) => b.totalValue - a.totalValue);
    const totalValue = db.equipmentCases.reduce((sum, c) => sum + c.totalValue, 0);
    return {
        success: true,
        message: `库存报告：共 ${db.equipmentCases.length} 个设备箱，总价值 ¥${totalValue.toFixed(2)}`,
        data: {
            totalCases: db.equipmentCases.length,
            totalValue,
            byStatus,
            byCity,
            itemsSummary,
        },
    };
}
function getAuditReport() {
    const db = (0, storage_1.getDB)();
    const activeBorrowCount = db.borrowRecords.filter(r => r.status === 'active').length;
    const completedBorrowCount = db.borrowRecords.filter(r => r.status === 'completed').length;
    const unresolvedDamageCount = db.damageRecords.filter(d => !d.isResolved).length;
    const inProgressRepairCount = db.repairRecords.filter(r => r.status === 'in_progress').length;
    const pendingCompensationCount = db.compensationActions.filter(a => a.status === 'pending').length;
    const permanentFailedCompensationCount = db.compensationActions.filter(a => a.status === 'failed_permanent').length;
    const activeToursCount = db.tourManifests.filter(t => t.status === 'in_progress').length;
    const completedToursCount = db.tourManifests.filter(t => t.status === 'completed').length;
    return {
        success: true,
        message: `审计报告：` +
            `${db.borrowRecords.length} 条借出记录（${activeBorrowCount} 个进行中，${completedBorrowCount} 个已完成），` +
            `${db.damageRecords.length} 条损坏记录（${unresolvedDamageCount} 个未解决），` +
            `${db.repairRecords.length} 条维修记录（${inProgressRepairCount} 个进行中），` +
            `${db.compensationActions.length} 个补偿动作（${pendingCompensationCount} 个待执行，${permanentFailedCompensationCount} 个永久失败），` +
            `${db.tourManifests.length} 个巡演清单（${activeToursCount} 个进行中）`,
        data: {
            totalBorrowRecords: db.borrowRecords.length,
            activeBorrowCount,
            completedBorrowCount,
            totalDamageRecords: db.damageRecords.length,
            unresolvedDamageCount,
            totalRepairRecords: db.repairRecords.length,
            inProgressRepairCount,
            totalCompensationActions: db.compensationActions.length,
            pendingCompensationCount,
            permanentFailedCompensationCount,
            totalTours: db.tourManifests.length,
            activeToursCount,
            completedToursCount,
        },
    };
}
function getCaseHistoryReport(caseIdentifier) {
    const db = (0, storage_1.getDB)();
    let caseObj = db.equipmentCases.find(c => c.id === caseIdentifier);
    if (!caseObj) {
        caseObj = db.equipmentCases.find(c => c.caseNumber === caseIdentifier);
    }
    if (!caseObj) {
        return {
            success: false,
            message: `未找到标识为「${caseIdentifier}」的设备箱`,
        };
    }
    const currentCityResult = (0, cityService_1.getCityByIdentifier)(caseObj.currentCityId);
    const borrowHistory = db.borrowRecords
        .filter(r => r.caseId === caseObj.id)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .map(r => {
        const fromCityResult = (0, cityService_1.getCityByIdentifier)(r.fromCityId);
        const toCityResult = r.toCityId ? (0, cityService_1.getCityByIdentifier)(r.toCityId) : null;
        return {
            id: r.id,
            fromCity: fromCityResult.success ? fromCityResult.data.name : '未知城市',
            toCity: toCityResult && toCityResult.success ? toCityResult.data.name : '同城',
            borrowedBy: r.borrowedBy,
            borrowTime: r.createdAt,
            returnTime: r.actualReturnTime,
            status: r.status === 'active' ? '进行中' : r.status === 'completed' ? '已完成' : r.status,
        };
    });
    const damageHistory = db.damageRecords
        .filter(d => d.caseId === caseObj.id)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .map(d => {
        const cityResult = (0, cityService_1.getCityByIdentifier)(d.cityId);
        return {
            id: d.id,
            city: cityResult.success ? cityResult.data.name : '未知城市',
            severity: (0, damageService_1.getDamageSeverityLabel)(d.severity),
            reportedBy: d.reportedBy,
            reportedTime: d.damageTime,
            isResolved: d.isResolved,
        };
    });
    const repairHistory = db.repairRecords
        .filter(r => r.caseId === caseObj.id)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .map(r => ({
        id: r.id,
        startedBy: r.startedBy,
        startTime: r.startTime,
        endTime: r.endTime,
        status: r.status === 'in_progress' ? '进行中' : r.status === 'completed' ? '已完成' : r.status,
        cost: r.cost,
    }));
    return {
        success: true,
        message: `设备箱「${caseObj.caseNumber}」历史记录：共 ${borrowHistory.length} 次借出，${damageHistory.length} 次损坏报告，${repairHistory.length} 次维修`,
        data: {
            caseNumber: caseObj.caseNumber,
            caseName: caseObj.name,
            currentStatus: (0, caseService_1.getCaseStatusLabel)(caseObj.status),
            currentCity: currentCityResult.success ? currentCityResult.data.name : '未知城市',
            totalValue: caseObj.totalValue,
            borrowHistory,
            damageHistory,
            repairHistory,
        },
    };
}
