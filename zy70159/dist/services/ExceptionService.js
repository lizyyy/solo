"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const uuid_1 = require("uuid");
const ExceptionRecord_1 = __importDefault(require("../models/ExceptionRecord"));
class ExceptionService {
    async recordException(type, description, requestId, details) {
        const exception = await ExceptionRecord_1.default.create({
            id: (0, uuid_1.v4)(),
            type,
            description,
            requestId,
            details,
        });
        return exception;
    }
    async getPendingExceptions() {
        return ExceptionRecord_1.default.findAll({
            where: { status: 'pending' },
            order: [['createdAt', 'DESC']],
        });
    }
    async getAllExceptions() {
        return ExceptionRecord_1.default.findAll({
            order: [['createdAt', 'DESC']],
        });
    }
    async processException(exceptionId, processorId, action) {
        const exception = await ExceptionRecord_1.default.findByPk(exceptionId);
        if (!exception) {
            return null;
        }
        exception.status = action;
        exception.processedBy = processorId;
        exception.processedAt = new Date();
        await exception.save();
        return exception;
    }
}
exports.default = new ExceptionService();
