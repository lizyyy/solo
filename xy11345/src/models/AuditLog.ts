import { Entity, Column } from 'typeorm';
import { BaseEntity } from './BaseEntity';

export enum AuditAction {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  IMPORT = 'import',
  JUDGMENT = 'judgment',
  REVIEW = 'review',
  REWORK = 'rework',
  EXPORT = 'export',
  GENERATE_ORDER = 'generate_order'
}

@Entity('audit_logs')
export class AuditLog extends BaseEntity {
  @Column({ type: 'varchar', length: 50 })
  action!: AuditAction;

  @Column({ type: 'varchar', length: 100 })
  entityType!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  entityId?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  batchNumber?: string;

  @Column({ type: 'simple-json', nullable: true })
  beforeData?: Record<string, any>;

  @Column({ type: 'simple-json', nullable: true })
  afterData?: Record<string, any>;

  @Column({ type: 'text', nullable: true })
  changes?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  operator?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  operatorRole?: string;

  @Column({ type: 'text', nullable: true })
  remark?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  ipAddress?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  requestId?: string;
}
