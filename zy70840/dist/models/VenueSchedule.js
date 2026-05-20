"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScheduleStatus = void 0;
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../database"));
var ScheduleStatus;
(function (ScheduleStatus) {
    ScheduleStatus["AVAILABLE"] = "available";
    ScheduleStatus["OCCUPIED"] = "occupied";
    ScheduleStatus["BLOCKED"] = "blocked";
})(ScheduleStatus || (exports.ScheduleStatus = ScheduleStatus = {}));
class VenueSchedule extends sequelize_1.Model {
}
VenueSchedule.init({
    id: {
        type: sequelize_1.DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    applicationId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'applications',
            key: 'id',
        },
    },
    venueName: {
        type: sequelize_1.DataTypes.STRING(200),
        allowNull: false,
    },
    location: {
        type: sequelize_1.DataTypes.STRING(200),
        allowNull: false,
    },
    startDate: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: false,
    },
    endDate: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: false,
    },
    status: {
        type: sequelize_1.DataTypes.ENUM(...Object.values(ScheduleStatus)),
        allowNull: false,
        defaultValue: ScheduleStatus.AVAILABLE,
    },
    blockedBy: {
        type: sequelize_1.DataTypes.STRING(100),
        allowNull: true,
    },
    blockedReason: {
        type: sequelize_1.DataTypes.TEXT,
        allowNull: true,
    },
}, {
    sequelize: database_1.default,
    modelName: 'VenueSchedule',
    tableName: 'venue_schedules',
    timestamps: true,
    indexes: [
        { fields: ['venueName', 'location'] },
        { fields: ['startDate', 'endDate'] },
        { fields: ['status'] },
    ],
});
exports.default = VenueSchedule;
