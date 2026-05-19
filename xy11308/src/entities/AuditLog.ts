import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export enum AuditAction {
  CREATE = 'create',
  READ = 'read',
  UPDATE = 'update',
  DELETE = 'delete',
  BATCH_CREATE = 'batch_create',
  BATCH_UPDATE = 'batch_update',
  RULE_CHECK_PASS = 'rule_check_pass',
  RULE_CHECK_BLOCK = 'rule_check_block',
  MEAL_ASSIGN = 'meal_assign',
  MEAL_CHANGE = 'meal_change',
  DELIVERY_UPDATE = 'delivery_update',
  FOLLOW_UP = 'follow_up',
  EXPORT = 'export'
}

export enum AuditEntity {
  ELDER = 'elder',
  MEAL = 'meal',
  MEAL_ASSIGNMENT = 'meal_assignment',
  MEAL_CHANGE = 'meal_change',
  DELIVERY = 'delivery',
  FOLLOW_UP = 'follow_up',
  BATCH_OPERATION = 'batch_operation',
  REPORT = 'report'
}

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'simple-enum', enum: AuditAction })
  action: AuditAction;

  @Column({ type: 'simple-enum', enum: AuditEntity })
  entity: AuditEntity;

  @Column({ nullable: true })
  entityId: string;

  @Column({ type: 'text', nullable: true })
  beforeData: string;

  @Column({ type: 'text', nullable: true })
  afterData: string;

  @Column({ type: 'text', nullable: true })
  reason: string;

  @Column()
  operator: string;

  @Column()
  operatorRole: string;

  @CreateDateColumn()
  operatedAt: Date;

  @Column({ default: false })
  success: boolean;

  @Column({ type: 'text', nullable: true })
  errorMessage: string;
}