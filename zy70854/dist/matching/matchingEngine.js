"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MatchingEngine = void 0;
const fuse_js_1 = __importDefault(require("fuse.js"));
const uuid_1 = require("uuid");
const types_1 = require("../types");
class MatchingEngine {
    constructor() {
        this.OVERDUE_DAYS = 90;
        this.MATCH_THRESHOLD = 0.6;
        this.SENSITIVE_KEYWORDS = ['身份证', '护照', '银行卡', '钱包', '手机', '密码', '卡号'];
        this.fuseOptions = {
            keys: [
                { name: 'itemName', weight: 0.3 },
                { name: 'itemDescription', weight: 0.2 },
                { name: 'itemCategory', weight: 0.15 },
                { name: 'itemColor', weight: 0.1 },
                { name: 'itemBrand', weight: 0.1 },
                { name: 'routeNumber', weight: 0.1 },
                { name: 'lostLocation', weight: 0.05 }
            ],
            threshold: 0.4,
            includeScore: true,
            ignoreLocation: true
        };
    }
    matchPassengerToDriver(passengerItems, driverItems, routeSchedules) {
        const matchRecords = [];
        const matchedPassengerIds = new Set();
        const matchedDriverIds = new Set();
        const driverFuse = new fuse_js_1.default(driverItems, this.fuseOptions);
        for (const passenger of passengerItems) {
            if (matchedPassengerIds.has(passenger.id))
                continue;
            const candidates = this.findDriverCandidates(passenger, driverFuse, driverItems, routeSchedules);
            for (const candidate of candidates) {
                if (candidate.driverItem && !matchedDriverIds.has(candidate.driverItem.id)) {
                    if (candidate.matchScore >= this.MATCH_THRESHOLD) {
                        const matchRecord = this.createMatchRecord(passenger.id, candidate.driverItem.id, undefined, candidate);
                        matchRecords.push(matchRecord);
                        matchedPassengerIds.add(passenger.id);
                        matchedDriverIds.add(candidate.driverItem.id);
                        break;
                    }
                }
            }
        }
        const unmatchedPassengers = passengerItems.filter(p => !matchedPassengerIds.has(p.id));
        for (const passenger of unmatchedPassengers) {
            matchRecords.push(this.createUnmatchedRecord(passenger.id, undefined, undefined, 'passenger'));
        }
        const unmatchedDrivers = driverItems.filter(d => !matchedDriverIds.has(d.id));
        for (const driver of unmatchedDrivers) {
            matchRecords.push(this.createUnmatchedRecord(undefined, driver.id, undefined, 'driver'));
        }
        return matchRecords;
    }
    matchDriverToWarehouse(driverItems, warehouseItems, existingMatches) {
        const updatedMatches = [...existingMatches];
        const matchedWarehouseIds = new Set(existingMatches.filter(m => m.warehouseItemId).map(m => m.warehouseItemId));
        const warehouseFuse = new fuse_js_1.default(warehouseItems, this.fuseOptions);
        for (const driver of driverItems) {
            const existingMatch = updatedMatches.find(m => m.driverItemId === driver.id && m.status !== types_1.ItemStatus.UNMATCHED);
            if (!existingMatch)
                continue;
            const candidates = this.findWarehouseCandidates(driver, warehouseFuse, warehouseItems);
            for (const candidate of candidates) {
                if (candidate.warehouseItem && !matchedWarehouseIds.has(candidate.warehouseItem.id)) {
                    if (candidate.matchScore >= this.MATCH_THRESHOLD) {
                        existingMatch.warehouseItemId = candidate.warehouseItem.id;
                        existingMatch.matchScore = Math.min(existingMatch.matchScore, candidate.matchScore);
                        existingMatch.matchedFields = [...new Set([...existingMatch.matchedFields, ...candidate.matchedFields])];
                        existingMatch.differences = [...new Set([...existingMatch.differences, ...candidate.differences])];
                        existingMatch.differenceExplanations = [...existingMatch.differenceExplanations, ...candidate.differenceExplanations];
                        existingMatch.isSameName = existingMatch.isSameName || candidate.isSameName;
                        existingMatch.hasSensitiveInfo = existingMatch.hasSensitiveInfo || candidate.hasSensitiveInfo;
                        existingMatch.updatedAt = new Date().toISOString();
                        matchedWarehouseIds.add(candidate.warehouseItem.id);
                        break;
                    }
                }
            }
        }
        const unmatchedWarehouse = warehouseItems.filter(w => !matchedWarehouseIds.has(w.id));
        for (const warehouse of unmatchedWarehouse) {
            updatedMatches.push(this.createUnmatchedRecord(undefined, undefined, warehouse.id, 'warehouse'));
        }
        return updatedMatches;
    }
    findDriverCandidates(passenger, driverFuse, driverItems, routeSchedules) {
        const candidates = [];
        const searchResult = driverFuse.search(passenger.itemName + ' ' + passenger.itemDescription);
        for (const result of searchResult) {
            const driver = result.item;
            const matchedFields = [];
            const differences = [];
            const explanations = [];
            let score = 1 - (result.score || 0);
            if (passenger.routeNumber === driver.routeNumber) {
                matchedFields.push('routeNumber');
                score += 0.1;
            }
            else {
                differences.push(types_1.DifferenceType.LOCATION_MISMATCH);
                explanations.push(`线路不匹配: 乘客报失线路 ${passenger.routeNumber}, 司机上交线路 ${driver.routeNumber}`);
            }
            if (this.isDateMatch(passenger.lostDate, driver.foundDate)) {
                matchedFields.push('date');
                score += 0.1;
            }
            else {
                differences.push(types_1.DifferenceType.TIME_MISMATCH);
                explanations.push(`日期不匹配: 乘客报失日期 ${passenger.lostDate}, 司机上交日期 ${driver.foundDate}`);
            }
            if (passenger.busNumber && driver.busNumber && passenger.busNumber === driver.busNumber) {
                matchedFields.push('busNumber');
                score += 0.05;
            }
            if (passenger.itemName === driver.itemName) {
                matchedFields.push('itemName');
            }
            const isSameName = this.isSameNameMatch(passenger, driver);
            if (isSameName) {
                differences.push(types_1.DifferenceType.SAME_NAME);
                explanations.push(`同名物品警告: 存在多个同名 "${passenger.itemName}" 物品,请核对详细描述`);
            }
            const isOverdue = this.checkOverdue(driver.foundDate);
            if (isOverdue) {
                differences.push(types_1.DifferenceType.OVERDUE);
                explanations.push(`逾期警告: 该物品自 ${driver.foundDate} 起已超过 ${this.OVERDUE_DAYS} 天无人认领`);
            }
            const hasSensitiveInfo = this.checkSensitiveInfo(passenger.itemDescription + ' ' + driver.itemDescription);
            if (hasSensitiveInfo) {
                differences.push(types_1.DifferenceType.SENSITIVE_INFO);
                explanations.push(`敏感信息提醒: 该物品描述包含敏感信息,处理时请注意隐私保护`);
            }
            candidates.push({
                passengerItem: passenger,
                driverItem: driver,
                matchScore: Math.min(score, 1),
                matchedFields,
                differences,
                differenceExplanations: explanations,
                isSameName,
                isOverdue,
                hasSensitiveInfo
            });
        }
        return candidates.sort((a, b) => b.matchScore - a.matchScore);
    }
    findWarehouseCandidates(driver, warehouseFuse, warehouseItems) {
        const candidates = [];
        const searchResult = warehouseFuse.search(driver.itemName + ' ' + driver.itemDescription);
        for (const result of searchResult) {
            const warehouse = result.item;
            const matchedFields = [];
            const differences = [];
            const explanations = [];
            let score = 1 - (result.score || 0);
            if (driver.bagNumber && warehouse.bagNumber && driver.bagNumber === warehouse.bagNumber) {
                matchedFields.push('bagNumber');
                score += 0.2;
            }
            if (driver.id === warehouse.driverTurnInId) {
                matchedFields.push('driverTurnInId');
                score += 0.2;
            }
            if (driver.itemName === warehouse.itemName) {
                matchedFields.push('itemName');
            }
            if (driver.itemCategory === warehouse.itemCategory) {
                matchedFields.push('itemCategory');
                score += 0.05;
            }
            const isSameName = driver.itemName === warehouse.itemName;
            if (isSameName && driver.itemDescription !== warehouse.itemDescription) {
                differences.push(types_1.DifferenceType.SAME_NAME);
                explanations.push(`同名物品警告: 仓库存在同名 "${driver.itemName}" 物品,请核对编号`);
            }
            const isOverdue = this.checkOverdue(warehouse.receiptDate);
            if (isOverdue) {
                differences.push(types_1.DifferenceType.OVERDUE);
                explanations.push(`逾期警告: 该物品自 ${warehouse.receiptDate} 起已超过 ${this.OVERDUE_DAYS} 天无人认领`);
            }
            const hasSensitiveInfo = this.checkSensitiveInfo(driver.itemDescription + ' ' + warehouse.itemDescription);
            if (hasSensitiveInfo) {
                differences.push(types_1.DifferenceType.SENSITIVE_INFO);
                explanations.push(`敏感信息提醒: 该物品描述包含敏感信息,处理时请注意隐私保护`);
            }
            candidates.push({
                driverItem: driver,
                warehouseItem: warehouse,
                matchScore: Math.min(score, 1),
                matchedFields,
                differences,
                differenceExplanations: explanations,
                isSameName,
                isOverdue,
                hasSensitiveInfo
            });
        }
        return candidates.sort((a, b) => b.matchScore - a.matchScore);
    }
    createMatchRecord(passengerItemId, driverItemId, warehouseItemId, candidate) {
        const now = new Date().toISOString();
        return {
            id: (0, uuid_1.v4)(),
            matchId: `MATCH-${Date.now()}`,
            batchId: '',
            passengerItemId,
            driverItemId,
            warehouseItemId,
            matchScore: candidate.matchScore,
            status: types_1.ItemStatus.MATCHED,
            matchedFields: candidate.matchedFields,
            differences: candidate.differences,
            differenceExplanations: candidate.differenceExplanations,
            isSameName: candidate.isSameName,
            isOverdue: candidate.isOverdue,
            hasSensitiveInfo: candidate.hasSensitiveInfo,
            createdAt: now,
            updatedAt: now
        };
    }
    createUnmatchedRecord(passengerItemId, driverItemId, warehouseItemId, source) {
        const now = new Date().toISOString();
        return {
            id: (0, uuid_1.v4)(),
            matchId: `UNMATCH-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            batchId: '',
            passengerItemId,
            driverItemId,
            warehouseItemId,
            matchScore: 0,
            status: types_1.ItemStatus.UNMATCHED,
            matchedFields: [],
            differences: [],
            differenceExplanations: [`${source}来源记录未找到匹配项`],
            isSameName: false,
            isOverdue: false,
            hasSensitiveInfo: false,
            createdAt: now,
            updatedAt: now
        };
    }
    isDateMatch(date1, date2) {
        if (!date1 || !date2)
            return false;
        const d1 = new Date(date1);
        const d2 = new Date(date2);
        const diffDays = Math.abs((d1.getTime() - d2.getTime()) / (1000 * 60 * 60 * 24));
        return diffDays <= 2;
    }
    isSameNameMatch(passenger, driver) {
        return passenger.itemName === driver.itemName &&
            passenger.itemDescription !== driver.itemDescription;
    }
    checkOverdue(dateStr) {
        if (!dateStr)
            return false;
        const date = new Date(dateStr);
        const now = new Date();
        const diffDays = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
        return diffDays > this.OVERDUE_DAYS;
    }
    checkSensitiveInfo(text) {
        return this.SENSITIVE_KEYWORDS.some(keyword => text.includes(keyword));
    }
    updateOverdueStatus(matches, allItems) {
        return matches.map(match => {
            let isOverdue = false;
            const relevantDate = this.getRelevantDate(match, allItems);
            if (relevantDate) {
                isOverdue = this.checkOverdue(relevantDate);
            }
            return {
                ...match,
                isOverdue,
                updatedAt: new Date().toISOString()
            };
        });
    }
    getRelevantDate(match, allItems) {
        if (match.passengerItemId) {
            const item = allItems.find(i => i.id === match.passengerItemId);
            if (item)
                return item.lostDate || item.reportDate;
        }
        if (match.driverItemId) {
            const item = allItems.find(i => i.id === match.driverItemId);
            if (item)
                return item.foundDate || item.turnInDate;
        }
        if (match.warehouseItemId) {
            const item = allItems.find(i => i.id === match.warehouseItemId);
            if (item)
                return item.receiptDate;
        }
        return null;
    }
}
exports.MatchingEngine = MatchingEngine;
