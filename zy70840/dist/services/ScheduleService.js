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
const sequelize_1 = require("sequelize");
const VenueSchedule_1 = __importStar(require("../models/VenueSchedule"));
const Application_1 = __importDefault(require("../models/Application"));
const dayjs_1 = __importDefault(require("dayjs"));
class ScheduleService {
    isDateOverlap(start1, end1, start2, end2) {
        const s1 = (0, dayjs_1.default)(start1);
        const e1 = (0, dayjs_1.default)(end1);
        const s2 = (0, dayjs_1.default)(start2);
        const e2 = (0, dayjs_1.default)(end2);
        return s1.isBefore(e2) && s2.isBefore(e1);
    }
    async checkConflict(venueName, location, startDate, endDate, excludeApplicationId) {
        const schedules = await VenueSchedule_1.default.findAll({
            where: {
                venueName,
                location,
                status: { [sequelize_1.Op.ne]: VenueSchedule_1.ScheduleStatus.AVAILABLE },
                applicationId: {
                    [sequelize_1.Op.or]: [
                        { [sequelize_1.Op.ne]: excludeApplicationId },
                        { [sequelize_1.Op.is]: null }
                    ]
                }
            },
            include: [{
                    model: Application_1.default,
                    as: 'application',
                    attributes: ['applicationNo', 'merchantName'],
                }],
        });
        const conflicts = [];
        for (const schedule of schedules) {
            if (this.isDateOverlap(startDate, endDate, schedule.startDate, schedule.endDate)) {
                let conflictType = '';
                let readableConflict = '';
                const scheduleWithApp = schedule;
                if (schedule.status === VenueSchedule_1.ScheduleStatus.BLOCKED) {
                    conflictType = 'blocked';
                    readableConflict = `该档期已被封禁，原因：${schedule.blockedReason || '未说明'}，封禁人：${schedule.blockedBy}`;
                }
                else {
                    conflictType = 'occupied';
                    readableConflict = `档期冲突，冲突申请：【${scheduleWithApp.application?.applicationNo || '未知'}】- ${scheduleWithApp.application?.merchantName || '未知商户'}，占用时间：${(0, dayjs_1.default)(schedule.startDate).format('YYYY-MM-DD')} 至 ${(0, dayjs_1.default)(schedule.endDate).format('YYYY-MM-DD')}`;
                }
                conflicts.push({
                    scheduleId: schedule.id,
                    applicationId: schedule.applicationId,
                    applicationNo: scheduleWithApp.application?.applicationNo || null,
                    merchantName: scheduleWithApp.application?.merchantName || null,
                    startDate: schedule.startDate,
                    endDate: schedule.endDate,
                    conflictType,
                    readableConflict,
                });
            }
        }
        return {
            hasConflict: conflicts.length > 0,
            conflicts,
        };
    }
    async occupySchedule(applicationId, venueName, location, startDate, endDate) {
        const conflictCheck = await this.checkConflict(venueName, location, startDate, endDate, applicationId);
        if (conflictCheck.hasConflict) {
            throw new Error(`档期冲突：${conflictCheck.conflicts.map(c => c.readableConflict).join('; ')}`);
        }
        const schedule = await VenueSchedule_1.default.create({
            applicationId,
            venueName,
            location,
            startDate,
            endDate,
            status: VenueSchedule_1.ScheduleStatus.OCCUPIED,
        });
        return schedule;
    }
    async releaseSchedule(applicationId) {
        await VenueSchedule_1.default.update({ status: VenueSchedule_1.ScheduleStatus.AVAILABLE, applicationId: null }, { where: { applicationId } });
    }
    async getSchedulesByVenueAndDate(venueName, location, startDate, endDate) {
        return await VenueSchedule_1.default.findAll({
            where: {
                venueName,
                location,
                startDate: { [sequelize_1.Op.lte]: endDate },
                endDate: { [sequelize_1.Op.gte]: startDate },
            },
            include: [{
                    model: Application_1.default,
                    as: 'application',
                    attributes: ['applicationNo', 'merchantName', 'status'],
                }],
            order: [['startDate', 'ASC']],
        });
    }
    async blockSchedule(venueName, location, startDate, endDate, blockedBy, blockedReason) {
        return await VenueSchedule_1.default.create({
            venueName,
            location,
            startDate,
            endDate,
            status: VenueSchedule_1.ScheduleStatus.BLOCKED,
            blockedBy,
            blockedReason,
        });
    }
}
exports.default = new ScheduleService();
