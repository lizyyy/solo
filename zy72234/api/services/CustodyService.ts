import { z } from 'zod';
import { CustodyRepo } from '../db/repositories/CustodyRepo.js';
import { AdjustmentRepo } from '../db/repositories/AdjustmentRepo.js';
import { ProcessService } from './ProcessService.js';
import type { CustodyConfirmation, TailAdjustment } from '../../shared/types.js';

const CreateCustodySchema = z.object({
  adjustmentId: z.string().min(1, '调整条ID不能为空'),
  voucherNo: z.string().min(1, '凭证号不能为空'),
  custodyDate: z.string().min(1, '托管日期不能为空'),
  amount: z.number().min(0, '金额不能为负数'),
  custodian: z.string().min(1, '托管方不能为空'),
  handler: z.string().min(1, '经办人不能为空'),
  signatureUrl: z.string().optional(),
  hasScannedCopy: z.boolean().default(false),
  supplementaryFields: z.record(z.string(), z.string()).default({}),
});

const UpdateCustodySchema = CreateCustodySchema.partial().omit({ adjustmentId: true });

export const CustodyService = {
  getByAdjustmentId(adjustmentId: string): CustodyConfirmation | undefined {
    return CustodyRepo.findByAdjustmentId(adjustmentId);
  },

  getById(id: string): CustodyConfirmation | undefined {
    return CustodyRepo.findById(id);
  },

  getAll(): CustodyConfirmation[] {
    return CustodyRepo.findAll();
  },

  createCustody(
    data: z.infer<typeof CreateCustodySchema>,
    operator: string = '小周'
  ): { custody: CustodyConfirmation; adjustment: TailAdjustment } {
    const validated = CreateCustodySchema.parse(data);
    
    const adjustment = AdjustmentRepo.findById(validated.adjustmentId);
    if (!adjustment) {
      throw new Error('调整条不存在');
    }

    const existingCustody = CustodyRepo.findByAdjustmentId(validated.adjustmentId);
    if (existingCustody) {
      throw new Error('该调整条已存在托管确认页');
    }

    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const custodyData = {
      ...validated,
      createTime: now,
      updateTime: now,
    } as Omit<CustodyConfirmation, 'id'>;
    const custody = CustodyRepo.create(custodyData);

    AdjustmentRepo.updateCustodyConfirmId(validated.adjustmentId, custody.id);

    ProcessService.recordCustody(validated.adjustmentId, operator, validated.voucherNo);

    const updatedAdjustment = AdjustmentRepo.findById(validated.adjustmentId)!;

    return { custody, adjustment: updatedAdjustment };
  },

  updateCustody(
    id: string,
    data: z.infer<typeof UpdateCustodySchema>
  ): CustodyConfirmation {
    const validated = UpdateCustodySchema.parse(data);
    
    const existing = CustodyRepo.findById(id);
    if (!existing) {
      throw new Error('托管确认页不存在');
    }

    CustodyRepo.update(id, validated);

    const updated = CustodyRepo.findById(id);
    if (!updated) {
      throw new Error('更新失败');
    }

    return updated;
  },

  getAdjustmentWithCustody(adjustmentId: string): { adjustment: TailAdjustment; custody?: CustodyConfirmation } | undefined {
    const adjustment = AdjustmentRepo.findById(adjustmentId);
    if (!adjustment) {
      return undefined;
    }

    const custody = adjustment.custodyConfirmId
      ? CustodyRepo.findById(adjustment.custodyConfirmId)
      : undefined;

    return { adjustment, custody };
  },

  getJumpTarget(adjustmentId: string): { type: 'custody' | 'adjustment'; id: string } {
    const custody = CustodyRepo.findByAdjustmentId(adjustmentId);
    if (custody) {
      return { type: 'custody', id: custody.id };
    }
    return { type: 'adjustment', id: adjustmentId };
  },
};
