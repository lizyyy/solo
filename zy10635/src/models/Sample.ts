import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Survey } from './Survey';
import { QuotaGroup } from './QuotaGroup';

export enum SampleStatus {
  VALID = 'valid',
  INVALID = 'invalid',
  PENDING = 'pending',
}

export enum SampleSource {
  ONLINE = 'online',
  IMPORT = 'import',
  RESAMPLE = 'resample',
}

@Entity()
export class Sample {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  surveyId: number;

  @Column({ nullable: true })
  quotaGroupId: number;

  @Column()
  respondentId: string;

  @Column({
    type: 'simple-enum',
    enum: SampleStatus,
    default: SampleStatus.PENDING,
  })
  status: SampleStatus;

  @Column({
    type: 'simple-enum',
    enum: SampleSource,
    default: SampleSource.ONLINE,
  })
  source: SampleSource;

  @Column({ type: 'simple-json', nullable: true })
  data: Record<string, any>;

  @Column({ type: 'text', nullable: true })
  invalidReason: string;

  @Column({ type: 'text', nullable: true })
  remark: string;

  @Column({ default: false })
  isResample: boolean;

  @ManyToOne(() => Survey)
  @JoinColumn({ name: 'surveyId' })
  survey: Survey;

  @ManyToOne(() => QuotaGroup, (quota) => quota.samples)
  @JoinColumn({ name: 'quotaGroupId' })
  quotaGroup: QuotaGroup;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}