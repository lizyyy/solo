"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database"));
class ExportRequest extends sequelize_1.Model {
}
ExportRequest.init({
    id: {
        type: sequelize_1.DataTypes.UUID,
        primaryKey: true,
    },
    requesterId: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: false,
    },
    requesterName: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: false,
    },
    dataCategory: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: false,
    },
    exportTimeRange: {
        type: sequelize_1.DataTypes.JSON,
        allowNull: false,
    },
    fieldsToExport: {
        type: sequelize_1.DataTypes.JSON,
        allowNull: false,
    },
    purpose: {
        type: sequelize_1.DataTypes.TEXT,
        allowNull: false,
    },
    status: {
        type: sequelize_1.DataTypes.ENUM('pending', 'approved', 'rejected', 'processing', 'completed', 'expired'),
        defaultValue: 'pending',
    },
    fileUrl: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: true,
    },
    fileName: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: true,
    },
    fileExpiryTime: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: true,
    },
    downloadCount: {
        type: sequelize_1.DataTypes.INTEGER,
        defaultValue: 0,
    },
}, {
    sequelize: database_1.default,
    modelName: 'ExportRequest',
    timestamps: true,
});
exports.default = ExportRequest;
