"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const DepositFlow_1 = __importStar(require("../models/DepositFlow"));
const Application_1 = __importDefault(require("../models/Application"));
const ApplicationService_1 = __importDefault(require("./ApplicationService"));
const ProcessingLog_1 = require("../models/ProcessingLog");
const dayjs_1 = __importDefault(require("dayjs"));
class DepositService {
    async getCurrentBalance(applicationId) {
        const application = await Application_1.default.findByPk(applicationId);
        if (!application) {
            throw new Error('申请记录不存在');
        }
        return parseFloat(application.depositAmount.toString());
    }
    async addFlow(applicationId, flowType, amount, reason, operator) {
        const balanceBefore = await this.getCurrentBalance(applicationId);
        let balanceAfter = balanceBefore;
        switch (flowType) {
            case DepositFlow_1.FlowType.COLLECT:
                balanceAfter = balanceBefore + amount;
                break;
            case DepositFlow_1.FlowType.DEDUCT:
                if (balanceBefore < amount) {
                    throw new Error(`押金余额不足，当前余额：${balanceBefore}，扣减金额：${amount}`);
                }
                balanceAfter = balanceBefore - amount;
                break;
            case DepositFlow_1.FlowType.REFUND:
                balanceAfter = 0;
                break;
        }
        const flowNo = `DEP${(0, dayjs_1.default)().format('YYYYMMDDHHmmss')}`;
        const readableMessage = this.getReadableFlowMessage(flowType, amount, reason, operator, balanceBefore, balanceAfter);
        const flow = await DepositFlow_1.default.create({
            applicationId,
            flowNo,
            flowType,
            amount,
            reason,
            readableReason: readableMessage,
            operator,
            operatedAt: new Date(),
            balanceBefore,
            balanceAfter,
        });
        await Application_1.default.update({ depositAmount: balanceAfter }, { where: { id: applicationId } });
        await ApplicationService_1.default.addLog(applicationId, ProcessingLog_1.LogType.DEPOSIT_DEDUCTION, reason, readableMessage, operator, undefined, undefined, { balanceBefore, balanceAfter, amount, flowType });
        return {
            flow,
            balanceBefore,
            balanceAfter,
            readableMessage,
        };
    }
    getReadableFlowMessage(flowType, amount, reason, operator, balanceBefore, balanceAfter) {
        const typeMap = {
            [DepositFlow_1.FlowType.COLLECT]: '收取',
            [DepositFlow_1.FlowType.DEDUCT]: '扣减',
            [DepositFlow_1.FlowType.REFUND]: '退还',
        };
        const typeName = typeMap[flowType] || flowType;
        return `操作员【${operator}】${typeName}押金 ${amount} 元，原因：${reason || '未说明'}，操作前余额：${balanceBefore} 元，操作后余额：${balanceAfter} 元`;
    }
    async deductDeposit(applicationId, amount, reason, operator) {
        return this.addFlow(applicationId, DepositFlow_1.FlowType.DEDUCT, amount, reason, operator);
    }
    async collectDeposit(applicationId, amount, reason, operator) {
        return this.addFlow(applicationId, DepositFlow_1.FlowType.COLLECT, amount, reason, operator);
    }
    async refundDeposit(applicationId, reason, operator) {
        const balance = await this.getCurrentBalance(applicationId);
        return this.addFlow(applicationId, DepositFlow_1.FlowType.REFUND, balance, reason, operator);
    }
    async getFlowsByApplication(applicationId) {
        return await DepositFlow_1.default.findAll({
            where: { applicationId },
            order: [['operatedAt', 'DESC']],
        });
    }
    async listFlows(page = 1, pageSize = 20, filters) {
        const where = {};
        if (filters) {
            if (filters.applicationId) {
                where.applicationId = filters.applicationId;
            }
            if (filters.flowType) {
                where.flowType = filters.flowType;
            }
            if (filters.operator) {
                where.operator = { [sequelize_1.Op.like]: `%${filters.operator}%` };
            }
            if (filters.startDate && filters.endDate) {
                where.operatedAt = {
                    [sequelize_1.Op.between]: [filters.startDate, filters.endDate],
                };
            }
        }
        const { count, rows } = await DepositFlow_1.default.findAndCountAll({
            where,
            order: [['operatedAt', 'DESC']],
            limit: pageSize,
            offset: (page - 1) * pageSize,
            include: [{
                    model: Application_1.default,
                    as: 'application',
                    attributes: ['applicationNo', 'merchantName'],
                }],
        });
        return { total: count, list: rows, page, pageSize };
    }
}
exports.default = new DepositService();
