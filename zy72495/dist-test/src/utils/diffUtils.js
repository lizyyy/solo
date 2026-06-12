"use strict";
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
exports.deepDiff = deepDiff;
exports.formatDiffResults = formatDiffResults;
exports.getFieldDisplayName = getFieldDisplayName;
function deepDiff(obj1, obj2) {
    var diff = {};
    var allKeys = new Set(__spreadArray(__spreadArray([], Object.keys(obj1), true), Object.keys(obj2), true));
    for (var _i = 0, allKeys_1 = allKeys; _i < allKeys_1.length; _i++) {
        var key = allKeys_1[_i];
        var val1 = obj1[key];
        var val2 = obj2[key];
        if (JSON.stringify(val1) !== JSON.stringify(val2)) {
            diff[key] = { before: val1, after: val2 };
        }
    }
    return diff;
}
function formatDiffResults(diff) {
    return Object.entries(diff).map(function (_a) {
        var field = _a[0], values = _a[1];
        return ({
            field: field,
            before: values.before,
            after: values.after,
        });
    });
}
function getFieldDisplayName(field) {
    var fieldNames = {
        name: '点位名称',
        content: '备注内容',
        boundaryStatus: '边界状态',
        routeName: '线路名称',
        startTime: '开始时间',
        endTime: '结束时间',
        passengerCount: '客流数',
        date: '日期',
        stallNumber: '摊位号',
        vendorName: '摊主姓名',
        rotationDate: '轮换日期',
        status: '状态',
        reviewRemark: '复核意见',
    };
    return fieldNames[field] || field;
}
