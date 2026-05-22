"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CsvImporter = void 0;
const csv_parser_1 = __importDefault(require("csv-parser"));
const stream_1 = require("stream");
const uuid_1 = require("uuid");
const types_1 = require("../types");
class CsvImporter {
    async importPassengerLostItems(csvContent) {
        const results = [];
        const errors = [];
        let rowIndex = 0;
        return new Promise((resolve) => {
            const stream = stream_1.Readable.from(csvContent);
            stream
                .pipe((0, csv_parser_1.default)())
                .on('data', (data) => {
                rowIndex++;
                try {
                    const item = this.parsePassengerRow(data, rowIndex);
                    if (item) {
                        results.push(item);
                    }
                }
                catch (error) {
                    errors.push(`第 ${rowIndex} 行: ${error.message}`);
                }
            })
                .on('end', () => {
                resolve({
                    success: errors.length === 0,
                    data: results,
                    errors,
                    totalCount: rowIndex,
                    validCount: results.length,
                    invalidCount: errors.length
                });
            });
        });
    }
    async importDriverTurnedInItems(csvContent) {
        const results = [];
        const errors = [];
        let rowIndex = 0;
        return new Promise((resolve) => {
            const stream = stream_1.Readable.from(csvContent);
            stream
                .pipe((0, csv_parser_1.default)())
                .on('data', (data) => {
                rowIndex++;
                try {
                    const item = this.parseDriverRow(data, rowIndex);
                    if (item) {
                        results.push(item);
                    }
                }
                catch (error) {
                    errors.push(`第 ${rowIndex} 行: ${error.message}`);
                }
            })
                .on('end', () => {
                resolve({
                    success: errors.length === 0,
                    data: results,
                    errors,
                    totalCount: rowIndex,
                    validCount: results.length,
                    invalidCount: errors.length
                });
            });
        });
    }
    async importWarehouseItems(csvContent) {
        const results = [];
        const errors = [];
        let rowIndex = 0;
        return new Promise((resolve) => {
            const stream = stream_1.Readable.from(csvContent);
            stream
                .pipe((0, csv_parser_1.default)())
                .on('data', (data) => {
                rowIndex++;
                try {
                    const item = this.parseWarehouseRow(data, rowIndex);
                    if (item) {
                        results.push(item);
                    }
                }
                catch (error) {
                    errors.push(`第 ${rowIndex} 行: ${error.message}`);
                }
            })
                .on('end', () => {
                resolve({
                    success: errors.length === 0,
                    data: results,
                    errors,
                    totalCount: rowIndex,
                    validCount: results.length,
                    invalidCount: errors.length
                });
            });
        });
    }
    parsePassengerRow(data, rowIndex) {
        const requiredFields = ['reportDate', 'passengerName', 'passengerPhone', 'itemName', 'itemDescription', 'itemCategory', 'routeNumber', 'lostDate', 'lostLocation'];
        const missingFields = requiredFields.filter(field => !data[field]);
        if (missingFields.length > 0) {
            throw new Error(`缺少必填字段: ${missingFields.join(', ')}`);
        }
        return {
            id: (0, uuid_1.v4)(),
            reportDate: this.normalizeDate(data.reportDate),
            reportTime: data.reportTime || '',
            passengerName: data.passengerName,
            passengerPhone: data.passengerPhone,
            itemName: data.itemName,
            itemDescription: data.itemDescription,
            itemCategory: data.itemCategory,
            itemColor: data.itemColor || '',
            itemBrand: data.itemBrand || '',
            routeNumber: data.routeNumber,
            busNumber: data.busNumber || '',
            lostDate: this.normalizeDate(data.lostDate),
            lostTime: data.lostTime || '',
            lostLocation: data.lostLocation,
            destination: data.destination || '',
            seatLocation: data.seatLocation || '',
            remarks: data.remarks || '',
            source: types_1.RecordSource.PASSENGER
        };
    }
    parseDriverRow(data, rowIndex) {
        const requiredFields = ['turnInDate', 'driverName', 'driverId', 'routeNumber', 'busNumber', 'itemName', 'itemDescription', 'itemCategory', 'foundDate', 'foundLocation'];
        const missingFields = requiredFields.filter(field => !data[field]);
        if (missingFields.length > 0) {
            throw new Error(`缺少必填字段: ${missingFields.join(', ')}`);
        }
        const imageIds = data.imageIds ? data.imageIds.split(',').map((id) => id.trim()).filter(Boolean) : [];
        return {
            id: (0, uuid_1.v4)(),
            turnInDate: this.normalizeDate(data.turnInDate),
            turnInTime: data.turnInTime || '',
            driverName: data.driverName,
            driverId: data.driverId,
            routeNumber: data.routeNumber,
            busNumber: data.busNumber,
            itemName: data.itemName,
            itemDescription: data.itemDescription,
            itemCategory: data.itemCategory,
            itemColor: data.itemColor || '',
            itemBrand: data.itemBrand || '',
            foundDate: this.normalizeDate(data.foundDate),
            foundTime: data.foundTime || '',
            foundLocation: data.foundLocation,
            bagNumber: data.bagNumber || '',
            remarks: data.remarks || '',
            imageIds,
            source: types_1.RecordSource.DRIVER
        };
    }
    parseWarehouseRow(data, rowIndex) {
        const requiredFields = ['receiptDate', 'warehouseStaff', 'itemName', 'itemDescription', 'itemCategory', 'storageLocation'];
        const missingFields = requiredFields.filter(field => !data[field]);
        if (missingFields.length > 0) {
            throw new Error(`缺少必填字段: ${missingFields.join(', ')}`);
        }
        const imageIds = data.imageIds ? data.imageIds.split(',').map((id) => id.trim()).filter(Boolean) : [];
        return {
            id: (0, uuid_1.v4)(),
            receiptDate: this.normalizeDate(data.receiptDate),
            receiptTime: data.receiptTime || '',
            warehouseStaff: data.warehouseStaff,
            itemName: data.itemName,
            itemDescription: data.itemDescription,
            itemCategory: data.itemCategory,
            itemColor: data.itemColor || '',
            itemBrand: data.itemBrand || '',
            storageLocation: data.storageLocation,
            shelfNumber: data.shelfNumber || '',
            bagNumber: data.bagNumber || '',
            driverTurnInId: data.driverTurnInId || '',
            imageIds,
            remarks: data.remarks || '',
            source: types_1.RecordSource.WAREHOUSE
        };
    }
    normalizeDate(dateStr) {
        if (!dateStr)
            return '';
        const formats = [
            /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/,
            /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/,
            /^(\d{4})(\d{2})(\d{2})$/
        ];
        for (const format of formats) {
            const match = dateStr.match(format);
            if (match) {
                let year, month, day;
                if (format === formats[0]) {
                    [, year, month, day] = match;
                }
                else if (format === formats[1]) {
                    [, month, day, year] = match;
                }
                else {
                    year = match[1];
                    month = match[2];
                    day = match[3];
                }
                return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
            }
        }
        return dateStr;
    }
}
exports.CsvImporter = CsvImporter;
