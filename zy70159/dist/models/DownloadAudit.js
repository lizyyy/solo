"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database"));
class DownloadAudit extends sequelize_1.Model {
}
DownloadAudit.init({
    id: {
        type: sequelize_1.DataTypes.UUID,
        primaryKey: true,
    },
    requestId: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: false,
    },
    requesterId: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: false,
    },
    requesterName: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: false,
    },
    downloadTime: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: false,
    },
    success: {
        type: sequelize_1.DataTypes.BOOLEAN,
        allowNull: false,
    },
    failureReason: {
        type: sequelize_1.DataTypes.TEXT,
        allowNull: true,
    },
    ipAddress: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: true,
    },
    userAgent: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: true,
    },
}, {
    sequelize: database_1.default,
    modelName: 'DownloadAudit',
    timestamps: false,
});
exports.default = DownloadAudit;
