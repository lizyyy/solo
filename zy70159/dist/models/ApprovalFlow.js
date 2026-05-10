"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database"));
class ApprovalFlow extends sequelize_1.Model {
}
ApprovalFlow.init({
    id: {
        type: sequelize_1.DataTypes.UUID,
        primaryKey: true,
    },
    requestId: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: false,
    },
    approverId: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: false,
    },
    approverName: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: false,
    },
    level: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
    },
    status: {
        type: sequelize_1.DataTypes.ENUM('pending', 'approved', 'rejected'),
        defaultValue: 'pending',
    },
    comment: {
        type: sequelize_1.DataTypes.TEXT,
        allowNull: true,
    },
    decisionTime: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: true,
    },
}, {
    sequelize: database_1.default,
    modelName: 'ApprovalFlow',
    timestamps: true,
});
exports.default = ApprovalFlow;
