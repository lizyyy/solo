import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { Tenant } from './Tenant';
import { OverchargeRecord } from './OverchargeRecord';
import { AppealHistory } from './AppealHistory';

export enum AppealStatus {
  PENDING = 'pending',
  REVIEWING = 'reviewing',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  PROCESSING = 'processing',
  COMPLETED = 'completed'
}

export enum AppealType {
  OVERCHARGE_DISPUTE = 'overcharge_dispute',
  RESTORATION_REQUEST = 'restoration_request',
  ADJUSTMENT_REQUEST = 'adjustment_request'
}

@Entity()
export class Appeal {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  appealCode: string;

  @Column({
    type: 'simple-enum',
    enum: AppealType
  })
  appealType: AppealType;

  @Column({
    type: 'simple-enum',
    enum: AppealStatus,
    default: AppealStatus.PENDING
  })
  status: AppealStatus;

  @Column({ type: 'text' })
  reason: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'simple-json', nullable: true })
  evidenceFiles: string[];

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  disputeAmount: number;

  @Column()
  submitterName: string;

  @Column({ nullable: true })
  submitterPhone: string;

  @Column({ nullable: true })
  submitterEmail: string;

  @Column({ nullable: true })
  reviewerName: string;

  @Column({ type: 'text', nullable: true })
  reviewOpinion: string;

  @Column({ type: 'datetime', nullable: true })
  reviewedAt: Date;

  @Column({ type: 'date', nullable: true })
  expectedResolutionDate: Date;

  @Column()
  tenantId: string;

  @ManyToOne(() => Tenant)
  @JoinColumn({ name: 'tenantId' })
  tenant: Tenant;

  @Column({ default: 0 })
  submissionCount: number;

  @Column({ nullable: true })
  lastSubmissionId: string;

  @OneToMany(() => OverchargeRecord, record => record.appeal)
  overchargeRecords: OverchargeRecord[];

  @OneToMany(() => AppealHistory, history => history.appeal)
  histories: AppealHistory[];

  @Column({ nullable: true })
  source: string;

  @Column({ nullable: true })
  importBatchId: string;

  @Column({ default: false })
  isBadRecord: boolean;

  @Column({ type: 'text', nullable: true })
  badRecordReason: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
