import { z } from 'zod';

export const EnvironmentSchema = z.enum(['dev', 'test', 'staging', 'prod']);

export const SecretStatusSchema = z.enum(['ACTIVE', 'DEPRECATED', 'PENDING_DELETION']);

export const ReplacementStatusSchema = z.enum([
  'PENDING_APPROVAL',
  'APPROVED',
  'REJECTED',
  'EXECUTED',
]);

export const CreateSecretSchema = z.object({
  name: z.string().min(1, 'Secret名称不能为空'),
  description: z.string().optional(),
});

export const UpdateSecretStatusSchema = z.object({
  status: SecretStatusSchema,
});

export const CreateReferenceSchema = z.object({
  service_name: z.string().min(1, '服务名称不能为空'),
  environment: EnvironmentSchema,
  file_path: z.string().optional(),
  line_number: z.number().int().positive().optional(),
});

export const RecordAccessSchema = z.object({
  reference_id: z.string().optional(),
  accessed_by: z.string().optional(),
  access_source: z.string().optional(),
});

export const CreateReplacementSchema = z.object({
  new_secret_name: z.string().min(1, '新Secret名称不能为空'),
  planned_date: z.coerce.date(),
  created_by: z.string().min(1, '创建人不能为空'),
});

export const ApproveReplacementSchema = z.object({
  approver: z.string().min(1, '审批人不能为空'),
  approval_comment: z.string().optional(),
});

export const CreateCorrectionSchema = z.object({
  field_name: z.string().min(1, '字段名称不能为空'),
  old_value: z.string().optional(),
  new_value: z.string().optional(),
  reason: z.string().min(1, '修正原因不能为空'),
  corrected_by: z.string().min(1, '修正人不能为空'),
});

export const QuerySecretsSchema = z.object({
  name: z.string().optional(),
  status: SecretStatusSchema.optional(),
  environment: EnvironmentSchema.optional(),
  page: z.coerce.number().int().positive().default(1),
  page_size: z.coerce.number().int().positive().max(100).default(20),
});

export type CreateSecretInput = z.infer<typeof CreateSecretSchema>;
export type UpdateSecretStatusInput = z.infer<typeof UpdateSecretStatusSchema>;
export type CreateReferenceInput = z.infer<typeof CreateReferenceSchema>;
export type RecordAccessInput = z.infer<typeof RecordAccessSchema>;
export type CreateReplacementInput = z.infer<typeof CreateReplacementSchema>;
export type ApproveReplacementInput = z.infer<typeof ApproveReplacementSchema>;
export type CreateCorrectionInput = z.infer<typeof CreateCorrectionSchema>;
export type QuerySecretsInput = z.infer<typeof QuerySecretsSchema>;
