"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HealthService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const certificate_entity_1 = require("../../certificate/entities/certificate.entity");
const review_task_entity_1 = require("../../review/entities/review-task.entity");
const types_1 = require("../../../common/types");
let HealthService = class HealthService {
    constructor(certificateRepository, reviewRepository) {
        this.certificateRepository = certificateRepository;
        this.reviewRepository = reviewRepository;
    }
    async health() {
        return {
            status: 'ok',
            timestamp: new Date().toISOString(),
            version: '1.0.0',
        };
    }
    async getSystemStatus() {
        const [totalCerts, pendingReviews, hasDuplicates, manuallyCorrected] = await Promise.all([
            this.certificateRepository.count(),
            this.reviewRepository.count({ where: { status: types_1.ReviewStatus.PENDING } }),
            this.certificateRepository.count({ where: { hasDuplicate: true } }),
            this.certificateRepository.count({ where: { hasManualCorrection: true } }),
        ]);
        return {
            status: 'operational',
            timestamp: new Date().toISOString(),
            statistics: {
                totalCertificates: totalCerts,
                pendingReviews: pendingReviews,
                certificatesWithDuplicates: hasDuplicates,
                manuallyCorrected: manuallyCorrected,
            },
            attentionRequired: pendingReviews > 0,
            attentionMessage: pendingReviews > 0
                ? `有 ${pendingReviews} 条待复核任务需要处理`
                : '系统运行正常，无需关注',
        };
    }
};
exports.HealthService = HealthService;
exports.HealthService = HealthService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(certificate_entity_1.Certificate)),
    __param(1, (0, typeorm_1.InjectRepository)(review_task_entity_1.ReviewTask)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository])
], HealthService);
//# sourceMappingURL=health.service.js.map