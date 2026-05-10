import { Entity, Column, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from '../common/base.entity';
import { Group } from '../groups/group.entity';
import { BillShare } from './bill-share.entity';
import { BillVersion } from './bill-version.entity';
import { AuditLog } from '../audit/audit-log.entity';

export enum BillStatus {
  PENDING = 'pending',
  SETTLED = 'settled',
  CANCELLED = 'cancelled',
}

@Entity('bills')
export class Bill extends BaseEntity {
  @Column()
  title: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'date' })
  date: Date;

  @Column({ type: 'uuid' })
  paidByUserId: string;

  @Column({ type: 'uuid' })
  groupId: string;

  @Column({ type: 'uuid', nullable: true, unique: true })
  requestId: string;

  @Column({
    type: 'enum',
    enum: BillStatus,
    default: BillStatus.PENDING,
  })
  status: BillStatus;

  @ManyToOne(() => Group, (group) => group.bills)
  group: Group;

  @OneToMany(() => BillShare, (share) => share.bill, { cascade: true })
  shares: BillShare[];

  @OneToMany(() => BillVersion, (version) => version.bill, { cascade: true })
  versions: BillVersion[];

  @OneToMany(() => AuditLog, (log) => log.bill)
  auditLogs: AuditLog[];
}
