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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseCSV = parseCSV;
exports.parseJSON = parseJSON;
exports.transformPassengerRecord = transformPassengerRecord;
exports.transformDriverRecord = transformDriverRecord;
exports.transformWarehouseRecord = transformWarehouseRecord;
exports.transformRouteShift = transformRouteShift;
exports.transformImageIndex = transformImageIndex;
exports.calculateFileHash = calculateFileHash;
const fs = __importStar(require("fs"));
const csv_parser_1 = __importDefault(require("csv-parser"));
const types_1 = require("../types");
async function parseCSV(filePath) {
    const results = [];
    return new Promise((resolve, reject) => {
        fs.createReadStream(filePath)
            .pipe((0, csv_parser_1.default)())
            .on('data', (data) => results.push(data))
            .on('end', () => resolve(results))
            .on('error', reject);
    });
}
async function parseJSON(filePath) {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    return JSON.parse(content);
}
function transformPassengerRecord(raw) {
    return {
        id: raw.id || raw.记录编号 || `P${Date.now()}${Math.random().toString(36).substr(2, 5)}`,
        itemName: raw.itemName || raw.物品名称 || '',
        description: raw.description || raw.物品描述 || '',
        date: raw.date || raw.遗失日期 || '',
        routeId: raw.routeId || raw.线路编号,
        shiftId: raw.shiftId || raw.班次编号,
        source: types_1.RecordSource.PASSENGER,
        passengerName: raw.passengerName || raw.乘客姓名 || '',
        passengerPhone: raw.passengerPhone || raw.乘客电话 || '',
        passengerId: raw.passengerId || raw.乘客身份证,
        claimDate: raw.claimDate || raw.认领日期
    };
}
function transformDriverRecord(raw) {
    return {
        id: raw.id || raw.记录编号 || `D${Date.now()}${Math.random().toString(36).substr(2, 5)}`,
        itemName: raw.itemName || raw.物品名称 || '',
        description: raw.description || raw.物品描述 || '',
        date: raw.date || raw.捡到日期 || '',
        routeId: raw.routeId || raw.线路编号,
        shiftId: raw.shiftId || raw.班次编号,
        source: types_1.RecordSource.DRIVER,
        driverName: raw.driverName || raw.司机姓名 || '',
        driverId: raw.driverId || raw.司机工号 || '',
        busNumber: raw.busNumber || raw.车牌号 || '',
        handoverDate: raw.handoverDate || raw.上交日期 || ''
    };
}
function transformWarehouseRecord(raw) {
    return {
        id: raw.id || raw.记录编号 || `W${Date.now()}${Math.random().toString(36).substr(2, 5)}`,
        itemName: raw.itemName || raw.物品名称 || '',
        description: raw.description || raw.物品描述 || '',
        date: raw.date || raw.入库日期 || '',
        routeId: raw.routeId || raw.线路编号,
        shiftId: raw.shiftId || raw.班次编号,
        source: types_1.RecordSource.WAREHOUSE,
        storageLocation: raw.storageLocation || raw.存放位置 || '',
        storageDate: raw.storageDate || raw.入库日期 || '',
        operator: raw.operator || raw.操作员 || ''
    };
}
function transformRouteShift(raw) {
    return {
        routeId: raw.routeId || raw.线路编号 || '',
        routeName: raw.routeName || raw.线路名称 || '',
        shiftId: raw.shiftId || raw.班次编号 || '',
        shiftTime: raw.shiftTime || raw.发车时间 || '',
        driverId: raw.driverId || raw.司机工号,
        busNumber: raw.busNumber || raw.车牌号
    };
}
function transformImageIndex(raw) {
    return {
        itemId: raw.itemId || raw.物品编号 || '',
        imagePath: raw.imagePath || raw.图片路径 || '',
        uploadDate: raw.uploadDate || raw.上传日期 || '',
        source: raw.source || raw.来源 || types_1.RecordSource.WAREHOUSE
    };
}
function calculateFileHash(content) {
    return require('crypto').createHash('md5').update(content).digest('hex');
}
