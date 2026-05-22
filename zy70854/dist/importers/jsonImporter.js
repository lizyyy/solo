"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JsonImporter = void 0;
const uuid_1 = require("uuid");
class JsonImporter {
    importRouteSchedules(jsonContent) {
        try {
            const data = JSON.parse(jsonContent);
            const schedules = [];
            const errors = [];
            if (!Array.isArray(data)) {
                return {
                    success: false,
                    data: [],
                    errors: ['线路班次数据必须是数组格式'],
                    totalCount: 0,
                    validCount: 0,
                    invalidCount: 0
                };
            }
            data.forEach((item, index) => {
                try {
                    const schedule = this.parseRouteSchedule(item, index);
                    if (schedule) {
                        schedules.push(schedule);
                    }
                }
                catch (error) {
                    errors.push(`第 ${index + 1} 条: ${error.message}`);
                }
            });
            return {
                success: errors.length === 0,
                data: schedules,
                errors,
                totalCount: data.length,
                validCount: schedules.length,
                invalidCount: errors.length
            };
        }
        catch (error) {
            return {
                success: false,
                data: [],
                errors: [`JSON解析失败: ${error.message}`],
                totalCount: 0,
                validCount: 0,
                invalidCount: 0
            };
        }
    }
    importImageIndex(jsonContent) {
        try {
            const data = JSON.parse(jsonContent);
            const images = [];
            const errors = [];
            if (!Array.isArray(data)) {
                return {
                    success: false,
                    data: [],
                    errors: ['图片索引数据必须是数组格式'],
                    totalCount: 0,
                    validCount: 0,
                    invalidCount: 0
                };
            }
            data.forEach((item, index) => {
                try {
                    const image = this.parseImageIndex(item, index);
                    if (image) {
                        images.push(image);
                    }
                }
                catch (error) {
                    errors.push(`第 ${index + 1} 条: ${error.message}`);
                }
            });
            return {
                success: errors.length === 0,
                data: images,
                errors,
                totalCount: data.length,
                validCount: images.length,
                invalidCount: errors.length
            };
        }
        catch (error) {
            return {
                success: false,
                data: [],
                errors: [`JSON解析失败: ${error.message}`],
                totalCount: 0,
                validCount: 0,
                invalidCount: 0
            };
        }
    }
    parseRouteSchedule(item, index) {
        const requiredFields = ['routeNumber', 'busNumber', 'driverName', 'driverId', 'date', 'startTime', 'endTime'];
        const missingFields = requiredFields.filter(field => !item[field]);
        if (missingFields.length > 0) {
            throw new Error(`缺少必填字段: ${missingFields.join(', ')}`);
        }
        return {
            routeNumber: item.routeNumber,
            busNumber: item.busNumber,
            driverName: item.driverName,
            driverId: item.driverId,
            date: this.normalizeDate(item.date),
            startTime: item.startTime,
            endTime: item.endTime,
            stops: item.stops || []
        };
    }
    parseImageIndex(item, index) {
        const requiredFields = ['itemId', 'fileName', 'filePath', 'uploadDate', 'uploader'];
        const missingFields = requiredFields.filter(field => !item[field]);
        if (missingFields.length > 0) {
            throw new Error(`缺少必填字段: ${missingFields.join(', ')}`);
        }
        return {
            id: item.id || (0, uuid_1.v4)(),
            itemId: item.itemId,
            fileName: item.fileName,
            filePath: item.filePath,
            uploadDate: this.normalizeDate(item.uploadDate),
            uploader: item.uploader,
            thumbnailPath: item.thumbnailPath || ''
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
exports.JsonImporter = JsonImporter;
