"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApplicationStatus = void 0;
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../database"));
var ApplicationStatus;
(function (ApplicationStatus) {
    ApplicationStatus["PENDING"] = "pending";
    ApplicationStatus["APPROVED"] = "approved";
    ApplicationStatus["REJECTED"] = "rejected";
    ApplicationStatus["RETURNED"] = "returned";
    ApplicationStatus["PROCESSING"] = "processing";
})(ApplicationStatus || (exports.ApplicationStatus = ApplicationStatus = {}));
class Application extends sequelize_1.Model {
}
Application.init({
    id: {
        type: sequelize_1.DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    batchId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'batches',
            key: 'id',
        },
    },
    applicationNo: {
        type: sequelize_1.DataTypes.STRING(50),
        allowNull: false,
        unique: true,
    },
    merchantName: {
        type: sequelize_1.DataTypes.STRING(200),
        allowNull: false,
    },
    contactPerson: {
        type: sequelize_1.DataTypes.STRING(100),
        allowNull: false,
    },
    contactPhone: {
        type: sequelize_1.DataTypes.STRING(50),
        allowNull: false,
    },
    stallType: {
        type: sequelize_1.DataTypes.STRING(100),
        allowNull: false,
    },
    stallLocation: {
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
    depositAmount: {
        type: sequelize_1.DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
    },
    status: {
        type: sequelize_1.DataTypes.ENUM(...Object.values(ApplicationStatus)),
        allowNull: false,
        defaultValue: ApplicationStatus.PENDING,
    },
    certificateVersion: {
        type: sequelize_1.DataTypes.STRING(50),
        allowNull: true,
    },
    importedAt: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: false,
    },
    processedAt: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: true,
    },
    processedBy: {
        type: sequelize_1.DataTypes.STRING(100),
        allowNull: true,
    },
}, {
    sequelize: database_1.default,
    modelName: 'Application',
    tableName: 'applications',
    timestamps: true,
    indexes: [
        { fields: ['batchId'] },
        { fields: ['status'] },
        { fields: ['stallLocation'] },
        { fields: ['startDate', 'endDate'] },
    ],
});
exports.default = Application;
