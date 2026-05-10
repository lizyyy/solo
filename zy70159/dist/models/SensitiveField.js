"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database"));
class SensitiveField extends sequelize_1.Model {
}
SensitiveField.init({
    id: {
        type: sequelize_1.DataTypes.UUID,
        primaryKey: true,
    },
    fieldName: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: false,
    },
    dataType: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: false,
    },
    sensitivityLevel: {
        type: sequelize_1.DataTypes.ENUM('low', 'medium', 'high'),
        allowNull: false,
    },
    maskingRule: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: false,
    },
    description: {
        type: sequelize_1.DataTypes.TEXT,
        allowNull: true,
    },
}, {
    sequelize: database_1.default,
    modelName: 'SensitiveField',
    timestamps: true,
});
exports.default = SensitiveField;
