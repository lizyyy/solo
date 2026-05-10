"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.tenantService = void 0;
const prisma_1 = __importDefault(require("../lib/prisma"));
exports.tenantService = {
    async create(name, description) {
        return prisma_1.default.tenant.create({
            data: { name, description },
        });
    },
    async list() {
        return prisma_1.default.tenant.findMany({
            orderBy: { createdAt: 'desc' },
        });
    },
    async getById(id) {
        return prisma_1.default.tenant.findUnique({
            where: { id },
        });
    },
    async update(id, data) {
        return prisma_1.default.tenant.update({
            where: { id },
            data,
        });
    },
    async delete(id) {
        return prisma_1.default.tenant.delete({
            where: { id },
        });
    },
};
//# sourceMappingURL=tenantService.js.map