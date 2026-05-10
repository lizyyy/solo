import {
  Batch,
  BatchStatus,
  InspectionType,
  TemperatureUnit,
  WeightUnit,
  TicketType,
  TemperatureCheckItem,
  WeightCheckItem,
  TicketItem,
  RejectionReason,
  CreateBatchRequest,
  TemperatureCheckRequest,
  WeightCheckRequest,
  TicketCheckRequest,
  RejectBatchRequest,
  ReplenishBatchRequest,
  AcceptBatchRequest,
  checkDuplicateSubmission,
  validateTransition,
  RuleEngine,
  validateTemperatureCheck,
  validateWeightCheck,
  validateTicketCheck,
  validateRejectionReasons,
  calculateWeightDeviationPercent
} from '../domain';
import {
  BatchNotFoundError,
  ValidationError
} from '../domain/errors';
import { IBatchRepository } from '../infrastructure/repositories';

export interface InspectionResult<T> {
  success: boolean;
  batch?: Batch;
  data?: T;
  errors?: string[];
  warnings?: string[];
}

export interface InspectionReport {
  batchId: string;
  materialCode: string;
  materialName: string;
  supplierId: string;
  status: BatchStatus;
  temperatureSummary: {
    checked: boolean;
    passed: boolean;
    count: number;
    minTemp?: number;
    maxTemp?: number;
    avgTemp?: number;
  };
  weightSummary: {
    checked: boolean;
    passed: boolean;
    totalExpected: number;
    totalActual: number;
    deviationPercent: number;
  };
  ticketSummary: {
    checked: boolean;
    passed: boolean;
    totalProvided: number;
    totalRequired: number;
  };
  rejectionReasons: RejectionReason[];
  createdAt: Date;
}

export class InspectionService {
  constructor(
    private readonly repository: IBatchRepository,
    private readonly ruleEngine: RuleEngine
  ) {}

  async createBatch(request: CreateBatchRequest): Promise<Batch> {
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
      status: BatchStatus.PENDING,
      temperatureChecks: [],
      weightChecks: [],
      ticketChecks: [],
      rejectionReasons: []
    });
  }

  async performTemperatureCheck(
    request: TemperatureCheckRequest
  ): Promise<InspectionResult<null>> {
    const batch = await this.getBatchOrThrow(request.batchId);

    checkDuplicateSubmission(batch, InspectionType.TEMPERATURE);
    validateTransition(batch.status, BatchStatus.TEMPERATURE_CHECKED);

    const items: TemperatureCheckItem[] = request.items.map(item => ({
      location: item.location,
      value: item.value,
      unit: item.unit as TemperatureUnit,
      measuredAt: new Date(item.measuredAt),
      operatorId: item.operatorId
    }));

    const rule = this.ruleEngine.getTemperatureRule(batch.materialCode);
    const validation = validateTemperatureCheck(items, rule);

    if (!validation.valid) {
      return {
        success: false,
        batch,
        errors: validation.errors.map(e => e.message),
        warnings: validation.warnings
      };
    }

    const updatedBatch: Batch = {
      ...batch,
      status: BatchStatus.TEMPERATURE_CHECKED,
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

  async performWeightCheck(
    request: WeightCheckRequest
  ): Promise<InspectionResult<null>> {
    const batch = await this.getBatchOrThrow(request.batchId);

    checkDuplicateSubmission(batch, InspectionType.WEIGHT);
    validateTransition(batch.status, BatchStatus.WEIGHT_CHECKED);

    const items: WeightCheckItem[] = request.items.map(item => ({
      expected: item.expected,
      actual: item.actual,
      unit: item.unit as WeightUnit
    }));

    const rule = this.ruleEngine.getWeightRule(batch.materialCode);
    const validation = validateWeightCheck(items, rule);

    if (!validation.valid) {
      return {
        success: false,
        batch,
        errors: validation.errors.map(e => e.message),
        warnings: validation.warnings
      };
    }

    const updatedBatch: Batch = {
      ...batch,
      status: BatchStatus.WEIGHT_CHECKED,
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

  async performTicketCheck(
    request: TicketCheckRequest
  ): Promise<InspectionResult<null>> {
    const batch = await this.getBatchOrThrow(request.batchId);

    checkDuplicateSubmission(batch, InspectionType.TICKET);
    validateTransition(batch.status, BatchStatus.TICKET_CHECKED);

    const items: TicketItem[] = request.items.map(item => ({
      type: item.type as TicketType,
      provided: item.provided,
      valid: item.valid,
      ticketNumber: item.ticketNumber,
      issueDate: item.issueDate ? new Date(item.issueDate) : undefined,
      expiryDate: item.expiryDate ? new Date(item.expiryDate) : undefined
    }));

    const rule = this.ruleEngine.getTicketRule(batch.materialCode);
    const validation = validateTicketCheck(items, rule);

    if (!validation.valid) {
      return {
        success: false,
        batch,
        errors: validation.errors.map(e => e.message),
        warnings: validation.warnings
      };
    }

    const updatedBatch: Batch = {
      ...batch,
      status: BatchStatus.TICKET_CHECKED,
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

  async rejectBatch(request: RejectBatchRequest): Promise<InspectionResult<null>> {
    const batch = await this.getBatchOrThrow(request.batchId);

    validateTransition(batch.status, BatchStatus.REJECTED);

    const reasons: RejectionReason[] = request.reasons.map(r => ({
      type: r.type as InspectionType,
      code: r.code,
      description: r.description,
      detail: r.detail
    }));

    const validation = validateRejectionReasons(reasons);

    if (!validation.valid) {
      return {
        success: false,
        batch,
        errors: validation.errors.map(e => e.message),
        warnings: validation.warnings
      };
    }

    const updatedBatch: Batch = {
      ...batch,
      status: BatchStatus.REJECTED,
      rejectionReasons: [...batch.rejectionReasons, ...reasons]
    };

    const saved = await this.repository.update(updatedBatch, batch.version);

    return {
      success: true,
      batch: saved
    };
  }

  async replenishBatch(
    request: ReplenishBatchRequest
  ): Promise<InspectionResult<null>> {
    const batch = await this.getBatchOrThrow(request.batchId);

    validateTransition(batch.status, BatchStatus.REPLENISHED);

    if (!request.operatorId || request.operatorId.trim() === '') {
      throw new ValidationError('操作员ID不能为空', 'operatorId');
    }

    const updatedBatch: Batch = {
      ...batch,
      status: BatchStatus.REPLENISHED,
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

  async acceptBatch(
    request: AcceptBatchRequest
  ): Promise<InspectionResult<null>> {
    const batch = await this.getBatchOrThrow(request.batchId);

    const targetStatus = request.partialAccept
      ? BatchStatus.PARTIALLY_ACCEPTED
      : BatchStatus.ACCEPTED;

    validateTransition(batch.status, targetStatus);

    if (request.partialAccept) {
      if (request.acceptedQuantity === undefined || request.acceptedQuantity === null) {
        throw new ValidationError('部分验收必须指定验收数量', 'acceptedQuantity');
      }
      if (request.acceptedQuantity <= 0) {
        throw new ValidationError('验收数量必须大于 0', 'acceptedQuantity');
      }
      if (request.acceptedQuantity > batch.quantity) {
        throw new ValidationError('验收数量不能超过批次总数量', 'acceptedQuantity');
      }
    }

    const updatedBatch: Batch = {
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

  async getBatch(batchId: string): Promise<Batch | null> {
    return this.repository.findById(batchId);
  }

  async listBatches(
    filters?: { supplierId?: string; status?: string; materialCode?: string }
  ): Promise<Batch[]> {
    return this.repository.findAll(filters);
  }

  async generateReport(batchId: string): Promise<InspectionReport> {
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

  private async getBatchOrThrow(batchId: string): Promise<Batch> {
    const batch = await this.repository.findById(batchId);
    if (!batch) {
      throw new BatchNotFoundError(batchId);
    }
    return batch;
  }

  private validateCreateBatchRequest(request: CreateBatchRequest): void {
    if (!request.supplierId || request.supplierId.trim() === '') {
      throw new ValidationError('供应商ID不能为空', 'supplierId');
    }
    if (!request.materialCode || request.materialCode.trim() === '') {
      throw new ValidationError('物料编码不能为空', 'materialCode');
    }
    if (!request.materialName || request.materialName.trim() === '') {
      throw new ValidationError('物料名称不能为空', 'materialName');
    }
    if (!request.quantity || request.quantity <= 0) {
      throw new ValidationError('数量必须大于 0', 'quantity');
    }
    if (!request.unit || request.unit.trim() === '') {
      throw new ValidationError('单位不能为空', 'unit');
    }
    if (!request.operatorId || request.operatorId.trim() === '') {
      throw new ValidationError('操作员ID不能为空', 'operatorId');
    }
  }

  private calculateTemperatureSummary(batch: Batch) {
    const checks = batch.temperatureChecks;
    if (checks.length === 0) {
      return { checked: false, passed: false, count: 0 };
    }

    const temps = checks.map(c => c.value);
    const rule = this.ruleEngine.getTemperatureRule(batch.materialCode);
    const validation = validateTemperatureCheck(checks, rule);

    return {
      checked: true,
      passed: validation.valid,
      count: checks.length,
      minTemp: Math.min(...temps),
      maxTemp: Math.max(...temps),
      avgTemp: temps.reduce((a, b) => a + b, 0) / temps.length
    };
  }

  private calculateWeightSummary(batch: Batch) {
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
    const deviationPercent = calculateWeightDeviationPercent(totalExpected, totalActual);

    const rule = this.ruleEngine.getWeightRule(batch.materialCode);
    const validation = validateWeightCheck(checks, rule);

    return {
      checked: true,
      passed: validation.valid,
      totalExpected,
      totalActual,
      deviationPercent
    };
  }

  private calculateTicketSummary(batch: Batch) {
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
    const validation = validateTicketCheck(checks, rule);
    const totalProvided = checks.filter(c => c.provided).length;

    return {
      checked: true,
      passed: validation.valid,
      totalProvided,
      totalRequired: rule.requiredTypes.length
    };
  }
}
