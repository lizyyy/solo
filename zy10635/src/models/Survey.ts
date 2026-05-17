import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { QuotaGroup } from './QuotaGroup';

export enum SurveyStatus {
  COLLECTING = 'collecting',
  QUOTA_FULL = 'quota_full',
  RESAMPLING = 'resampling',
  CLOSED = 'closed',
}

@Entity()
export class Survey {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({
    type: 'simple-enum',
    enum: SurveyStatus,
    default: SurveyStatus.COLLECTING,
  })
  status: SurveyStatus;

  @Column({ default: 0 })
  targetSampleSize: number;

  @Column({ default: 0 })
  currentSampleSize: number;

  @Column({ type: 'text', nullable: true })
  remark: string;

  @OneToMany(() => QuotaGroup, (quota) => quota.survey)
  quotaGroups: QuotaGroup[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}