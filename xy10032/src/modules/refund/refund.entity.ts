import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  VersionColumn,
} from 'typeorm';
import { RefundStatus } from '../../common/enums/refund-status.enum';
import { User } from '../user/user.entity';
import { AuditLog } from '../audit-log/audit-log.entity';
import { RefundHistory } from './refund-history.entity';

@Entity('refunds')
export class Refund {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  refundNo: string;

  @Column()
  orderNo: string;

  @Column('decimal', { precision: 12, scale: 2 })
  amount: number;

  @Column({ nullable: true })
  currency: string;

  @Column({ default: 'original_payment' })
  refundMethod: string;

  @Column({ type: 'text', nullable: true })
  reason: string;

  @Column({
    type: 'enum',
    enum: RefundStatus,
    default: RefundStatus.DRAFT,
  })
  status: RefundStatus;

  @Column({ nullable: true })
  gatewayTransactionId: string;

  @Column({ nullable: true, type: 'text' })
  gatewayResponse: string;

  @Column({ default: 0 })
  retryCount: number;

  @Column({ nullable: true })
  lastRetryAt: Date;

  @Column({ default: false })
  isDuplicate: boolean;

  @Column({ nullable: true, type: 'text' })
  remark: string;

  @ManyToOne(() => User, (user) => user.createdRefunds)
  createdBy: User;

  @Column()
  createdById: string;

  @Column({ nullable: true })
  approvedById: string;

  @OneToMany(() => RefundHistory, (history) => history.refund)
  histories: RefundHistory[];

  @OneToMany(() => AuditLog, (log) => log.refund)
  auditLogs: AuditLog[];

  @VersionColumn()
  version: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
