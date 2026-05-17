import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Appeal } from './Appeal';
import { TenantStatus } from './Tenant';

export enum OperationType {
  SUBMIT = 'submit',
  REVIEW = 'review',
  APPROVE = 'approve',
  REJECT = 'reject',
  RESUBMIT = 'resubmit',
  RESTORE = 'restore',
  FREEZE = 'freeze',
  PAYMENT = 'payment',
  MANUAL_EDIT = 'manual_edit',
  IMPORT = 'import'
}

@Entity()
export class AppealHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'simple-enum',
    enum: OperationType
  })
  operationType: OperationType;

  @Column()
  operatorName: string;

  @Column({ type: 'text', nullable: true })
  operationRemark: string;

  @Column({ type: 'simple-json', nullable: true })
  changedFields: Record<string, { old: any; new: any }>;

  @Column({ type: 'simple-json', nullable: true })
  snapshotData: any;

  @Column({ nullable: true })
  tenantStatusBefore: TenantStatus;

  @Column({ nullable: true })
  tenantStatusAfter: TenantStatus;

  @Column({ nullable: true })
  appealStatusBefore: string;

  @Column({ nullable: true })
  appealStatusAfter: string;

  @Column({ nullable: true })
  requestId: string;

  @Column({ default: false })
  isDuplicateSubmission: boolean;

  @Column({ nullable: true })
  duplicateOfHistoryId?: string;

  @Column()
  appealId: string;

  @ManyToOne(() => Appeal, appeal => appeal.histories)
  @JoinColumn({ name: 'appealId' })
  appeal: Appeal;

  @Column()
  tenantId: string;

  @CreateDateColumn()
  operatedAt: Date;
}
