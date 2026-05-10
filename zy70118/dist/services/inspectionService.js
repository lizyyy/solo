"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InspectionService = void 0;
const domain_1 = require("../domain");
const errors_1 = require("../domain/errors");
class InspectionService {
    constructor(repository, ruleEngine) {
        this.repository = repository;
        this.ruleEngine = ruleEngine;
    }
    async createBatch(request) {
        this.validateCreateBatchRequest(request);
        return this.repository.create({
            supplierId: request.supplierId,
            materialCode: request.materialCode,
            materialName: request.materialName,
            quantity: request.quantity,
            unit: request.unit,
            expectedDeliveryDate: request.expectedDeliveryDate,
            actualDeliveryDate: request.actualDeliveryDate,
            vehiclePlate: request.vehiclePlate,
            driverId: request.driverId,
            operatorId: request.operatorId,
            status: domain_1.BatchStatus.PENDING,
            temperatureChecks: [],
            weightChecks: [],
            ticketChecks: [],
            rejectionReasons: []
        });
    }
    async performTemperatureCheck(request) {
        const batch = await this.getBatchOrThrow(request.batchId);
        (0, domain_1.checkDuplicateSubmission)(batch, domain_1.InspectionType.TEMPERATURE);
        (0, domain_1.validateTransition)(batch.status, domain_1.BatchStatus.TEMPERATURE_CHECKED);
        const items = request.items.map(item => ({
            location: item.location,
            value: item.value,
            unit: item.unit,
            measuredAt: new Date(item.measuredAt),
            operatorId: item.operatorId
        }));
        const rule = this.ruleEngine.getTemperatureRule(batch.materialCode);
        const validation = (0, domain_1.validateTemperatureCheck)(items, rule);
        if (!validation.valid) {
            return {
                success: false,
                batch,
                errors: validation.errors.map(e => e.message),
                warnings: validation.warnings
            };
        }
        const updatedBatch = {
            ...batch,
            status: domain_1.BatchStatus.TEMPERATURE_CHECKED,
            temperatureChecks: [...batch.temperatureChecks, ...items],
            inspectionNote: request.note || batch.inspectionNote
        };
        const saved = await this.repository.update(updatedBatch, batch.version);
        return {
            success: true,
            batch: saved,
            warnings: validation.warnings
        };
    }
    async performWeightCheck(request) {
        const batch = await this.getBatchOrThrow(request.batchId);
        (0, domain_1.checkDuplicateSubmission)(batch, domain_1.InspectionType.WEIGHT);
        (0, domain_1.validateTransition)(batch.status, domain_1.BatchStatus.WEIGHT_CHECKED);
        const items = request.items.map(item => ({
            expected: item.expected,
            actual: item.actual,
            unit: item.unit
        }));
        const rule = this.ruleEngine.getWeightRule(batch.materialCode);
        const validation = (0, domain_1.validateWeightCheck)(items, rule);
        if (!validation.valid) {
            return {
                success: false,
                batch,
                errors: validation.errors.map(e => e.message),
                warnings: validation.warnings
            };
        }
        const updatedBatch = {
            ...batch,
            status: domain_1.BatchStatus.WEIGHT_CHECKED,
            weightChecks: [...batch.weightChecks, ...items],
            inspectionNote: request.note || batch.inspectionNote
        };
        const saved = await this.repository.update(updatedBatch, batch.version);
        return {
            success: true,
            batch: saved,
            warnings: validation.warnings
        };
    }
    async performTicketCheck(request) {
        const batch = await this.getBatchOrThrow(request.batchId);
        (0, domain_1.checkDuplicateSubmission)(batch, domain_1.InspectionType.TICKET);
        (0, domain_1.validateTransition)(batch.status, domain_1.BatchStatus.TICKET_CHECKED);
        const items = request.items.map(item => ({
            type: item.type,
            provided: item.provided,
            valid: item.valid,
            ticketNumber: item.ticketNumber,
            issueDate: item.issueDate ? new Date(item.issueDate) : undefined,
            expiryDate: item.expiryDate ? new Date(item.expiryDate) : undefined
        }));
        const rule = this.ruleEngine.getTicketRule(batch.materialCode);
        const validation = (0, domain_1.validateTicketCheck)(items, rule);
        if (!validation.valid) {
            return {
                success: false,
                batch,
                errors: validation.errors.map(e => e.message),
                warnings: validation.warnings
            };
        }
        const updatedBatch = {
            ...batch,
            status: domain_1.BatchStatus.TICKET_CHECKED,
            ticketChecks: [...batch.ticketChecks, ...items],
            inspectionNote: request.note || batch.inspectionNote
        };
        const saved = await this.repository.update(updatedBatch, batch.version);
        return {
            success: true,
            batch: saved,
            warnings: validation.warnings
        };
    }
    async rejectBatch(request) {
        const batch = await this.getBatchOrThrow(request.batchId);
        (0, domain_1.validateTransition)(batch.status, domain_1.BatchStatus.REJECTED);
        const reasons = request.reasons.map(r => ({
            type: r.type,
            code: r.code,
            description: r.description,
            detail: r.detail
        }));
        const validation = (0, domain_1.validateRejectionReasons)(reasons);
        if (!validation.valid) {
            return {
                success: false,
                batch,
                errors: validation.errors.map(e => e.message),
                warnings: validation.warnings
            };
        }
        const updatedBatch = {
            ...batch,
            status: domain_1.BatchStatus.REJECTED,
            rejectionReasons: [...batch.rejectionReasons, ...reasons]
        };
        const saved = await this.repository.update(updatedBatch, batch.version);
        return {
            success: true,
            batch: saved
        };
    }
    async replenishBatch(request) {
        const batch = await this.getBatchOrThrow(request.batchId);
        (0, domain_1.validateTransition)(batch.status, domain_1.BatchStatus.REPLENISHED);
        if (!request.operatorId || request.operatorId.trim() === '') {
            throw new errors_1.ValidationError('操作员ID不能为空', 'operatorId');
        }
        const updatedBatch = {
            ...batch,
            status: domain_1.BatchStatus.REPLENISHED,
            replenishmentInfo: {
                replenishedAt: new Date(),
                operatorId: request.operatorId,
                note: request.note,
                newBatchId: request.newBatchId
            }
        };
        const saved = await this.repository.update(updatedBatch, batch.version);
        return {
            success: true,
            batch: saved
        };
    }
    async acceptBatch(request) {
        const batch = await this.getBatchOrThrow(request.batchId);
        const targetStatus = request.partialAccept
            ? domain_1.BatchStatus.PARTIALLY_ACCEPTED
            : domain_1.BatchStatus.ACCEPTED;
        (0, domain_1.validateTransition)(batch.status, targetStatus);
        if (request.partialAccept) {
            if (request.acceptedQuantity === undefined || request.acceptedQuantity === null) {
                throw new errors_1.ValidationError('部分验收必须指定验收数量', 'acceptedQuantity');
            }
            if (request.acceptedQuantity <= 0) {
                throw new errors_1.ValidationError('验收数量必须大于 0', 'acceptedQuantity');
            }
            if (request.acceptedQuantity > batch.quantity) {
                throw new errors_1.ValidationError('验收数量不能超过批次总数量', 'acceptedQuantity');
            }
        }
        const updatedBatch = {
            ...batch,
            status: targetStatus,
            inspectionNote: request.note || batch.inspectionNote
        };
        const saved = await this.repository.update(updatedBatch, batch.version);
        return {
            success: true,
            batch: saved
        };
    }
    async getBatch(batchId) {
        return this.repository.findById(batchId);
    }
    async listBatches(filters) {
        return this.repository.findAll(filters);
    }
    async generateReport(batchId) {
        const batch = await this.getBatchOrThrow(batchId);
        const temperatureSummary = this.calculateTemperatureSummary(batch);
        const weightSummary = this.calculateWeightSummary(batch);
        const ticketSummary = this.calculateTicketSummary(batch);
        return {
            batchId: batch.id,
            materialCode: batch.materialCode,
            materialName: batch.materialName,
            supplierId: batch.supplierId,
            status: batch.status,
            temperatureSummary,
            weightSummary,
            ticketSummary,
            rejectionReasons: batch.rejectionReasons,
            createdAt: batch.createdAt
        };
    }
    async getBatchOrThrow(batchId) {
        const batch = await this.repository.findById(batchId);
        if (!batch) {
            throw new errors_1.BatchNotFoundError(batchId);
        }
        return batch;
    }
    validateCreateBatchRequest(request) {
        if (!request.supplierId || request.supplierId.trim() === '') {
            throw new errors_1.ValidationError('供应商ID不能为空', 'supplierId');
        }
        if (!request.materialCode || request.materialCode.trim() === '') {
            throw new errors_1.ValidationError('物料编码不能为空', 'materialCode');
        }
        if (!request.materialName || request.materialName.trim() === '') {
            throw new errors_1.ValidationError('物料名称不能为空', 'materialName');
        }
        if (!request.quantity || request.quantity <= 0) {
            throw new errors_1.ValidationError('数量必须大于 0', 'quantity');
        }
        if (!request.unit || request.unit.trim() === '') {
            throw new errors_1.ValidationError('单位不能为空', 'unit');
        }
        if (!request.operatorId || request.operatorId.trim() === '') {
            throw new errors_1.ValidationError('操作员ID不能为空', 'operatorId');
        }
    }
    calculateTemperatureSummary(batch) {
        const checks = batch.temperatureChecks;
        if (checks.length === 0) {
            return { checked: false, passed: false, count: 0 };
        }
        const temps = checks.map(c => c.value);
        const rule = this.ruleEngine.getTemperatureRule(batch.materialCode);
        const validation = (0, domain_1.validateTemperatureCheck)(checks, rule);
        return {
            checked: true,
            passed: validation.valid,
            count: checks.length,
            minTemp: Math.min(...temps),
            maxTemp: Math.max(...temps),
            avgTemp: temps.reduce((a, b) => a + b, 0) / temps.length
        };
    }
    calculateWeightSummary(batch) {
        const checks = batch.weightChecks;
        if (checks.length === 0) {
            return {
                checked: false,
                passed: false,
                totalExpected: 0,
                totalActual: 0,
                deviationPercent: 0
            };
        }
        const totalExpected = checks.reduce((sum, c) => sum + c.expected, 0);
        const totalActual = checks.reduce((sum, c) => sum + c.actual, 0);
        const deviationPercent = (0, domain_1.calculateWeightDeviationPercent)(totalExpected, totalActual);
        const rule = this.ruleEngine.getWeightRule(batch.materialCode);
        const validation = (0, domain_1.validateWeightCheck)(checks, rule);
        return {
            checked: true,
            passed: validation.valid,
            totalExpected,
            totalActual,
            deviationPercent
        };
    }
    calculateTicketSummary(batch) {
        const checks = batch.ticketChecks;
        if (checks.length === 0) {
            return {
                checked: false,
                passed: false,
                totalProvided: 0,
                totalRequired: 0
            };
        }
        const rule = this.ruleEngine.getTicketRule(batch.materialCode);
        const validation = (0, domain_1.validateTicketCheck)(checks, rule);
        const totalProvided = checks.filter(c => c.provided).length;
        return {
            checked: true,
            passed: validation.valid,
            totalProvided,
            totalRequired: rule.requiredTypes.length
        };
    }
}
exports.InspectionService = InspectionService;
//# sourceMappingURL=inspectionService.js.map