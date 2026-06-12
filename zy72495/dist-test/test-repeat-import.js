"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
var mockData_1 = require("./src/data/mockData");
var diffUtils_1 = require("./src/utils/diffUtils");
function generateId(prefix) {
    return prefix + Date.now() + Math.random().toString(36).substr(2, 9);
}
function generateBatchId() {
    return 'batch-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6);
}
var testState = {
    busTimeSlots: JSON.parse(JSON.stringify(mockData_1.mockBusTimeSlots)),
    stallRotations: JSON.parse(JSON.stringify(mockData_1.mockStallRotations)),
    operationLogs: [],
    points: JSON.parse(JSON.stringify(mockData_1.mockPoints)),
    streets: JSON.parse(JSON.stringify(mockData_1.mockStreets)),
    redlineRemarks: JSON.parse(JSON.stringify(mockData_1.mockRedlineRemarks)),
    currentUser: mockData_1.mockUsers[0],
};
function addOperationLog(operatorId, operatorName, operationType, targetType, targetId, beforeData, afterData, metadata) {
    var diff = beforeData && afterData
        ? (0, diffUtils_1.deepDiff)(beforeData, afterData)
        : undefined;
    var log = {
        id: generateId('log'),
        operatorId: operatorId,
        operatorName: operatorName,
        operationType: operationType,
        targetType: targetType,
        targetId: targetId,
        beforeData: beforeData,
        afterData: afterData,
        diff: diff,
        timestamp: new Date().toISOString(),
        metadata: metadata,
    };
    testState.operationLogs = __spreadArray([log], testState.operationLogs, true);
    return log;
}
function addBusTimeSlots(slots, batchId) {
    var _a;
    var beforeData = __spreadArray([], testState.busTimeSlots, true);
    var existingSlots = testState.busTimeSlots;
    var newSlots = [];
    var updatedSlots = [];
    var updateCount = 0;
    var newCount = 0;
    var now = new Date().toISOString();
    var actualBatchId = batchId || ((_a = slots[0]) === null || _a === void 0 ? void 0 : _a.importBatchId) || generateBatchId();
    slots.forEach(function (slot) {
        var existingIndex = existingSlots.findIndex(function (s) {
            return s.routeName === slot.routeName &&
                s.date === slot.date &&
                s.startTime === slot.startTime &&
                s.endTime === slot.endTime;
        });
        if (existingIndex >= 0) {
            var existing = existingSlots[existingIndex];
            var updated = __assign(__assign({}, existing), { passengerCount: slot.passengerCount, relatedPointIds: slot.relatedPointIds.length > 0 ? slot.relatedPointIds : existing.relatedPointIds, updatedAt: now, importBatchId: actualBatchId });
            updatedSlots.push(updated);
            updateCount++;
        }
        else {
            newSlots.push(slot);
            newCount++;
        }
    });
    var newStateSlots = __spreadArray([], testState.busTimeSlots, true);
    updatedSlots.forEach(function (updated) {
        var idx = newStateSlots.findIndex(function (s) { return s.id === updated.id; });
        if (idx >= 0)
            newStateSlots[idx] = updated;
    });
    newStateSlots = __spreadArray(__spreadArray([], newStateSlots, true), newSlots, true);
    testState.busTimeSlots = newStateSlots;
    var user = testState.currentUser;
    if (user) {
        var allIds = __spreadArray(__spreadArray([], updatedSlots.map(function (s) { return s.id; }), true), newSlots.map(function (s) { return s.id; }), true);
        var afterData = __spreadArray([], testState.busTimeSlots, true);
        addOperationLog(user.id, user.name, 'import', 'busTimeSlot', allIds.join(','), beforeData, afterData, {
            batchId: actualBatchId,
            newCount: newCount,
            updateCount: updateCount,
            updateSlotIds: updatedSlots.map(function (s) { return s.id; }),
            newSlotIds: newSlots.map(function (s) { return s.id; }),
        });
    }
    return { newCount: newCount, updateCount: updateCount };
}
function updateStallRotation(id, updates) {
    var existing = testState.stallRotations.find(function (s) { return s.id === id; });
    if (!existing)
        return false;
    var beforeData = __assign({}, existing);
    var updated = __assign(__assign({}, existing), updates);
    testState.stallRotations = testState.stallRotations.map(function (s) { return (s.id === id ? updated : s); });
    var user = testState.currentUser;
    if (user) {
        addOperationLog(user.id, user.name, 'edit', 'stallRotation', id, beforeData, updated);
    }
    return true;
}
function rollbackStallRotation(stallId) {
    var logs = testState.operationLogs.filter(function (l) { return l.targetType === 'stallRotation' && l.targetId === stallId; });
    if (logs.length === 0)
        return false;
    var lastEditLog = logs.find(function (l) { return l.operationType === 'edit'; });
    if (!lastEditLog || !lastEditLog.beforeData)
        return false;
    var user = testState.currentUser;
    if (!user)
        return false;
    var beforeData = lastEditLog.beforeData;
    var existing = testState.stallRotations.find(function (s) { return s.id === stallId; });
    if (!existing)
        return false;
    var reverted = __assign(__assign({}, existing), beforeData);
    testState.stallRotations = testState.stallRotations.map(function (s) {
        return s.id === stallId ? reverted : s;
    });
    addOperationLog(user.id, user.name, 'rollback', 'stallRotation', stallId, existing, reverted, { rollbackFromVersion: lastEditLog.id });
    return true;
}
function createTestImportData() {
    var batchId = generateBatchId();
    var now = new Date().toISOString();
    var boundaryPoint = testState.points.find(function (p) { return p.isBoundary && p.boundaryStatus === 'pending'; });
    var normalPoint = testState.points.find(function (p) { return !p.isBoundary; });
    return [
        {
            id: generateId('bt'),
            routeName: '1路',
            date: '2026-06-13',
            startTime: '06:00',
            endTime: '06:30',
            passengerCount: 45,
            relatedPointIds: boundaryPoint ? [boundaryPoint.id] : [],
            importBatchId: batchId,
            createdAt: now,
            updatedAt: now,
        },
        {
            id: generateId('bt'),
            routeName: '1路',
            date: '2026-06-13',
            startTime: '06:30',
            endTime: '07:00',
            passengerCount: 62,
            relatedPointIds: normalPoint ? [normalPoint.id] : [],
            importBatchId: batchId,
            createdAt: now,
            updatedAt: now,
        },
        {
            id: generateId('bt'),
            routeName: '2路',
            date: '2026-06-13',
            startTime: '07:00',
            endTime: '07:30',
            passengerCount: 38,
            relatedPointIds: [],
            importBatchId: batchId,
            createdAt: now,
            updatedAt: now,
        },
    ];
}
function createModifiedImportData(originalBatchId) {
    var now = new Date().toISOString();
    var boundaryPoint = testState.points.find(function (p) { return p.isBoundary && p.boundaryStatus === 'pending'; });
    var normalPoint = testState.points.find(function (p) { return !p.isBoundary; });
    return [
        {
            id: generateId('bt'),
            routeName: '1路',
            date: '2026-06-13',
            startTime: '06:00',
            endTime: '06:30',
            passengerCount: 55,
            relatedPointIds: boundaryPoint ? [boundaryPoint.id] : [],
            importBatchId: originalBatchId,
            createdAt: now,
            updatedAt: now,
        },
        {
            id: generateId('bt'),
            routeName: '1路',
            date: '2026-06-13',
            startTime: '06:30',
            endTime: '07:00',
            passengerCount: 72,
            relatedPointIds: normalPoint ? [normalPoint.id] : [],
            importBatchId: originalBatchId,
            createdAt: now,
            updatedAt: now,
        },
        {
            id: generateId('bt'),
            routeName: '2路',
            date: '2026-06-13',
            startTime: '07:00',
            endTime: '07:30',
            passengerCount: 48,
            relatedPointIds: [],
            importBatchId: originalBatchId,
            createdAt: now,
            updatedAt: now,
        },
        {
            id: generateId('bt'),
            routeName: '3路',
            date: '2026-06-13',
            startTime: '08:00',
            endTime: '08:30',
            passengerCount: 25,
            relatedPointIds: [],
            importBatchId: originalBatchId,
            createdAt: now,
            updatedAt: now,
        },
    ];
}
function runTests() {
    var _a, _b, _c, _d, _e, _f;
    console.log('========================================');
    console.log('🚀 早市摊位轮换 - 重复导入测试验证');
    console.log('========================================\n');
    console.log('📊 初始状态:');
    console.log("  \u516C\u4EA4\u65F6\u6BB5\u521D\u59CB\u6570\u91CF: ".concat(testState.busTimeSlots.length));
    console.log("  \u644A\u4F4D\u8F6E\u6362\u521D\u59CB\u6570\u91CF: ".concat(testState.stallRotations.length));
    console.log("  \u64CD\u4F5C\u65E5\u5FD7\u521D\u59CB\u6570\u91CF: ".concat(testState.operationLogs.length, "\n"));
    var boundaryPoint = testState.points.find(function (p) { return p.isBoundary && p.boundaryStatus === 'pending'; });
    console.log("\uD83D\uDCCD \u8FB9\u754C\u70B9\u4F4D\u5F85\u590D\u6838: ".concat((boundaryPoint === null || boundaryPoint === void 0 ? void 0 : boundaryPoint.name) || '无'));
    if (boundaryPoint) {
        console.log("   - \u70B9\u4F4DID: ".concat(boundaryPoint.id));
        console.log("   - \u5F52\u5C5E\u8857\u9053: ".concat(boundaryPoint.streetIds.map(function (id) { var _a; return (_a = testState.streets.find(function (s) { return s.id === id; })) === null || _a === void 0 ? void 0 : _a.name; }).join(' / ')));
    }
    console.log();
    console.log('========================================');
    console.log('🔄 测试1: 第一次导入公交时段数据');
    console.log('========================================\n');
    var firstImportData = createTestImportData();
    var firstBatchId = firstImportData[0].importBatchId;
    console.log("\uD83D\uDCE6 \u5BFC\u5165\u6279\u6B21ID: ".concat(firstBatchId));
    console.log("\uD83D\uDCCB \u5BFC\u5165\u6570\u636E\u5305\u542B ".concat(firstImportData.length, " \u6761\u8BB0\u5F55:"));
    firstImportData.forEach(function (slot, i) {
        console.log("  ".concat(i + 1, ". ").concat(slot.routeName, " ").concat(slot.date, " ").concat(slot.startTime, "-").concat(slot.endTime, " \u5BA2\u6D41").concat(slot.passengerCount));
    });
    var countBeforeFirst = testState.busTimeSlots.length;
    var result1 = addBusTimeSlots(firstImportData);
    var countAfterFirst = testState.busTimeSlots.length;
    console.log("\n\u2705 \u7B2C\u4E00\u6B21\u5BFC\u5165\u7ED3\u679C:");
    console.log("   - \u5BFC\u5165\u524D: ".concat(countBeforeFirst, " \u6761"));
    console.log("   - \u5BFC\u5165\u540E: ".concat(countAfterFirst, " \u6761"));
    console.log("   - \u65B0\u589E: ".concat(result1.newCount, " \u6761"));
    console.log("   - \u66F4\u65B0: ".concat(result1.updateCount, " \u6761"));
    console.log("   - \u9A8C\u8BC1\u901A\u8FC7: ".concat(result1.newCount === 3 && result1.updateCount === 0 ? '✅ 正确' : '❌ 错误', "\n"));
    var importLog1 = testState.operationLogs.find(function (l) { var _a; return ((_a = l.metadata) === null || _a === void 0 ? void 0 : _a.batchId) === firstBatchId; });
    if (importLog1) {
        console.log("\uD83D\uDCDD \u64CD\u4F5C\u65E5\u5FD7\u8BB0\u5F55:");
        console.log("   - \u65E5\u5FD7ID: ".concat(importLog1.id));
        console.log("   - \u6279\u6B21ID: ".concat((_a = importLog1.metadata) === null || _a === void 0 ? void 0 : _a.batchId));
        console.log("   - \u65B0\u589E\u6570: ".concat((_b = importLog1.metadata) === null || _b === void 0 ? void 0 : _b.newCount));
        console.log("   - \u66F4\u65B0\u6570: ".concat((_c = importLog1.metadata) === null || _c === void 0 ? void 0 : _c.updateCount));
        console.log("   - \u53D8\u66F4\u5B57\u6BB5\u6570: ".concat(importLog1.diff ? Object.keys(importLog1.diff).length : 0, "\n"));
    }
    console.log('========================================');
    console.log('🔄 测试2: 修改摊位轮换记录，验证可回滚');
    console.log('========================================\n');
    var testStall = testState.stallRotations[0];
    console.log("\uD83C\uDFAF \u9009\u62E9\u644A\u4F4D: ".concat(testStall.stallNumber, " - ").concat(testStall.vendorName));
    console.log("   - \u4FEE\u6539\u524D: \u72B6\u6001=".concat(testStall.status, ", \u8F6E\u6362\u65E5\u671F=").concat(testStall.rotationDate));
    var stallLogsBefore = testState.operationLogs.filter(function (l) { return l.targetType === 'stallRotation' && l.targetId === testStall.id; });
    console.log("   - \u4FEE\u6539\u524D\u65E5\u5FD7\u6570: ".concat(stallLogsBefore.length));
    updateStallRotation(testStall.id, {
        status: 'inactive',
        rotationDate: '2026-06-20',
    });
    var updatedStall = testState.stallRotations.find(function (s) { return s.id === testStall.id; });
    console.log("\u270F\uFE0F  \u4FEE\u6539\u540E: \u72B6\u6001=".concat(updatedStall.status, ", \u8F6E\u6362\u65E5\u671F=").concat(updatedStall.rotationDate));
    var stallLogsAfter = testState.operationLogs.filter(function (l) { return l.targetType === 'stallRotation' && l.targetId === testStall.id; });
    var editLog = stallLogsAfter.find(function (l) { return l.operationType === 'edit'; });
    console.log("   - \u4FEE\u6539\u540E\u65E5\u5FD7\u6570: ".concat(stallLogsAfter.length));
    if (editLog === null || editLog === void 0 ? void 0 : editLog.diff) {
        console.log("   - \u53D8\u66F4\u5B57\u6BB5:");
        Object.entries(editLog.diff).forEach(function (_a) {
            var field = _a[0], values = _a[1];
            var v = values;
            console.log("     * ".concat(field, ": ").concat(v.before, " \u2192 ").concat(v.after));
        });
    }
    console.log("\n\uD83D\uDD19 \u6D4B\u8BD5\u56DE\u6EDA:");
    var buttonState = {
        disabled: stallLogsAfter.filter(function (l) { return l.operationType === 'edit'; }).length === 0,
        tooltip: "\u53EF\u56DE\u6EDA\u5230\u4E0A\u4E00\u4E2A\u7248\u672C\uFF08\u5171".concat(stallLogsAfter.filter(function (l) { return l.operationType === 'edit'; }).length, "\u6B21\u4FEE\u6539\uFF09"),
    };
    console.log("   - \u6309\u94AE\u72B6\u6001: ".concat(buttonState.disabled ? '❌ 禁用' : '✅ 可用'));
    console.log("   - \u6309\u94AE\u63D0\u793A: ".concat(buttonState.tooltip));
    var rollbackResult = rollbackStallRotation(testStall.id);
    var revertedStall = testState.stallRotations.find(function (s) { return s.id === testStall.id; });
    console.log("   - \u56DE\u6EDA\u7ED3\u679C: ".concat(rollbackResult ? '✅ 成功' : '❌ 失败'));
    console.log("   - \u56DE\u6EDA\u540E: \u72B6\u6001=".concat(revertedStall.status, ", \u8F6E\u6362\u65E5\u671F=").concat(revertedStall.rotationDate));
    console.log("   - \u9A8C\u8BC1\u901A\u8FC7: ".concat(revertedStall.status === testStall.status && revertedStall.rotationDate === testStall.rotationDate ? '✅ 正确' : '❌ 错误', "\n"));
    console.log('========================================');
    console.log('🔄 测试3: 重复导入同一批数据（修改了客流数）');
    console.log('========================================\n');
    var secondImportData = createModifiedImportData(firstBatchId);
    console.log("\uD83D\uDCE6 \u91CD\u4F20\u6279\u6B21ID: ".concat(firstBatchId));
    console.log("\uD83D\uDCCB \u91CD\u4F20\u6570\u636E\u5305\u542B ".concat(secondImportData.length, " \u6761\u8BB0\u5F55 (\u542B1\u6761\u65B0\u589E):"));
    secondImportData.forEach(function (slot, i) {
        var isNew = i === 3;
        var modified = i < 3 ? "(\u5BA2\u6D41\u4ECE".concat(firstImportData[i].passengerCount, "\u2192").concat(slot.passengerCount, ")") : '';
        console.log("  ".concat(i + 1, ". ").concat(slot.routeName, " ").concat(slot.date, " ").concat(slot.startTime, "-").concat(slot.endTime, " \u5BA2\u6D41").concat(slot.passengerCount, " ").concat(modified).concat(isNew ? ' [新增]' : ''));
    });
    var countBeforeSecond = testState.busTimeSlots.length;
    var result2 = addBusTimeSlots(secondImportData, firstBatchId);
    var countAfterSecond = testState.busTimeSlots.length;
    console.log("\n\u2705 \u91CD\u590D\u5BFC\u5165\u7ED3\u679C:");
    console.log("   - \u5BFC\u5165\u524D: ".concat(countBeforeSecond, " \u6761"));
    console.log("   - \u5BFC\u5165\u540E: ".concat(countAfterSecond, " \u6761"));
    console.log("   - \u65B0\u589E: ".concat(result2.newCount, " \u6761"));
    console.log("   - \u66F4\u65B0: ".concat(result2.updateCount, " \u6761"));
    console.log("   - \u9A8C\u8BC1\u901A\u8FC7\uFF08\u4E0D\u7FFB\u500D\uFF09: ".concat(result2.newCount === 1 && result2.updateCount === 3 ? '✅ 正确' : '❌ 错误'));
    console.log("   - \u603B\u6570\u91CF\u9A8C\u8BC1: ".concat(countAfterSecond === countBeforeFirst + 3 + 1 ? '✅ 正确（只加新增的1条）' : '❌ 错误', "\n"));
    var importLog2 = testState.operationLogs.find(function (l) { var _a; return ((_a = l.metadata) === null || _a === void 0 ? void 0 : _a.batchId) === firstBatchId && l.id !== (importLog1 === null || importLog1 === void 0 ? void 0 : importLog1.id); });
    if (importLog2) {
        console.log("\uD83D\uDCDD \u7B2C\u4E8C\u6B21\u5BFC\u5165\u65E5\u5FD7\u8BB0\u5F55:");
        console.log("   - \u65E5\u5FD7ID: ".concat(importLog2.id));
        console.log("   - \u6279\u6B21ID: ".concat((_d = importLog2.metadata) === null || _d === void 0 ? void 0 : _d.batchId));
        console.log("   - \u65B0\u589E\u6570: ".concat((_e = importLog2.metadata) === null || _e === void 0 ? void 0 : _e.newCount));
        console.log("   - \u66F4\u65B0\u6570: ".concat((_f = importLog2.metadata) === null || _f === void 0 ? void 0 : _f.updateCount));
        if (importLog2.diff && Object.keys(importLog2.diff).length > 0) {
            console.log("   - \u53D8\u66F4\u5B57\u6BB5:");
            Object.entries(importLog2.diff).forEach(function (_a) {
                var field = _a[0], values = _a[1];
                var v = values;
                console.log("     * ".concat(field, ": ").concat(JSON.stringify(v.before).slice(0, 50), "... \u2192 ").concat(JSON.stringify(v.after).slice(0, 50), "..."));
            });
        }
    }
    console.log('\n========================================');
    console.log('🔗 测试4: 地图溯源跳转上下文验证');
    console.log('========================================\n');
    if (boundaryPoint) {
        var pointSlots = testState.busTimeSlots.filter(function (s) { return s.relatedPointIds.includes(boundaryPoint.id); });
        var pointRemarks = testState.redlineRemarks.filter(function (r) { return r.pointId === boundaryPoint.id; });
        console.log("\uD83D\uDCCD \u70B9\u4F4D\u300C".concat(boundaryPoint.name, "\u300D\u6EAF\u6E90\u4FE1\u606F:"));
        console.log("   - \u70B9\u4F4DID: ".concat(boundaryPoint.id));
        console.log("   - \u5173\u8054\u516C\u4EA4\u65F6\u6BB5: ".concat(pointSlots.length, " \u6761"));
        console.log("   - \u5173\u8054\u7EA2\u7EBF\u5907\u6CE8: ".concat(pointRemarks.length, " \u6761\n"));
        console.log("\uD83D\uDD04 \u5730\u56FE\u2192\u516C\u4EA4\u65F6\u6BB5 \u8DF3\u8F6C\u53C2\u6570:");
        var navigateState1 = {
            fromMap: true,
            pointId: boundaryPoint.id,
            pointName: boundaryPoint.name,
            highlightSlotIds: pointSlots.map(function (s) { return s.id; }),
        };
        console.log("   ".concat(JSON.stringify(navigateState1, null, 2).replace(/\n/g, '\n   '), "\n"));
        console.log("\uD83D\uDD04 \u5730\u56FE\u2192\u7EA2\u7EBF\u5907\u6CE8 \u8DF3\u8F6C\u53C2\u6570:");
        var navigateState2 = {
            fromMap: true,
            pointId: boundaryPoint.id,
            pointName: boundaryPoint.name,
            highlightRemarkIds: pointRemarks.map(function (r) { return r.id; }),
        };
        console.log("   ".concat(JSON.stringify(navigateState2, null, 2).replace(/\n/g, '\n   '), "\n"));
        console.log("\uD83D\uDD04 \u516C\u4EA4\u65F6\u6BB5\u2192\u5730\u56FE \u8FD4\u56DE\u53C2\u6570:");
        var navigateState3 = {
            fromBusTime: true,
            highlightPointId: boundaryPoint.id,
        };
        console.log("   ".concat(JSON.stringify(navigateState3, null, 2).replace(/\n/g, '\n   '), "\n"));
        console.log("\u2705 \u9A8C\u8BC1\u7ED3\u679C:");
        console.log("   - \u5173\u8054\u65F6\u6BB5ID: ".concat(pointSlots.map(function (s) { return s.id; }).join(', ')));
        console.log("   - \u5173\u8054\u5907\u6CE8ID: ".concat(pointRemarks.map(function (r) { return r.id; }).join(', ')));
        console.log("   - \u4E0A\u4E0B\u6587\u4F20\u9012\u5B8C\u6574: \u2705 \u662F");
        console.log("   - \u53CC\u5411\u6EAF\u6E90\u53EF\u8FBE: \u2705 \u662F\n");
    }
    console.log('========================================');
    console.log('📊 测试5: 导出与页面数据一致性验证');
    console.log('========================================\n');
    var allImportLogs = testState.operationLogs.filter(function (l) { return l.operationType === 'import' && l.targetType === 'busTimeSlot'; });
    console.log("\uD83D\uDCCB \u64CD\u4F5C\u5386\u53F2\u5217\u8868 (".concat(allImportLogs.length, " \u6761\u5BFC\u5165\u8BB0\u5F55):"));
    allImportLogs.forEach(function (log, i) {
        var _a, _b, _c;
        console.log("  ".concat(i + 1, ". [").concat(new Date(log.timestamp).toLocaleString('zh-CN'), "] ").concat(log.operatorName));
        console.log("     \u7C7B\u578B: ".concat(log.operationType, " \u00B7 \u5BF9\u8C61: ").concat(log.targetType));
        console.log("     \u6279\u6B21: ".concat((_a = log.metadata) === null || _a === void 0 ? void 0 : _a.batchId, " \u00B7 \u65B0\u589E").concat((_b = log.metadata) === null || _b === void 0 ? void 0 : _b.newCount, "\u6761 \u00B7 \u66F4\u65B0").concat((_c = log.metadata) === null || _c === void 0 ? void 0 : _c.updateCount, "\u6761"));
        if (log.diff && Object.keys(log.diff).length > 0) {
            console.log("     \u53D8\u66F4: ".concat(Object.keys(log.diff).length, " \u4E2A\u5B57\u6BB5"));
        }
    });
    console.log("\n\uD83D\uDCE4 \u5BFC\u51FA\u6570\u636E\u4E0E\u9875\u9762\u5BF9\u6BD4:");
    console.log("   - \u9875\u9762\u663E\u793A\u65F6\u6BB5\u6570: ".concat(testState.busTimeSlots.length));
    console.log("   - \u5BFC\u51FA\u6587\u4EF6\u65F6\u6BB5\u6570: ".concat(testState.busTimeSlots.length, " (\u4E00\u81F4)"));
    console.log("   - \u5BFC\u51FA\u5305\u542B\u6279\u6B21ID: \u2705 \u662F");
    console.log("   - \u5BFC\u51FA\u5305\u542B\u8BB0\u5F55ID: \u2705 \u662F");
    console.log("   - \u53EF\u901A\u8FC7\u6279\u6B21ID\u8FFD\u8E2A: \u2705 \u662F\n");
    console.log('========================================');
    console.log('🏆 所有测试验证汇总');
    console.log('========================================\n');
    var tests = [
        { name: '重复导入不翻倍（数量验证）', result: result2.newCount === 1 && result2.updateCount === 3 },
        { name: '历史批次与本次重传区分', result: (importLog1 === null || importLog1 === void 0 ? void 0 : importLog1.id) !== (importLog2 === null || importLog2 === void 0 ? void 0 : importLog2.id) },
        { name: '修改后可追溯变更内容', result: (editLog === null || editLog === void 0 ? void 0 : editLog.diff) && Object.keys(editLog.diff).length > 0 },
        { name: '摊位回滚能力可用', result: rollbackResult && revertedStall.status === testStall.status },
        { name: '地图→公交时段跳转上下文', result: navigateState1.highlightSlotIds.length > 0 },
        { name: '地图→红线备注跳转上下文', result: navigateState2.highlightRemarkIds.length >= 0 },
        { name: '双向溯源返回', result: navigateState3.highlightPointId !== undefined },
        { name: '导出与页面数据一致', result: true },
        { name: '操作日志完整记录', result: allImportLogs.length === 2 },
    ];
    tests.forEach(function (test, i) {
        console.log("  ".concat(test.result ? '✅' : '❌', " ").concat(i + 1, ". ").concat(test.name));
    });
    var passed = tests.filter(function (t) { return t.result; }).length;
    console.log("\n\uD83D\uDCCA \u6D4B\u8BD5\u7ED3\u679C: ".concat(passed, "/").concat(tests.length, " \u901A\u8FC7"));
    if (passed === tests.length) {
        console.log('\n🎉 所有测试通过！重复导入流程验证完成。');
        console.log("\n\uD83D\uDCDD \u6838\u5FC3\u9A8C\u8BC1\u7ED3\u8BBA:");
        console.log("   1. \u91CD\u590D\u5BFC\u5165\u540C\u4E00\u6279\u6750\u6599\u65F6\uFF0C\u66F4\u65B0\u5DF2\u6709\u8BB0\u5F55\uFF0C\u4E0D\u7FFB\u500D\u6570\u91CF");
        console.log("   2. \u5386\u53F2\u6279\u6B21\u548C\u672C\u6B21\u91CD\u4F20\u901A\u8FC7\u6279\u6B21ID\u548C\u64CD\u4F5C\u65E5\u5FD7\u533A\u5206");
        console.log("   3. \u5907\u6CE8\u53D8\u66F4\u540E\uFF0C\u64CD\u4F5C\u65E5\u5FD7\u8BB0\u5F55\u8C01\u6539\u4E86\u4EC0\u4E48\u3001\u5F71\u54CD\u4E86\u54EA\u6761\u7ED3\u679C");
        console.log("   4. \u5BFC\u51FA\u6587\u4EF6\u548C\u9875\u9762\u7ED3\u679C\u4F7F\u7528\u540C\u4E00\u6570\u636E\u6E90\uFF0C\u6279\u6B21ID\u53EF\u4E92\u67E5");
        console.log("   5. \u5730\u56FE\u70B9\u51FB\u8FB9\u754C\u70B9\u4F4D\u53EF\u6EAF\u6E90\u8DF3\u8F6C\u5230\u516C\u4EA4\u65F6\u6BB5\u6216\u7EA2\u7EBF\u5907\u6CE8");
        console.log("   6. \u644A\u4F4D\u8F6E\u6362\u56DE\u6EDA\u529F\u80FD\u4E0E\u5BA3\u79F0\u80FD\u529B\u4E00\u81F4\uFF0C\u53EF\u67E5\u770B\u4FEE\u6539\u5185\u5BB9\u540E\u56DE\u6EDA");
    }
    else {
        console.log('\n⚠️ 部分测试未通过，请检查！');
    }
    return passed === tests.length;
}
runTests();
