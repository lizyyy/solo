import { Entity, Column, ManyToOne } from 'typeorm';
import { BaseEntity } from '../common/base.entity';
import { User } from '../users/user.entity';
import { Group } from '../groups/group.entity';
import { Bill } from '../bills/bill.entity';

export enum AuditAction {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  SETTLE = 'settle',
  JOIN = 'join',
  LEAVE = 'leave',
  LOGIN = 'login',
  LOGOUT = 'logout',
  EXPORT = 'export',
}

export enum AuditEntityType {
  USER = 'user',
  GROUP = 'group',
  BILL = 'bill',
  SYSTEM = 'system',
}

@Entity('audit_logs')
export class AuditLog extends BaseEntity {
  @Column({ type: 'enum', enum: AuditAction })
  action: AuditAction;

  @Column({ type: 'enum', enum: AuditEntityType })
  entityType: AuditEntityType;

  @Column({ type: 'uuid', nullable: true })
  entityId: string;

  @Column('jsonb', { nullable: true })
  oldValue: any;

  @Column('jsonb', { nullable: true })
  newValue: any;

  @Column({ type: 'text', nullable: true })
  ipAddress: string;

  @Column({ type: 'text', nullable: true })
  userAgent: string;

  @Column({ type: 'text', nullable: true })
  requestId: string;

  @Column({ type: 'uuid', nullable: true })
  userId: string;

  @Column({ type: 'uuid', nullable: true })
  groupId: string;

  @Column({ type: 'uuid', nullable: true })
  billId: string;

  @ManyToOne(() => User, (user) => user.auditLogs, { nullable: true })
  user: User;

  @ManyToOne(() => Group, (group) => group.auditLogs, { nullable: true })
  group: Group;

  @ManyToOne(() => Bill, (bill) => bill.auditLogs, { nullable: true })
  bill: Bill;
}
