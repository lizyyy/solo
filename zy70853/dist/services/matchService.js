"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.matchService = exports.MatchService = void 0;
const types_1 = require("../types");
const matchUtils_1 = require("../utils/matchUtils");
class MatchService {
    constructor() {
        this.passengers = [];
        this.drivers = [];
        this.warehouses = [];
        this.routeShifts = [];
        this.imageIndexes = [];
        this.failedRecords = [];
        this.matchedIds = new Set();
    }
    setData(passengers, drivers, warehouses, routeShifts = [], imageIndexes = []) {
        this.passengers = passengers;
        this.drivers = drivers;
        this.warehouses = warehouses;
        this.routeShifts = routeShifts;
        this.imageIndexes = imageIndexes;
        this.failedRecords = [];
        this.matchedIds.clear();
    }
    process() {
        const normalItems = [];
        const pendingItems = [];
        this.validateRecords();
        this.checkOverdueItems();
        this.applyRouteShiftValidation();
        for (const passenger of this.passengers) {
            if (this.matchedIds.has(passenger.id))
                continue;
            const matchResult = this.matchPassengerToDriver(passenger);
            if (matchResult) {
                if (matchResult.status === types_1.MatchStatus.NORMAL) {
                    normalItems.push(matchResult);
                }
                else {
                    pendingItems.push(matchResult);
                }
            }
        }
        this.matchDriverToWarehouse(normalItems, pendingItems);
        this.associateImageIndexes(normalItems, pendingItems);
        const unmatched = this.handleUnmatchedItems();
        pendingItems.push(...unmatched);
        return {
            batchId: (0, matchUtils_1.generateBatchId)(),
            processDate: new Date().toISOString(),
            normalItems,
            pendingItems,
            failedItems: this.failedRecords,
            statistics: {
                total: this.passengers.length + this.drivers.length + this.warehouses.length,
                normal: normalItems.length,
                pending: pendingItems.length,
                failed: this.failedRecords.length
            }
        };
    }
    validateRecords() {
        const allRecords = [...this.passengers, ...this.drivers, ...this.warehouses];
        for (const record of allRecords) {
            if (!record.itemName || !record.date) {
                this.failedRecords.push({
                    originalData: (0, matchUtils_1.hideSensitiveInfo)(record),
                    failReason: types_1.FailReason.INCOMPLETE_INFO,
                    failDescription: '记录缺少必要信息',
                    suggestion: '请补充物品名称和日期信息后重新提交',
                    source: record.source
                });
                this.matchedIds.add(record.id);
            }
        }
    }
    checkOverdueItems() {
        for (const passenger of this.passengers) {
            if (this.matchedIds.has(passenger.id))
                continue;
            if ((0, matchUtils_1.isOverdue)(passenger.date, 90)) {
                const days = (0, matchUtils_1.getOverdueDays)(passenger.date);
                this.failedRecords.push({
                    originalData: (0, matchUtils_1.hideSensitiveInfo)(passenger),
                    failReason: types_1.FailReason.OVERDUE,
                    failDescription: `该乘客报失已逾期 ${days} 天（超过 90 天无人认领）`,
                    suggestion: '建议转入逾期物品专用仓库，登记造册后统一处理',
                    source: types_1.RecordSource.PASSENGER
                });
                this.matchedIds.add(passenger.id);
            }
        }
        for (const warehouse of this.warehouses) {
            if (this.matchedIds.has(warehouse.id))
                continue;
            if ((0, matchUtils_1.isOverdue)(warehouse.date, 180)) {
                const days = (0, matchUtils_1.getOverdueDays)(warehouse.date);
                this.failedRecords.push({
                    originalData: (0, matchUtils_1.hideSensitiveInfo)(warehouse),
                    failReason: types_1.FailReason.OVERDUE,
                    failDescription: `该物品入库已逾期 ${days} 天（超过 180 天无人认领）`,
                    suggestion: '超过保管期限，建议按规定进行拍卖或捐赠处理',
                    source: types_1.RecordSource.WAREHOUSE
                });
                this.matchedIds.add(warehouse.id);
            }
        }
    }
    matchPassengerToDriver(passenger) {
        let bestMatch = null;
        let highestConfidence = 0;
        const notes = [];
        for (const driver of this.drivers) {
            if (this.matchedIds.has(driver.id))
                continue;
            const confidence = this.calculateMatchConfidence(passenger, driver);
            if ((0, matchUtils_1.isSameNameItem)(passenger.itemName, driver.itemName)) {
                notes.push(`发现同名物品：乘客描述"${passenger.itemName}" vs 司机上交"${driver.itemName}"，系统判定为同类物品需人工确认`);
            }
            if (confidence > highestConfidence) {
                highestConfidence = confidence;
                bestMatch = driver;
            }
        }
        if (!bestMatch)
            return null;
        let status = types_1.MatchStatus.PENDING;
        if (highestConfidence >= 80) {
            status = types_1.MatchStatus.NORMAL;
            notes.unshift('三项信息高度匹配，可直接确认');
        }
        else if (highestConfidence >= 50) {
            notes.unshift('信息部分匹配，需要人工确认');
        }
        else {
            notes.unshift('匹配度较低，建议重新核对');
        }
        this.matchedIds.add(passenger.id);
        this.matchedIds.add(bestMatch.id);
        return {
            matchId: (0, matchUtils_1.generateMatchId)(),
            passengerRecord: passenger,
            driverRecord: bestMatch,
            status,
            confidence: highestConfidence,
            notes
        };
    }
    matchDriverToWarehouse(normalItems, pendingItems) {
        for (const item of [...normalItems, ...pendingItems]) {
            if (!item.driverRecord)
                continue;
            let bestMatch = null;
            let highestConfidence = 0;
            const additionalNotes = [];
            for (const warehouse of this.warehouses) {
                if (this.matchedIds.has(warehouse.id))
                    continue;
                const confidence = this.calculateMatchConfidence(item.driverRecord, warehouse);
                if ((0, matchUtils_1.isSameNameItem)(item.driverRecord.itemName, warehouse.itemName)) {
                    additionalNotes.push(`仓库入库发现同名物品："${item.driverRecord.itemName}" vs "${warehouse.itemName}"`);
                }
                if (confidence > highestConfidence) {
                    highestConfidence = confidence;
                    bestMatch = warehouse;
                }
            }
            if (bestMatch) {
                item.warehouseRecord = bestMatch;
                item.confidence = Math.round((item.confidence + highestConfidence) / 2);
                item.notes.push(...additionalNotes);
                if (item.confidence < 60 && item.status === types_1.MatchStatus.NORMAL) {
                    item.status = types_1.MatchStatus.PENDING;
                    item.notes.unshift('仓库匹配后置信度下降，转为待确认');
                }
                this.matchedIds.add(bestMatch.id);
            }
        }
    }
    handleUnmatchedItems() {
        const results = [];
        for (const driver of this.drivers) {
            if (this.matchedIds.has(driver.id))
                continue;
            let warehouseMatch = null;
            let highestConfidence = 0;
            const notes = ['暂无乘客报失记录'];
            for (const warehouse of this.warehouses) {
                if (this.matchedIds.has(warehouse.id))
                    continue;
                const confidence = this.calculateMatchConfidence(driver, warehouse);
                if (confidence > highestConfidence) {
                    highestConfidence = confidence;
                    warehouseMatch = warehouse;
                }
            }
            if (warehouseMatch) {
                this.matchedIds.add(warehouseMatch.id);
                notes.push(`已匹配仓库入库记录，匹配度 ${highestConfidence}%`);
            }
            this.matchedIds.add(driver.id);
            results.push({
                matchId: (0, matchUtils_1.generateMatchId)(),
                driverRecord: driver,
                warehouseRecord: warehouseMatch || undefined,
                status: types_1.MatchStatus.PENDING,
                confidence: warehouseMatch ? highestConfidence : 0,
                notes
            });
        }
        for (const warehouse of this.warehouses) {
            if (this.matchedIds.has(warehouse.id))
                continue;
            this.matchedIds.add(warehouse.id);
            results.push({
                matchId: (0, matchUtils_1.generateMatchId)(),
                warehouseRecord: warehouse,
                status: types_1.MatchStatus.PENDING,
                confidence: 0,
                notes: ['暂无乘客报失和司机上交记录']
            });
        }
        return results;
    }
    calculateMatchConfidence(record1, record2) {
        let confidence = 0;
        const weights = {
            itemName: 40,
            description: 25,
            date: 20,
            route: 15
        };
        const nameSimilarity = (0, matchUtils_1.calculateStringSimilarity)(record1.itemName, record2.itemName);
        confidence += (nameSimilarity / 100) * weights.itemName;
        const descSimilarity = (0, matchUtils_1.calculateStringSimilarity)(record1.description, record2.description);
        confidence += (descSimilarity / 100) * weights.description;
        if (record1.date && record2.date && record1.date === record2.date) {
            confidence += weights.date;
        }
        if (record1.routeId && record2.routeId && record1.routeId === record2.routeId) {
            confidence += weights.route;
        }
        return Math.round(confidence);
    }
    applyRouteShiftValidation() {
        if (this.routeShifts.length === 0)
            return;
        const routeMap = new Map();
        for (const rs of this.routeShifts) {
            const key = `${rs.routeId}-${rs.shiftId}`;
            routeMap.set(key, rs);
        }
        for (const driver of this.drivers) {
            if (this.matchedIds.has(driver.id))
                continue;
            if (driver.routeId && driver.shiftId) {
                const key = `${driver.routeId}-${driver.shiftId}`;
                const routeShift = routeMap.get(key);
                if (routeShift) {
                    if (routeShift.driverId && driver.driverId && routeShift.driverId !== driver.driverId) {
                        if (routeShift.busNumber) {
                            driver.busNumber = driver.busNumber || routeShift.busNumber;
                        }
                    }
                    if (routeShift.busNumber && !driver.busNumber) {
                        driver.busNumber = routeShift.busNumber;
                    }
                }
            }
        }
        for (const passenger of this.passengers) {
            if (this.matchedIds.has(passenger.id))
                continue;
            if (passenger.routeId && passenger.shiftId) {
                const key = `${passenger.routeId}-${passenger.shiftId}`;
                const routeShift = routeMap.get(key);
                if (routeShift && routeShift.driverId) {
                    const matchingDriver = this.drivers.find(d => d.driverId === routeShift.driverId);
                    if (matchingDriver) {
                        passenger.routeId = passenger.routeId || routeShift.routeId;
                    }
                }
            }
        }
    }
    associateImageIndexes(normalItems, pendingItems) {
        if (this.imageIndexes.length === 0)
            return;
        const allItems = [...normalItems, ...pendingItems];
        for (const item of allItems) {
            const itemIds = [];
            if (item.passengerRecord)
                itemIds.push(item.passengerRecord.id);
            if (item.driverRecord)
                itemIds.push(item.driverRecord.id);
            if (item.warehouseRecord)
                itemIds.push(item.warehouseRecord.id);
            const matchedImages = this.imageIndexes.filter(img => itemIds.includes(img.itemId));
            if (matchedImages.length > 0) {
                const imageInfo = matchedImages.map(img => ({
                    path: img.imagePath,
                    uploadDate: img.uploadDate,
                    source: img.source
                }));
                const note = `关联图片 ${matchedImages.length} 张: ${imageInfo.map(i => i.path).join(', ')}`;
                if (!item.notes.some(n => n.includes('关联图片'))) {
                    item.notes.push(note);
                }
            }
        }
        const unassociatedImages = this.imageIndexes.filter(img => {
            const allItemIds = new Set();
            for (const item of allItems) {
                if (item.passengerRecord)
                    allItemIds.add(item.passengerRecord.id);
                if (item.driverRecord)
                    allItemIds.add(item.driverRecord.id);
                if (item.warehouseRecord)
                    allItemIds.add(item.warehouseRecord.id);
            }
            return !allItemIds.has(img.itemId);
        });
        for (const img of unassociatedImages) {
            this.failedRecords.push({
                originalData: {
                    itemId: img.itemId,
                    imagePath: img.imagePath,
                    uploadDate: img.uploadDate,
                    source: img.source
                },
                failReason: types_1.FailReason.MISMATCH,
                failDescription: `图片索引未找到对应物品记录`,
                suggestion: '请核对物品编号是否正确，或补充对应的物品记录',
                source: img.source
            });
        }
    }
}
exports.MatchService = MatchService;
exports.matchService = new MatchService();
