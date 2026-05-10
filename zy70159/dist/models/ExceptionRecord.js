"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database"));
class ExceptionRecord extends sequelize_1.Model {
}
ExceptionRecord.init({
    id: {
        type: sequelize_1.DataTypes.UUID,
        primaryKey: true,
    },
    type: {
        type: sequelize_1.DataTypes.ENUM('file_expiry', 'download_failure', 'task_failure', 'repeated_operation', 'sensitive_field_violation', 'other'),
        allowNull: false,
    },
    requestId: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: true,
    },
    description: {
        type: sequelize_1.DataTypes.TEXT,
        allowNull: false,
    },
    details: {
        type: sequelize_1.DataTypes.JSON,
        allowNull: true,
    },
    status: {
        type: sequelize_1.DataTypes.ENUM('pending', 'processed', 'ignored'),
        defaultValue: 'pending',
    },
    processedBy: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: true,
    },
    processedAt: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: true,
    },
}, {
    sequelize: database_1.default,
    modelName: 'ExceptionRecord',
    timestamps: true,
});
exports.default = ExceptionRecord;
