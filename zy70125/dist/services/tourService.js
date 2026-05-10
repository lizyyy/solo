"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTour = createTour;
exports.startTour = startTour;
exports.moveToNextCity = moveToNextCity;
exports.completeTour = completeTour;
exports.getTour = getTour;
exports.listTours = listTours;
exports.getTourStatusLabel = getTourStatusLabel;
const uuid_1 = require("uuid");
const storage_1 = require("../storage");
const cityService_1 = require("./cityService");
const caseService_1 = require("./caseService");
function createTour(input) {
    if (!input.caseIdentifiers || input.caseIdentifiers.length === 0) {
        return {
            success: false,
            message: '巡演清单必须包含至少一个设备箱',
        };
    }
    if (!input.cityIdentifiers || input.cityIdentifiers.length < 2) {
        return {
            success: false,
            message: '巡演清单必须包含至少两个城市节点（起点和终点）',
        };
    }
    const caseIds = [];
    for (const identifier of input.caseIdentifiers) {
        const result = (0, caseService_1.getCaseByIdentifier)(identifier);
        if (!result.success) {
            return { success: false, message: result.message };
        }
        const caseObj = result.data;
        if (caseObj.status !== 'in_stock') {
            return {
                success: false,
                message: `设备箱「${caseObj.caseNumber}」当前状态为「${(0, caseService_1.getCaseStatusLabel)(caseObj.status)}」，无法加入巡演。只有「在库」状态的设备箱才能开始巡演`,
            };
        }
        caseIds.push(caseObj.id);
    }
    const cityIds = [];
    for (const identifier of input.cityIdentifiers) {
        const result = (0, cityService_1.getCityByIdentifier)(identifier);
        if (!result.success) {
            return { success: false, message: result.message };
        }
        if (!result.data.isActive) {
            return {
                success: false,
                message: `城市「${result.data.name}」已停用，无法用于巡演清单`,
            };
        }
        cityIds.push(result.data.id);
    }
    const firstCityResult = (0, cityService_1.getCityByIdentifier)(input.cityIdentifiers[0]);
    const lastCityResult = (0, cityService_1.getCityByIdentifier)(input.cityIdentifiers[input.cityIdentifiers.length - 1]);
    const now = new Date().toISOString();
    const tour = {
        id: (0, uuid_1.v4)(),
        name: input.name,
        description: input.description,
        caseIds,
        citySequence: cityIds,
        currentCityIndex: 0,
        status: 'draft',
        createdAt: now,
        updatedAt: now,
    };
    (0, storage_1.updateDB)(d => ({
        ...d,
        tourManifests: [...d.tourManifests, tour],
    }));
    return {
        success: true,
        message: `巡演清单「${input.name}」已创建，包含 ${caseIds.length} 个设备箱，途经 ${cityIds.length} 个城市（从「${firstCityResult.data.name}」到「${lastCityResult.data.name}」）`,
        data: tour,
        suggestions: ['确认巡演清单当前为草稿状态，请在开始巡演前检查所有设备箱状态'],
    };
}
function startTour(tourId) {
    const db = (0, storage_1.getDB)();
    const tour = db.tourManifests.find(t => t.id === tourId);
    if (!tour) {
        return {
            success: false,
            message: `未找到ID为「${tourId}」的巡演清单`,
        };
    }
    if (tour.status === 'completed') {
        return {
            success: false,
            message: `该巡演清单「${tour.name}」已完成`,
        };
    }
    if (tour.status === 'in_progress') {
        return {
            success: false,
            message: `该巡演清单「${tour.name}」已在进行中`,
        };
    }
    for (const caseId of tour.caseIds) {
        const caseObj = db.equipmentCases.find(c => c.id === caseId);
        if (caseObj && caseObj.status !== 'in_stock') {
            const firstCity = db.cities.find(c => c.id === tour.citySequence[0]);
            if (caseObj.currentCityId !== tour.citySequence[0]) {
                return {
                    success: false,
                    message: `设备箱「${caseObj.caseNumber}」不在巡演起点「${tour.name}」的起点城市「${firstCity?.name || '未知'}」，当前在「${db.cities.find(c => c.id === caseObj.currentCityId)?.name || '未知城市'}」，请先将设备箱调拨到起点城市`,
                };
            }
        }
    }
    const now = new Date().toISOString();
    const firstCity = db.cities.find(c => c.id === tour.citySequence[0]);
    (0, storage_1.updateDB)(d => ({
        ...d,
        tourManifests: d.tourManifests.map(t => t.id === tourId
            ? {
                ...t,
                status: 'in_progress',
                updatedAt: now,
            }
            : t),
    }));
    return {
        success: true,
        message: `巡演「${tour.name}」已启动！从「${firstCity?.name}」出发，共 ${tour.caseIds.length} 个设备箱开始巡演`,
        data: { ...tour, status: 'in_progress', updatedAt: now },
    };
}
function moveToNextCity(tourId) {
    const db = (0, storage_1.getDB)();
    const tour = db.tourManifests.find(t => t.id === tourId);
    if (!tour) {
        return {
            success: false,
            message: `未找到ID为「${tourId}」的巡演清单`,
        };
    }
    if (tour.status !== 'in_progress') {
        return {
            success: false,
            message: `巡演清单「${tour.name}」当前状态不是「进行中」，无法移动城市`,
        };
    }
    const nextIndex = tour.currentCityIndex + 1;
    if (nextIndex >= tour.citySequence.length - 1) {
        return {
            success: false,
            message: `巡演清单「${tour.name}」已到达最后一个城市，无法继续移动。请使用 complete-tour 完成巡演`,
        };
    }
    const currentCity = db.cities.find(c => c.id === tour.citySequence[tour.currentCityIndex]);
    const nextCity = db.cities.find(c => c.id === tour.citySequence[nextIndex]);
    const now = new Date().toISOString();
    (0, storage_1.updateDB)(d => ({
        ...d,
        tourManifests: d.tourManifests.map(t => t.id === tourId
            ? {
                ...t,
                currentCityIndex: nextIndex,
                updatedAt: now,
            }
            : t),
        equipmentCases: d.equipmentCases.map(c => tour.caseIds.includes(c.id)
            ? {
                ...c,
                currentCityId: tour.citySequence[nextIndex],
                updatedAt: now,
            }
            : c),
    }));
    return {
        success: true,
        message: `巡演「${tour.name}」已从「${currentCity?.name}」移动到「${nextCity?.name}」，共 ${tour.caseIds.length} 个设备箱已同步更新位置`,
        data: {
            ...tour,
            currentCityIndex: nextIndex,
            updatedAt: now,
        },
    };
}
function completeTour(tourId) {
    const db = (0, storage_1.getDB)();
    const tour = db.tourManifests.find(t => t.id === tourId);
    if (!tour) {
        return {
            success: false,
            message: `未找到ID为「${tourId}」的巡演清单`,
        };
    }
    if (tour.status === 'completed') {
        return {
            success: false,
            message: `巡演清单「${tour.name}」已完成`,
        };
    }
    const lastCity = db.cities.find(c => c.id === tour.citySequence[tour.citySequence.length - 1]);
    const now = new Date().toISOString();
    (0, storage_1.updateDB)(d => ({
        ...d,
        tourManifests: d.tourManifests.map(t => t.id === tourId
            ? {
                ...t,
                status: 'completed',
                updatedAt: now,
            }
            : t),
    }));
    return {
        success: true,
        message: `巡演「${tour.name}」已在「${lastCity?.name}」完成！所有 ${tour.caseIds.length} 个设备箱已入库。请核对：` +
            `请检查设备箱状态，如有损坏请及时报告并创建维修。`,
        data: {
            ...tour,
            status: 'completed',
            updatedAt: now,
        },
        suggestions: [
            '请核对设备箱是否有缺件或损坏，如有请报告损坏记录',
            '检查所有设备箱状态是否正常',
        ],
    };
}
function getTour(tourId) {
    const db = (0, storage_1.getDB)();
    const tour = db.tourManifests.find(t => t.id === tourId);
    if (!tour) {
        return {
            success: false,
            message: `未找到ID为「${tourId}」的巡演清单`,
        };
    }
    const currentCity = db.cities.find(c => c.id === tour.citySequence[tour.currentCityIndex]);
    return {
        success: true,
        message: `巡演「${tour.name}」当前在「${currentCity?.name}」，状态：${tour.status === 'draft' ? '草稿' : tour.status === 'in_progress' ? '进行中' : '已完成'}`,
        data: tour,
    };
}
function listTours(statusFilter) {
    const db = (0, storage_1.getDB)();
    let filtered = [...db.tourManifests];
    if (statusFilter) {
        filtered = filtered.filter(t => t.status === statusFilter);
    }
    filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const draftCount = filtered.filter(t => t.status === 'draft').length;
    const inProgressCount = filtered.filter(t => t.status === 'in_progress').length;
    const completedCount = filtered.filter(t => t.status === 'completed').length;
    return {
        success: true,
        message: `共查询到 ${filtered.length} 个巡演清单：草稿 ${draftCount} 个，进行中 ${inProgressCount} 个，已完成 ${completedCount} 个`,
        data: filtered,
    };
}
function getTourStatusLabel(status) {
    const labels = {
        draft: '草稿',
        in_progress: '进行中',
        completed: '已完成',
    };
    return labels[status] || status;
}
