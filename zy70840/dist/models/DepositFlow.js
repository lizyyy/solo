"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FlowType = void 0;
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../database"));
var FlowType;
(function (FlowType) {
    FlowType["COLLECT"] = "collect";
    FlowType["DEDUCT"] = "deduct";
    FlowType["REFUND"] = "refund";
})(FlowType || (exports.FlowType = FlowType = {}));
class DepositFlow extends sequelize_1.Model {
}
DepositFlow.init({
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
    flowNo: {
        type: sequelize_1.DataTypes.STRING(50),
        allowNull: false,
        unique: true,
    },
    flowType: {
        type: sequelize_1.DataTypes.ENUM(...Object.values(FlowType)),
        allowNull: false,
    },
    amount: {
        type: sequelize_1.DataTypes.DECIMAL(10, 2),
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
    balanceBefore: {
        type: sequelize_1.DataTypes.DECIMAL(10, 2),
        allowNull: false,
    },
    balanceAfter: {
        type: sequelize_1.DataTypes.DECIMAL(10, 2),
        allowNull: false,
    },
}, {
    sequelize: database_1.default,
    modelName: 'DepositFlow',
    tableName: 'deposit_flows',
    timestamps: true,
    indexes: [
        { fields: ['applicationId'] },
        { fields: ['flowType'] },
        { fields: ['operatedAt'] },
    ],
});
exports.default = DepositFlow;
