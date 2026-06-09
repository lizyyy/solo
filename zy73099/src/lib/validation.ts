import { z } from 'zod';

export const disclosureItemSchema = z.object({
  id: z.string().min(1, 'ID不能为空'),
  sourceType: z.enum(['meeting', 'manual', 'supplement', 'combined'], {
    message: '来源类型必须是 meeting/manual/supplement/combined',
  }),
  title: z.string().min(1, '标题不能为空').max(200, '标题不能超过200字'),
  content: z.string().min(1, '内容不能为空'),
  originalContent: z.string().min(1, '原始内容不能为空'),
  manualChangeContent: z.string().optional(),
  supplementContent: z.string().optional(),
  status: z.enum(['pending', 'confirmed', 'reverted', 'awaiting_patch'], {
    message: '状态必须是 pending/confirmed/reverted/awaiting_patch',
  }),
  fireZone: z.string().min(1, '消防分区不能为空'),
  responsiblePerson: z.string().min(1, '负责人不能为空'),
  contactPhone: z.string().min(1, '联系电话不能为空'),
  coordinateOffset: z.number().min(0, '坐标偏移量不能为负数'),
  offsetRiskLevel: z.enum(['none', 'low', 'high']),
  blockerReason: z.string().optional(),
  nextContact: z.string().optional(),
  nextContactRole: z.string().optional(),
  nextContactPhone: z.string().optional(),
  revertReason: z.string().optional(),
  confirmRemark: z.string().optional(),
  contentBefore: z.string().optional(),
  contentAfter: z.string().optional(),
  diffMetadata: z.string().optional(),
  createdFrom: z.enum(['import', 'quickstart']),
  createdAt: z.string(),
  updatedAt: z.string(),
  operator: z.string().optional(),
  confirmedAt: z.string().optional(),
  revertedAt: z.string().optional(),
});

export const importFileSchema = z.object({
  items: z.array(disclosureItemSchema).min(1, '导入数据不能为空'),
});

export function validateDisclosureItem(data: unknown) {
  return disclosureItemSchema.safeParse(data);
}

export function validateImportData(data: unknown) {
  return importFileSchema.safeParse(data);
}

export const zodErrorMessageMap: Record<string, string> = {
  'title_too_small': '请填写交底标题',
  'content_too_small': '请填写交底内容',
  'fireZone_too_small': '请填写所属消防分区',
  'responsiblePerson_too_small': '请填写负责人姓名',
  'contactPhone_too_small': '请填写联系电话',
  'invalid_status': '状态值不合法，必须为 pending/confirmed/reverted/awaiting_patch',
  'invalid_sourceType': '来源类型不合法',
};
