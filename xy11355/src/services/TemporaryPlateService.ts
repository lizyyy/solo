import { storage } from '../storage';
import { TemporaryPlate } from '../models/types';
import {
  generateIdempotencyKey,
  logger,
  maskObject,
  normalizePlateNumber,
  isExpired
} from '../utils';

export interface CreateTemporaryPlateParams {
  plateNumber: string;
  visitorName: string;
  visitorPhone: string;
  validFrom: string;
  validTo: string;
  operator: string;
  idempotencyKey?: string;
}

export class TemporaryPlateService {
  create(params: CreateTemporaryPlateParams): TemporaryPlate {
    const idempotencyKey = params.idempotencyKey || generateIdempotencyKey(
      params.plateNumber,
      params.validFrom,
      params.validTo
    );

    const existing = storage.temporaryPlates.findByIdempotencyKey(idempotencyKey);
    if (existing) {
      logger.info('幂等性命中，返回已存在临时车牌', {
        plateId: existing.id,
        plateNumber: params.plateNumber,
        idempotencyKey
      });
      return maskObject(existing);
    }

    const normalizedPlate = normalizePlateNumber(params.plateNumber);
    const plate = storage.temporaryPlates.create({
      plateNumber: normalizedPlate,
      visitorName: params.visitorName,
      visitorPhone: params.visitorPhone,
      validFrom: params.validFrom,
      validTo: params.validTo,
      isActive: true,
      idempotencyKey
    } as TemporaryPlate, idempotencyKey);

    logger.audit('创建临时车牌', {
      plateId: plate.id,
      plateNumber: normalizedPlate,
      operator: params.operator,
      visitorName: params.visitorName
    });

    return maskObject(plate);
  }

  getById(id: string): TemporaryPlate | undefined {
    const plate = storage.temporaryPlates.findById(id);
    return plate ? maskObject(plate) : undefined;
  }

  getByPlateNumber(plateNumber: string): TemporaryPlate | undefined {
    const normalizedPlate = normalizePlateNumber(plateNumber);
    const plate = storage.temporaryPlates.findOne(
      p => normalizePlateNumber(p.plateNumber) === normalizedPlate && p.isActive
    );
    return plate ? maskObject(plate) : undefined;
  }

  getAll(): TemporaryPlate[] {
    const plates = storage.temporaryPlates.findMany(p => p.isActive);
    return plates.map(p => maskObject(p));
  }

  verify(plateNumber: string): {
    valid: boolean;
    plate?: TemporaryPlate;
    reason: string;
  } {
    const normalizedPlate = normalizePlateNumber(plateNumber);
    const plate = storage.temporaryPlates.findOne(
      p => normalizePlateNumber(p.plateNumber) === normalizedPlate && p.isActive
    );

    if (!plate) {
      return { valid: false, reason: '未找到临时车牌记录' };
    }

    const now = new Date();
    const validFrom = new Date(plate.validFrom);
    const validTo = new Date(plate.validTo);

    if (now < validFrom) {
      return { valid: false, reason: '临时车牌尚未生效' };
    }

    if (now > validTo) {
      return { valid: false, reason: '临时车牌已过期' };
    }

    return {
      valid: true,
      plate: maskObject(plate),
      reason: '临时车牌核验通过'
    };
  }

  deactivate(id: string, operator: string): boolean {
    const plate = storage.temporaryPlates.findById(id);
    if (!plate) {
      return false;
    }

    const result = storage.temporaryPlates.update(id, { isActive: false });

    logger.audit('注销临时车牌', {
      plateId: id,
      plateNumber: plate.plateNumber,
      operator
    });

    return !!result;
  }

  importBatch(
    plates: Omit<CreateTemporaryPlateParams, 'operator'>[],
    operator: string
  ): { total: number; added: number; skipped: number } {
    let added = 0;
    let skipped = 0;

    for (const plate of plates) {
      const idempotencyKey = plate.idempotencyKey || generateIdempotencyKey(
        plate.plateNumber,
        plate.validFrom,
        plate.validTo
      );

      const existing = storage.temporaryPlates.findByIdempotencyKey(idempotencyKey);
      if (existing) {
        skipped++;
      } else {
        this.create({ ...plate, operator });
        added++;
      }
    }

    logger.audit('批量导入临时车牌', {
      total: plates.length,
      added,
      skipped,
      operator
    });

    return { total: plates.length, added, skipped };
  }
}

export const temporaryPlateService = new TemporaryPlateService();
