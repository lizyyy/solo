"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigItemService = void 0;
const prisma_1 = __importDefault(require("../prisma"));
const errorHandler_1 = require("../middleware/errorHandler");
const types_1 = require("../types");
class ConfigItemService {
    async create(dto) {
        const existing = await prisma_1.default.configItem.findFirst({
            where: { key: dto.key },
            orderBy: { version: 'desc' },
        });
        const newVersion = existing ? existing.version + 1 : 1;
        return prisma_1.default.configItem.create({
            data: {
                ...dto,
                version: newVersion,
                status: types_1.ConfigStatus.DRAFT,
            },
        });
    }
    async findAll(params) {
        const { page = 1, pageSize = 20, status, key } = params;
        const skip = (page - 1) * pageSize;
        const where = {};
        if (status)
            where.status = status;
        if (key)
            where.key = { contains: key };
        const [items, total] = await Promise.all([
            prisma_1.default.configItem.findMany({
                where,
                skip,
                take: pageSize,
                orderBy: [{ key: 'asc' }, { version: 'desc' }],
                include: {
                    _count: {
                        select: { pullRecords: true, versions: true },
                    },
                },
            }),
            prisma_1.default.configItem.count({ where }),
        ]);
        return {
            items,
            pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
        };
    }
    async findById(id) {
        const config = await prisma_1.default.configItem.findUnique({
            where: { id },
            include: {
                versions: { orderBy: { releasedAt: 'desc' } },
                pullRecords: { take: 50, orderBy: { pulledAt: 'desc' } },
                diffReports: { orderBy: { generatedAt: 'desc' } },
            },
        });
        if (!config) {
            throw new errorHandler_1.AppError('配置项不存在', 404);
        }
        return config;
    }
    async update(id, dto) {
        const config = await this.findById(id);
        if (dto.value && dto.value !== config.value) {
            return prisma_1.default.configItem.create({
                data: {
                    key: config.key,
                    value: dto.value,
                    description: dto.description || config.description,
                    version: config.version + 1,
                    status: types_1.ConfigStatus.DRAFT,
                    createdBy: config.createdBy,
                },
            });
        }
        return prisma_1.default.configItem.update({
            where: { id },
            data: {
                description: dto.description,
                status: dto.status,
            },
        });
    }
    async delete(id) {
        await this.findById(id);
        return prisma_1.default.configItem.delete({ where: { id } });
    }
    async getVersions(configId) {
        return prisma_1.default.distributionVersion.findMany({
            where: { configId },
            orderBy: { version: 'desc' },
        });
    }
}
exports.ConfigItemService = ConfigItemService;
exports.default = new ConfigItemService();
