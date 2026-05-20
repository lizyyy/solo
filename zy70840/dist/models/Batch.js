"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BatchStatus = void 0;
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../database"));
var BatchStatus;
(function (BatchStatus) {
    BatchStatus["PENDING"] = "pending";
    BatchStatus["PROCESSING"] = "processing";
    BatchStatus["COMPLETED"] = "completed";
    BatchStatus["PARTIAL"] = "partial";
})(BatchStatus || (exports.BatchStatus = BatchStatus = {}));
class Batch extends sequelize_1.Model {
}
Batch.init({
    id: {
        type: sequelize_1.DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    batchNo: {
        type: sequelize_1.DataTypes.STRING(50),
        allowNull: false,
        unique: true,
    },
    name: {
        type: sequelize_1.DataTypes.STRING(200),
        allowNull: false,
    },
    status: {
        type: sequelize_1.DataTypes.ENUM(...Object.values(BatchStatus)),
        allowNull: false,
        defaultValue: BatchStatus.PENDING,
    },
    totalCount: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
    },
    successCount: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
    },
    failCount: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
    },
    importedBy: {
        type: sequelize_1.DataTypes.STRING(100),
        allowNull: false,
    },
    importedAt: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: false,
    },
    remark: {
        type: sequelize_1.DataTypes.TEXT,
        allowNull: true,
    },
}, {
    sequelize: database_1.default,
    modelName: 'Batch',
    tableName: 'batches',
    timestamps: true,
});
exports.default = Batch;
