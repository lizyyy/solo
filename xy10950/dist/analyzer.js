"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeData = analyzeData;
const types_1 = require("./types");
function analyzeData(data, options) {
    const driverMap = new Map(data.drivers.map(d => [d.driverId, d.name]));
    const routeMap = new Map(data.routes.map(r => [r.routeId, r]));
    const vehicleFuelMap = new Map();
    const vehicleMileageMap = new Map();
    const vehicleFuelRowsMap = new Map();
    const vehicleMileageRowsMap = new Map();
    for (const record of data.fuelRecords) {
        const current = vehicleFuelMap.get(record.vehicleId) || 0;
        vehicleFuelMap.set(record.vehicleId, current + record.fuelAmount);
        const rows = vehicleFuelRowsMap.get(record.vehicleId) || [];
        rows.push(record.originalRow);
        vehicleFuelRowsMap.set(record.vehicleId, rows);
    }
    for (const record of data.mileageRecords) {
        const current = vehicleMileageMap.get(record.vehicleId) || 0;
        vehicleMileageMap.set(record.vehicleId, current + record.distance);
        const rows = vehicleMileageRowsMap.get(record.vehicleId) || [];
        rows.push(record.originalRow);
        vehicleMileageRowsMap.set(record.vehicleId, rows);
    }
    const vehicleSummaries = [];
    let totalFuelConsumption = 0;
    let validVehicles = 0;
    for (const vehicle of data.vehicles) {
        const totalFuel = vehicleFuelMap.get(vehicle.vehicleId) || 0;
        const totalDistance = vehicleMileageMap.get(vehicle.vehicleId) || 0;
        const driverName = driverMap.get(vehicle.driverId) || `司机${vehicle.driverId}`;
        let fuelConsumptionPer100km = 0;
        let deviation = 0;
        let deviationPercent = 0;
        if (totalDistance > 0) {
            fuelConsumptionPer100km = (totalFuel / totalDistance) * 100;
            deviation = fuelConsumptionPer100km - vehicle.standardFuelConsumption;
            deviationPercent = (deviation / vehicle.standardFuelConsumption) * 100;
            totalFuelConsumption += fuelConsumptionPer100km;
            validVehicles++;
        }
        vehicleSummaries.push({
            vehicleId: vehicle.vehicleId,
            plateNumber: vehicle.plateNumber,
            driverName,
            totalFuel,
            totalDistance,
            fuelConsumptionPer100km,
            standardFuelConsumption: vehicle.standardFuelConsumption,
            deviation,
            deviationPercent
        });
    }
    const abnormalRecords = [];
    const routeGroups = new Map();
    const vehicleRouteMap = new Map();
    for (const record of data.mileageRecords) {
        if (record.routeId) {
            vehicleRouteMap.set(record.vehicleId, record.routeId);
        }
    }
    for (const summary of vehicleSummaries) {
        const hasFuel = summary.totalFuel > 0;
        const hasMileage = summary.totalDistance > 0;
        if (hasFuel && !hasMileage) {
            abnormalRecords.push(createAbnormalRecord(summary, '无里程数据', '车辆有加油记录但无对应的GPS里程数据，可能存在里程漏报', types_1.AbnormalLevel.SEVERE, vehicleFuelRowsMap.get(summary.vehicleId) || [], vehicleMileageRowsMap.get(summary.vehicleId) || []));
            continue;
        }
        if (!hasFuel && hasMileage) {
            abnormalRecords.push(createAbnormalRecord(summary, '无加油数据', '车辆有GPS里程数据但无对应的加油记录，可能存在油卡漏登记', types_1.AbnormalLevel.WARNING, vehicleFuelRowsMap.get(summary.vehicleId) || [], vehicleMileageRowsMap.get(summary.vehicleId) || []));
            continue;
        }
        if (!hasFuel && !hasMileage) {
            continue;
        }
        let level = types_1.AbnormalLevel.NORMAL;
        let abnormalType = '';
        let description = '';
        if (summary.deviationPercent >= options.criticalThreshold) {
            level = types_1.AbnormalLevel.CRITICAL;
            abnormalType = '油耗严重异常';
            description = `百公里油耗超出标准${summary.deviationPercent.toFixed(1)}%，可能存在偷油或严重故障`;
        }
        else if (summary.deviationPercent >= options.severeThreshold) {
            level = types_1.AbnormalLevel.SEVERE;
            abnormalType = '油耗显著异常';
            description = `百公里油耗超出标准${summary.deviationPercent.toFixed(1)}%，需要重点关注`;
        }
        else if (summary.deviationPercent >= options.warningThreshold) {
            level = types_1.AbnormalLevel.WARNING;
            abnormalType = '油耗偏高';
            description = `百公里油耗超出标准${summary.deviationPercent.toFixed(1)}%，建议核实`;
        }
        else if (summary.deviationPercent <= -options.warningThreshold) {
            level = types_1.AbnormalLevel.WARNING;
            abnormalType = '油耗偏低';
            description = `百公里油耗低于标准${Math.abs(summary.deviationPercent).toFixed(1)}%，可能里程记录有误`;
        }
        if (level !== types_1.AbnormalLevel.NORMAL) {
            const routeId = vehicleRouteMap.get(summary.vehicleId);
            const route = routeId ? routeMap.get(routeId) : undefined;
            abnormalRecords.push({
                ...createAbnormalRecord(summary, abnormalType, description, level, vehicleFuelRowsMap.get(summary.vehicleId) || [], vehicleMileageRowsMap.get(summary.vehicleId) || []),
                routeId,
                routeName: route?.routeName
            });
        }
        const routeId = vehicleRouteMap.get(summary.vehicleId);
        if (routeId) {
            const route = routeMap.get(routeId);
            if (route) {
                let group = routeGroups.get(routeId);
                if (!group) {
                    group = {
                        routeName: route.routeName,
                        vehicles: [],
                        averageFuelConsumption: 0
                    };
                    routeGroups.set(routeId, group);
                }
                group.vehicles.push(summary);
            }
        }
    }
    for (const [routeId, group] of routeGroups) {
        const validSummaries = group.vehicles.filter(v => v.totalDistance > 0);
        if (validSummaries.length > 0) {
            group.averageFuelConsumption = validSummaries.reduce((sum, v) => sum + v.fuelConsumptionPer100km, 0) / validSummaries.length;
        }
    }
    const abnormalVehicles = new Set(abnormalRecords.map(r => r.vehicleId)).size;
    return {
        summary: {
            totalVehicles: data.vehicles.length,
            totalFuelRecords: data.fuelRecords.length,
            totalMileageRecords: data.mileageRecords.length,
            totalBadRecords: data.badRecords.length,
            abnormalVehicles,
            averageFuelConsumption: validVehicles > 0 ? totalFuelConsumption / validVehicles : 0
        },
        badRecords: data.badRecords,
        vehicleSummaries,
        abnormalRecords,
        routeGroups
    };
}
function createAbnormalRecord(summary, abnormalType, description, level, fuelRecords, mileageRecords) {
    return {
        vehicleId: summary.vehicleId,
        plateNumber: summary.plateNumber,
        driverName: summary.driverName,
        abnormalType,
        description,
        level,
        fuelConsumptionPer100km: summary.fuelConsumptionPer100km,
        standardFuelConsumption: summary.standardFuelConsumption,
        deviation: summary.deviation,
        deviationPercent: summary.deviationPercent,
        totalFuel: summary.totalFuel,
        totalDistance: summary.totalDistance,
        relatedRecords: {
            fuelRecords,
            mileageRecords
        }
    };
}
