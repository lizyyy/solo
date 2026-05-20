"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LogType = void 0;
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../database"));
var LogType;
(function (LogType) {
    LogType["STATUS_CHANGE"] = "status_change";
    LogType["CERTIFICATE_ISSUE"] = "certificate_issue";
    LogType["SCHEDULE_CONFLICT"] = "schedule_conflict";
    LogType["DEPOSIT_DEDUCTION"] = "deposit_deduction";
    LogType["REMARK"] = "remark";
    LogType["RETURNED"] = "returned";
})(LogType || (exports.LogType = LogType = {}));
class ProcessingLog extends sequelize_1.Model {
}
ProcessingLog.init({
    id: {
        type: sequelize_1.DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    applicationId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'applications',
            key: 'id',
        },
    },
    logType: {
        type: sequelize_1.DataTypes.ENUM(...Object.values(LogType)),
        allowNull: false,
    },
    reason: {
        type: sequelize_1.DataTypes.TEXT,
        allowNull: false,
    },
    readableReason: {
        type: sequelize_1.DataTypes.TEXT,
        allowNull: false,
    },
    operator: {
        type: sequelize_1.DataTypes.STRING(100),
        allowNull: false,
    },
    operatedAt: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: false,
    },
    oldStatus: {
        type: sequelize_1.DataTypes.STRING(50),
        allowNull: true,
    },
    newStatus: {
        type: sequelize_1.DataTypes.STRING(50),
        allowNull: true,
    },
    metadata: {
        type: sequelize_1.DataTypes.TEXT,
        allowNull: true,
        comment: 'JSON格式的附加数据',
    },
}, {
    sequelize: database_1.default,
    modelName: 'ProcessingLog',
    tableName: 'processing_logs',
    timestamps: true,
    indexes: [
        { fields: ['applicationId'] },
        { fields: ['logType'] },
        { fields: ['operatedAt'] },
    ],
});
exports.default = ProcessingLog;
