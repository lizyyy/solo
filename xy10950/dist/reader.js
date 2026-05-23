"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.readVehicles = readVehicles;
exports.readFuelRecords = readFuelRecords;
exports.readMileageRecords = readMileageRecords;
exports.readDrivers = readDrivers;
exports.readRoutes = readRoutes;
const fs = __importStar(require("fs"));
function parseCsvFile(filePath, type, headers, parser) {
    const data = [];
    const badRecords = [];
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    let headerLine = 0;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim()) {
            headerLine = i;
            break;
        }
    }
    const actualHeaders = lines[headerLine].split(',').map(h => h.trim().toLowerCase());
    const headerMap = {};
    for (let i = 0; i < actualHeaders.length; i++) {
        headerMap[actualHeaders[i]] = i;
    }
    for (let i = headerLine + 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim())
            continue;
        const originalRow = i + 1;
        const values = line.split(',').map(v => v.trim());
        try {
            const record = {};
            for (const header of headers) {
                const lowerHeader = header.toLowerCase();
                const idx = headerMap[lowerHeader];
                if (idx === undefined) {
                    throw new Error(`缺少必需字段: ${header}`);
                }
                record[header] = values[idx] || '';
            }
            data.push(parser(record, originalRow));
        }
        catch (error) {
            badRecords.push({
                type,
                originalRow,
                rawData: line,
                error: error.message
            });
        }
    }
    return { data, badRecords };
}
function readVehicles(filePath) {
    const headers = ['vehicleId', 'plateNumber', 'model', 'standardFuelConsumption', 'driverId'];
    return parseCsvFile(filePath, 'vehicles', headers, (record, rowNum) => {
        const standardFuelConsumption = parseFloat(record.standardFuelConsumption);
        if (isNaN(standardFuelConsumption) || standardFuelConsumption <= 0) {
            throw new Error('标准油耗必须是正数');
        }
        if (!record.vehicleId)
            throw new Error('车辆ID不能为空');
        if (!record.plateNumber)
            throw new Error('车牌号不能为空');
        return {
            vehicleId: record.vehicleId,
            plateNumber: record.plateNumber,
            model: record.model,
            standardFuelConsumption,
            driverId: record.driverId,
            originalRow: rowNum
        };
    });
}
function readFuelRecords(filePath) {
    const headers = ['recordId', 'vehicleId', 'date', 'fuelAmount', 'fuelType', 'price', 'gasStation'];
    return parseCsvFile(filePath, 'fuel', headers, (record, rowNum) => {
        const fuelAmount = parseFloat(record.fuelAmount);
        const price = parseFloat(record.price);
        if (!record.recordId)
            throw new Error('记录ID不能为空');
        if (!record.vehicleId)
            throw new Error('车辆ID不能为空');
        if (isNaN(fuelAmount) || fuelAmount <= 0)
            throw new Error('加油量必须是正数');
        return {
            recordId: record.recordId,
            vehicleId: record.vehicleId,
            date: record.date,
            fuelAmount,
            fuelType: record.fuelType,
            price: isNaN(price) ? 0 : price,
            gasStation: record.gasStation,
            originalRow: rowNum
        };
    });
}
function readMileageRecords(filePath) {
    const headers = ['recordId', 'vehicleId', 'date', 'startMileage', 'endMileage', 'distance', 'routeId'];
    return parseCsvFile(filePath, 'mileage', headers, (record, rowNum) => {
        const startMileage = parseFloat(record.startMileage);
        const endMileage = parseFloat(record.endMileage);
        let distance = parseFloat(record.distance);
        if (!record.recordId)
            throw new Error('记录ID不能为空');
        if (!record.vehicleId)
            throw new Error('车辆ID不能为空');
        if (isNaN(startMileage))
            throw new Error('起始里程无效');
        if (isNaN(endMileage))
            throw new Error('结束里程无效');
        if (endMileage < startMileage) {
            throw new Error('结束里程不能小于起始里程');
        }
        if (isNaN(distance) || distance <= 0) {
            distance = endMileage - startMileage;
        }
        return {
            recordId: record.recordId,
            vehicleId: record.vehicleId,
            date: record.date,
            startMileage,
            endMileage,
            distance,
            routeId: record.routeId,
            originalRow: rowNum
        };
    });
}
function readDrivers(filePath) {
    if (!filePath)
        return { data: [], badRecords: [] };
    const headers = ['driverId', 'name', 'phone', 'licenseNumber'];
    return parseCsvFile(filePath, 'drivers', headers, (record, rowNum) => {
        if (!record.driverId)
            throw new Error('司机ID不能为空');
        if (!record.name)
            throw new Error('司机姓名不能为空');
        return {
            driverId: record.driverId,
            name: record.name,
            phone: record.phone,
            licenseNumber: record.licenseNumber,
            originalRow: rowNum
        };
    });
}
function readRoutes(filePath) {
    if (!filePath)
        return { data: [], badRecords: [] };
    const headers = ['routeId', 'routeName', 'startLocation', 'endLocation', 'standardDistance'];
    return parseCsvFile(filePath, 'routes', headers, (record, rowNum) => {
        const standardDistance = parseFloat(record.standardDistance);
        if (!record.routeId)
            throw new Error('路线ID不能为空');
        if (!record.routeName)
            throw new Error('路线名称不能为空');
        if (isNaN(standardDistance) || standardDistance <= 0)
            throw new Error('标准距离必须是正数');
        return {
            routeId: record.routeId,
            routeName: record.routeName,
            startLocation: record.startLocation,
            endLocation: record.endLocation,
            standardDistance,
            originalRow: rowNum
        };
    });
}
