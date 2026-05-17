import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Survey } from './Survey';
import { QuotaGroup } from './QuotaGroup';

export enum ResampleStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  COMPLETED = 'completed',
}

@Entity()
export class ResampleReason {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  surveyId: number;

  @Column({ nullable: true })
  quotaGroupId: number;

  @Column()
  reason: string;

  @Column({ default: 0 })
  requestedCount: number;

  @Column({ default: 0 })
  approvedCount: number;

  @Column({
    type: 'simple-enum',
    enum: ResampleStatus,
    default: ResampleStatus.PENDING,
  })
  status: ResampleStatus;

  @Column()
  requestedBy: string;

  @Column({ nullable: true })
  approvedBy: string;

  @Column({ type: 'text', nullable: true })
  remark: string;

  @ManyToOne(() => Survey)
  @JoinColumn({ name: 'surveyId' })
  survey: Survey;

  @ManyToOne(() => QuotaGroup)
  @JoinColumn({ name: 'quotaGroupId' })
  quotaGroup: QuotaGroup;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}