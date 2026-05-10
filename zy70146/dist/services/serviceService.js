"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.endpointService = exports.serviceService = void 0;
const prisma_1 = __importDefault(require("../lib/prisma"));
exports.serviceService = {
    async create(tenantId, name, description) {
        return prisma_1.default.service.create({
            data: { tenantId, name, description },
        });
    },
    async list(tenantId) {
        return prisma_1.default.service.findMany({
            where: { tenantId },
            orderBy: { createdAt: 'desc' },
            include: {
                _count: {
                    select: { endpoints: true, sloConfigs: true },
                },
            },
        });
    },
    async getById(id) {
        return prisma_1.default.service.findUnique({
            where: { id },
            include: {
                endpoints: true,
                sloConfigs: true,
            },
        });
    },
    async update(id, data) {
        return prisma_1.default.service.update({
            where: { id },
            data,
        });
    },
    async delete(id) {
        return prisma_1.default.service.delete({
            where: { id },
        });
    },
};
exports.endpointService = {
    async create(serviceId, method, path, description) {
        return prisma_1.default.aPIEndpoint.create({
            data: { serviceId, method: method.toUpperCase(), path, description },
        });
    },
    async list(serviceId) {
        return prisma_1.default.aPIEndpoint.findMany({
            where: { serviceId },
            orderBy: [{ method: 'asc' }, { path: 'asc' }],
        });
    },
    async getById(id) {
        return prisma_1.default.aPIEndpoint.findUnique({
            where: { id },
        });
    },
    async update(id, data) {
        if (data.method) {
            data.method = data.method.toUpperCase();
        }
        return prisma_1.default.aPIEndpoint.update({
            where: { id },
            data,
        });
    },
    async delete(id) {
        return prisma_1.default.aPIEndpoint.delete({
            where: { id },
        });
    },
};
//# sourceMappingURL=serviceService.js.map