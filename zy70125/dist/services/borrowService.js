"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.borrowCase = borrowCase;
exports.returnCase = returnCase;
exports.getActiveBorrow = getActiveBorrow;
exports.listBorrowRecords = listBorrowRecords;
const uuid_1 = require("uuid");
const storage_1 = require("../storage");
const caseService_1 = require("./caseService");
const cityService_1 = require("./cityService");
function borrowCase(input) {
    const caseResult = (0, caseService_1.getCaseByIdentifier)(input.caseIdentifier);
    if (!caseResult.success) {
        return { success: false, message: caseResult.message };
    }
    const caseObj = caseResult.data;
    if (caseObj.status !== 'in_stock') {
        return {
            success: false,
            message: `设备箱「${caseObj.caseNumber}」当前状态为「${(0, caseService_1.getCaseStatusLabel)(caseObj.status)}」，无法借出。只有「在库」状态的设备箱才能借出`,
        };
    }
    let toCityId;
    let toCityName = '同城使用';
    if (input.toCityIdentifier) {
        const cityResult = (0, cityService_1.getCityByIdentifier)(input.toCityIdentifier);
        if (!cityResult.success) {
            return { success: false, message: cityResult.message };
        }
        toCityId = cityResult.data.id;
        toCityName = cityResult.data.name;
    }
    const fromCityResult = (0, cityService_1.getCityByIdentifier)(caseObj.currentCityId);
    const fromCityName = fromCityResult.success ? fromCityResult.data.name : '未知城市';
    const itemsSnapshot = caseObj.items.map(item => ({ ...item }));
    const now = new Date().toISOString();
    const record = {
        id: (0, uuid_1.v4)(),
        caseId: caseObj.id,
        fromCityId: caseObj.currentCityId,
        toCityId,
        borrowedBy: input.borrowedBy,
        expectedReturnTime: input.expectedReturnTime,
        itemsAtBorrow: itemsSnapshot,
        status: 'active',
        remarks: input.remarks,
        createdAt: now,
        updatedAt: now,
    };
    (0, storage_1.updateDB)(d => ({
        ...d,
        borrowRecords: [...d.borrowRecords, record],
        equipmentCases: d.equipmentCases.map(c => c.id === caseObj.id
            ? {
                ...c,
                status: 'lent_out',
                currentCityId: toCityId || c.currentCityId,
                updatedAt: now,
            }
            : c),
    }));
    return {
        success: true,
        message: `设备箱「${caseObj.caseNumber}」已由「${input.borrowedBy}」从「${fromCityName}」借出${toCityId ? `至「${toCityName}」` : ''}，借出时共 ${caseObj.items.length} 项设备。预计归还时间：${input.expectedReturnTime || '未指定'}`,
        data: record,
    };
}
function returnCase(input) {
    const caseResult = (0, caseService_1.getCaseByIdentifier)(input.caseIdentifier);
    if (!caseResult.success) {
        return { success: false, message: caseResult.message };
    }
    const caseObj = caseResult.data;
    const db = (0, storage_1.getDB)();
    const activeBorrow = db.borrowRecords.find(r => r.caseId === caseObj.id && r.status === 'active');
    if (!activeBorrow) {
        return {
            success: false,
            message: `设备箱「${caseObj.caseNumber}」当前没有进行中的借出记录，无法执行归还操作`,
        };
    }
    let returnCityId = activeBorrow.fromCityId;
    if (input.returnedToCityIdentifier) {
        const cityResult = (0, cityService_1.getCityByIdentifier)(input.returnedToCityIdentifier);
        if (!cityResult.success) {
            return { success: false, message: cityResult.message };
        }
        returnCityId = cityResult.data.id;
    }
    const missingItems = [];
    const conditionChanges = [];
    let returnItems = caseObj.items.map(item => ({ ...item }));
    if (input.itemsAtReturn && input.itemsAtReturn.length > 0) {
        returnItems = input.itemsAtReturn.map(item => ({
            id: (0, uuid_1.v4)(),
            name: item.name,
            quantity: item.quantity,
            unitValue: item.unitValue,
            serialNumber: item.serialNumber,
            condition: item.condition || 'good',
        }));
        for (const borrowed of activeBorrow.itemsAtBorrow) {
            const returned = returnItems.find(r => r.name === borrowed.name);
            if (!returned) {
                missingItems.push({
                    name: borrowed.name,
                    expectedQty: borrowed.quantity,
                    actualQty: 0,
                    difference: borrowed.quantity,
                });
            }
            else if (returned.quantity < borrowed.quantity) {
                missingItems.push({
                    name: borrowed.name,
                    expectedQty: borrowed.quantity,
                    actualQty: returned.quantity,
                    difference: borrowed.quantity - returned.quantity,
                });
            }
            if (returned && returned.condition !== borrowed.condition) {
                const conditionLabels = {
                    new: '全新',
                    good: '良好',
                    fair: '一般',
                    poor: '较差',
                };
                conditionChanges.push({
                    name: borrowed.name,
                    oldCondition: conditionLabels[borrowed.condition] || borrowed.condition,
                    newCondition: conditionLabels[returned.condition] || returned.condition,
                });
            }
        }
    }
    const now = new Date().toISOString();
    (0, storage_1.updateDB)(d => ({
        ...d,
        borrowRecords: d.borrowRecords.map(r => r.id === activeBorrow.id
            ? {
                ...r,
                status: 'completed',
                actualReturnTime: now,
                itemsAtReturn: returnItems,
                remarks: input.remarks || r.remarks,
                updatedAt: now,
            }
            : r),
        equipmentCases: d.equipmentCases.map(c => c.id === caseObj.id
            ? {
                ...c,
                status: 'in_stock',
                currentCityId: returnCityId,
                items: returnItems,
                updatedAt: now,
            }
            : c),
    }));
    const updatedRecord = {
        ...activeBorrow,
        status: 'completed',
        actualReturnTime: now,
        itemsAtReturn: returnItems,
        remarks: input.remarks || activeBorrow.remarks,
        updatedAt: now,
    };
    let message = `设备箱「${caseObj.caseNumber}」已成功归还`;
    if (missingItems.length > 0) {
        message += `，注意：有 ${missingItems.length} 项设备数量不足`;
    }
    if (conditionChanges.length > 0) {
        message += `，有 ${conditionChanges.length} 项设备状态有变化`;
    }
    return {
        success: true,
        message,
        data: {
            record: updatedRecord,
            missingItems,
            conditionChanges,
        },
        suggestions: missingItems.length > 0 || conditionChanges.length > 0
            ? ['建议创建损坏记录或启动补偿流程，明确责任归属']
            : undefined,
    };
}
function getActiveBorrow(caseIdentifier) {
    const caseResult = (0, caseService_1.getCaseByIdentifier)(caseIdentifier);
    if (!caseResult.success) {
        return { success: false, message: caseResult.message };
    }
    const db = (0, storage_1.getDB)();
    const activeBorrow = db.borrowRecords.find(r => r.caseId === caseResult.data.id && r.status === 'active');
    if (!activeBorrow) {
        return {
            success: false,
            message: `设备箱「${caseResult.data.caseNumber}」当前没有进行中的借出记录`,
        };
    }
    return {
        success: true,
        message: `找到设备箱「${caseResult.data.caseNumber}」的借出记录`,
        data: activeBorrow,
    };
}
function listBorrowRecords(caseIdentifier, statusFilter) {
    const db = (0, storage_1.getDB)();
    let filtered = [...db.borrowRecords];
    if (caseIdentifier) {
        const caseResult = (0, caseService_1.getCaseByIdentifier)(caseIdentifier);
        if (!caseResult.success) {
            return {
                success: false,
                message: caseResult.message,
                data: [],
            };
        }
        filtered = filtered.filter(r => r.caseId === caseResult.data.id);
    }
    if (statusFilter) {
        filtered = filtered.filter(r => r.status === statusFilter);
    }
    filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return {
        success: true,
        message: `共查询到 ${filtered.length} 条借出记录`,
        data: filtered,
    };
}
