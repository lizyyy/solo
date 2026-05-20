"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CertificateStatus = void 0;
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../database"));
var CertificateStatus;
(function (CertificateStatus) {
    CertificateStatus["VALID"] = "valid";
    CertificateStatus["EXPIRED"] = "expired";
    CertificateStatus["EXPIRING_SOON"] = "expiring_soon";
})(CertificateStatus || (exports.CertificateStatus = CertificateStatus = {}));
class Certificate extends sequelize_1.Model {
}
Certificate.init({
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
    certificateNo: {
        type: sequelize_1.DataTypes.STRING(100),
        allowNull: false,
    },
    type: {
        type: sequelize_1.DataTypes.STRING(100),
        allowNull: false,
    },
    version: {
        type: sequelize_1.DataTypes.STRING(50),
        allowNull: false,
    },
    issueDate: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: false,
    },
    expiryDate: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: false,
    },
    status: {
        type: sequelize_1.DataTypes.ENUM(...Object.values(CertificateStatus)),
        allowNull: false,
        defaultValue: CertificateStatus.VALID,
    },
    attachmentUrl: {
        type: sequelize_1.DataTypes.STRING(500),
        allowNull: true,
    },
    checkedAt: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: true,
    },
    checkedBy: {
        type: sequelize_1.DataTypes.STRING(100),
        allowNull: true,
    },
}, {
    sequelize: database_1.default,
    modelName: 'Certificate',
    tableName: 'certificates',
    timestamps: true,
    indexes: [
        { fields: ['applicationId'] },
        { fields: ['status'] },
        { fields: ['expiryDate'] },
    ],
});
exports.default = Certificate;
