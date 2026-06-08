import { z } from 'zod';
import { CustodyRepo } from '../db/repositories/CustodyRepo.js';
import { AdjustmentRepo } from '../db/repositories/AdjustmentRepo.js';
import { ProcessService } from './ProcessService.js';
import type { CustodyConfirmation, TailAdjustment, CustodyDiffSnapshot, CustodyDiffField, CustodyCreateResult } from '../../shared/types.js';

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

function buildDiffSnapshot(
  adjustmentBefore: TailAdjustment,
  adjustmentAfter: TailAdjustment,
  custody: CustodyConfirmation,
  operator: string
): CustodyDiffSnapshot {
  const fields: CustodyDiffField[] = [
    {
      field: 'status',
      label: '状态',
      original: adjustmentBefore.status,
      corrected: adjustmentAfter.status,
      reason: adjustmentBefore.hasZeroAmountButReversed
        ? '冲正记录补录托管确认页后，自动流转至待风控复核，不归正常'
        : '补录托管确认页，状态流转',
    },
    {
      field: 'custodyConfirmId',
      label: '托管确认页ID',
      original: adjustmentBefore.custodyConfirmId ?? null,
      corrected: custody.id,
      reason: '补录托管确认页后关联',
    },
    {
      field: 'voucherNo',
      label: '凭证编号',
      original: null,
      corrected: custody.voucherNo,
      reason: '托管确认页凭证号',
    },
    {
      field: 'custodyAmount',
      label: '托管金额',
      original: adjustmentBefore.amount,
      corrected: custody.amount,
      reason: adjustmentBefore.amount === 0 && custody.amount > 0
        ? '原调整金额为0（冲正），托管页记录实际发生额'
        : '托管金额与调整金额一致',
    },
    {
      field: 'handler',
      label: '经办人',
      original: null,
      corrected: custody.handler,
      reason: '托管确认页经办人签字',
    },
    {
      field: 'hasScannedCopy',
      label: '已上传扫描件',
      original: null,
      corrected: custody.hasScannedCopy,
      reason: custody.hasScannedCopy ? '已上传凭证扫描件' : '尚未上传扫描件',
    },
  ];

  return {
    adjustmentId: adjustmentBefore.id,
    adjustmentNo: adjustmentBefore.adjustmentNo,
    beforeStatus: adjustmentBefore.status,
    afterStatus: adjustmentAfter.status,
    fields,
    snapshotTime: new Date().toISOString().replace('T', ' ').substring(0, 19),
    operator,
  };
}

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
  ): CustodyCreateResult {
    const validated = CreateCustodySchema.parse(data);

    const adjustmentBefore = AdjustmentRepo.findById(validated.adjustmentId);
    if (!adjustmentBefore) {
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

    const adjustmentAfter = AdjustmentRepo.findById(validated.adjustmentId)!;

    const diffSnapshot = buildDiffSnapshot(adjustmentBefore, adjustmentAfter, custody, operator);

    return { custody, adjustment: adjustmentAfter, diffSnapshot };
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
