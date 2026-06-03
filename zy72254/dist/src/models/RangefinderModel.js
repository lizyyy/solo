"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRangefinderRecord = createRangefinderRecord;
exports.calculateDistance = calculateDistance;
exports.validateRangefinderRecord = validateRangefinderRecord;
const idGenerator_1 = require("../utils/idGenerator");
function createRangefinderRecord(params) {
    return {
        id: (0, idGenerator_1.generateRangefinderId)(),
        obstructionId: params.obstructionId,
        measuredAt: Date.now(),
        measuredBy: params.measuredBy,
        distance: params.distance,
        fromPoint: params.fromPoint,
        toPoint: params.toPoint,
        notes: params.notes,
        accuracy: params.accuracy ?? 0.01
    };
}
function calculateDistance(from, to) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dz = to.z - from.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
}
function validateRangefinderRecord(record) {
    const errors = [];
    if (!record.obstructionId) {
        errors.push('缺少障碍物ID');
    }
    if (!record.measuredBy) {
        errors.push('缺少测量人员信息');
    }
    if (record.distance <= 0) {
        errors.push('测量距离必须大于0');
    }
    const calculatedDistance = calculateDistance(record.fromPoint, record.toPoint);
    const tolerance = record.accuracy ?? 0.01;
    if (Math.abs(calculatedDistance - record.distance) > tolerance) {
        errors.push(`记录距离(${record.distance.toFixed(2)}m)与坐标计算距离(${calculatedDistance.toFixed(2)}m)不符，误差超过${tolerance}m`);
    }
    return {
        valid: errors.length === 0,
        errors
    };
}
//# sourceMappingURL=RangefinderModel.js.map