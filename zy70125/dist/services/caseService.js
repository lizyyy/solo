"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCase = createCase;
exports.getCaseByIdentifier = getCaseByIdentifier;
exports.listCases = listCases;
exports.updateCaseItems = updateCaseItems;
exports.getCaseStatusLabel = getCaseStatusLabel;
const uuid_1 = require("uuid");
const storage_1 = require("../storage");
const cityService_1 = require("./cityService");
function createCase(input) {
    const cityResult = (0, cityService_1.getCityByIdentifier)(input.cityIdentifier);
    if (!cityResult.success) {
        return { success: false, message: cityResult.message };
    }
    const city = cityResult.data;
    const db = (0, storage_1.getDB)();
    const existingCase = db.equipmentCases.find(c => c.caseNumber === input.caseNumber);
    if (existingCase) {
        return {
            success: false,
            message: `设备箱编号「${input.caseNumber}」已存在，请使用其他编号`,
        };
    }
    if (!input.items || input.items.length === 0) {
        return {
            success: false,
            message: '设备箱必须包含至少一个设备项',
        };
    }
    const items = input.items.map(item => ({
        id: (0, uuid_1.v4)(),
        name: item.name,
        quantity: item.quantity,
        unitValue: item.unitValue,
        serialNumber: item.serialNumber,
        condition: item.condition || 'good',
    }));
    const totalValue = items.reduce((sum, item) => sum + item.quantity * item.unitValue, 0);
    const now = new Date().toISOString();
    const caseObj = {
        id: (0, uuid_1.v4)(),
        caseNumber: input.caseNumber,
        name: input.name,
        description: input.description,
        items,
        currentCityId: city.id,
        status: 'in_stock',
        totalValue,
        createdAt: now,
        updatedAt: now,
    };
    (0, storage_1.updateDB)(d => ({
        ...d,
        equipmentCases: [...d.equipmentCases, caseObj],
    }));
    return {
        success: true,
        message: `设备箱「${caseObj.caseNumber}」已入库到「${city.name}」，共 ${items.length} 项设备，总值 ¥${totalValue.toFixed(2)}`,
        data: caseObj,
    };
}
function getCaseByIdentifier(identifier) {
    const db = (0, storage_1.getDB)();
    let caseObj = db.equipmentCases.find(c => c.id === identifier);
    if (!caseObj) {
        caseObj = db.equipmentCases.find(c => c.caseNumber === identifier);
    }
    if (!caseObj) {
        return {
            success: false,
            message: `未找到标识为「${identifier}」的设备箱，请确认ID或箱号是否正确`,
        };
    }
    return {
        success: true,
        message: `找到设备箱「${caseObj.caseNumber}」`,
        data: caseObj,
    };
}
function listCases(cityIdentifier, statusFilter) {
    const db = (0, storage_1.getDB)();
    let filtered = [...db.equipmentCases];
    if (cityIdentifier) {
        const cityResult = (0, cityService_1.getCityByIdentifier)(cityIdentifier);
        if (!cityResult.success) {
            return {
                success: false,
                message: cityResult.message,
                data: [],
            };
        }
        filtered = filtered.filter(c => c.currentCityId === cityResult.data.id);
    }
    if (statusFilter) {
        filtered = filtered.filter(c => c.status === statusFilter);
    }
    filtered.sort((a, b) => a.caseNumber.localeCompare(b.caseNumber));
    const totalValue = filtered.reduce((sum, c) => sum + c.totalValue, 0);
    return {
        success: true,
        message: `共查询到 ${filtered.length} 个设备箱，设备总值 ¥${totalValue.toFixed(2)}`,
        data: filtered,
    };
}
function updateCaseItems(caseIdentifier, items) {
    const caseResult = getCaseByIdentifier(caseIdentifier);
    if (!caseResult.success) {
        return caseResult;
    }
    const caseObj = caseResult.data;
    if (caseObj.status === 'lent_out') {
        return {
            success: false,
            message: `设备箱「${caseObj.caseNumber}」当前处于借出状态，无法修改箱内物品`,
        };
    }
    if (caseObj.status === 'under_repair') {
        return {
            success: false,
            message: `设备箱「${caseObj.caseNumber}」当前处于维修状态，无法修改箱内物品`,
        };
    }
    const newItems = items.map(item => ({
        id: (0, uuid_1.v4)(),
        name: item.name,
        quantity: item.quantity,
        unitValue: item.unitValue,
        serialNumber: item.serialNumber,
        condition: item.condition || 'good',
    }));
    const totalValue = newItems.reduce((sum, item) => sum + item.quantity * item.unitValue, 0);
    (0, storage_1.updateDB)(d => ({
        ...d,
        equipmentCases: d.equipmentCases.map(c => c.id === caseObj.id
            ? {
                ...c,
                items: newItems,
                totalValue,
                updatedAt: new Date().toISOString(),
            }
            : c),
    }));
    return {
        success: true,
        message: `设备箱「${caseObj.caseNumber}」物品已更新，共 ${newItems.length} 项，总值 ¥${totalValue.toFixed(2)}`,
        data: { ...caseObj, items: newItems, totalValue, updatedAt: new Date().toISOString() },
    };
}
function getCaseStatusLabel(status) {
    const labels = {
        in_stock: '在库',
        in_transit: '运输中',
        lent_out: '已借出',
        under_repair: '维修中',
        lost: '已丢失',
        damaged: '已损坏',
    };
    return labels[status] || status;
}
