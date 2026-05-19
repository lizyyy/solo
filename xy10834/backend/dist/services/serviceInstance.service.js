"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServiceInstanceService = void 0;
const prisma_1 = __importDefault(require("../prisma"));
const errorHandler_1 = require("../middleware/errorHandler");
const types_1 = require("../types");
class ServiceInstanceService {
    async create(dto) {
        const existing = await prisma_1.default.serviceInstance.findUnique({
            where: {
                instanceId_env: {
                    instanceId: dto.instanceId,
                    env: dto.env,
                },
            },
        });
        if (existing) {
            throw new errorHandler_1.AppError('该环境下已存在相同实例ID', 400);
        }
        return prisma_1.default.serviceInstance.create({
            data: dto,
        });
    }
    async findAll(params) {
        const { page = 1, pageSize = 20, serviceName, env, status } = params;
        const skip = (page - 1) * pageSize;
        const where = {};
        if (serviceName)
            where.serviceName = { contains: serviceName };
        if (env)
            where.env = env;
        if (status)
            where.status = status;
        const [instances, total] = await Promise.all([
            prisma_1.default.serviceInstance.findMany({
                where,
                skip,
                take: pageSize,
                orderBy: { serviceName: 'asc' },
                include: {
                    _count: {
                        select: { pullRecords: true, effectiveStates: true },
                    },
                },
            }),
            prisma_1.default.serviceInstance.count({ where }),
        ]);
        return {
            instances,
            pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
        };
    }
    async findById(id) {
        const instance = await prisma_1.default.serviceInstance.findUnique({
            where: { id },
            include: {
                pullRecords: { take: 50, orderBy: { pulledAt: 'desc' } },
                effectiveStates: true,
            },
        });
        if (!instance) {
            throw new errorHandler_1.AppError('服务实例不存在', 404);
        }
        return instance;
    }
    async heartbeat(instanceId, env) {
        const instance = await prisma_1.default.serviceInstance.findUnique({
            where: {
                instanceId_env: { instanceId, env },
            },
        });
        if (!instance) {
            throw new errorHandler_1.AppError('服务实例不存在', 404);
        }
        return prisma_1.default.serviceInstance.update({
            where: { id: instance.id },
            data: {
                lastHeartbeat: new Date(),
                status: types_1.InstanceStatus.ONLINE,
            },
        });
    }
    async updateStatus(id, status) {
        await this.findById(id);
        return prisma_1.default.serviceInstance.update({
            where: { id },
            data: { status },
        });
    }
    async delete(id) {
        await this.findById(id);
        return prisma_1.default.serviceInstance.delete({ where: { id } });
    }
}
exports.ServiceInstanceService = ServiceInstanceService;
exports.default = new ServiceInstanceService();
