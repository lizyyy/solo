import { SetMetadata } from '@nestjs/common';
import { AuditOperation, AuditEntity } from '@prisma/client';

export const AUDIT_LOG_METADATA = 'audit_log_metadata';

export interface AuditLogMetadata {
  operation: AuditOperation;
  entity: AuditEntity;
  remark?: string;
}

export const AuditLog = (metadata: AuditLogMetadata) =>
  SetMetadata(AUDIT_LOG_METADATA, metadata);
