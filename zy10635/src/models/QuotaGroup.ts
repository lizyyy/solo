import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { Survey } from './Survey';
import { Sample } from './Sample';

export enum QuotaStatus {
  COLLECTING = 'collecting',
  QUOTA_FULL = 'quota_full',
  RESAMPLING = 'resampling',
  CLOSED = 'closed',
}

@Entity()
export class QuotaGroup {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  surveyId: number;

  @Column()
  name: string;

  @Column({ type: 'simple-json', nullable: true })
  conditions: Record<string, any>;

  @Column({
    type: 'simple-enum',
    enum: QuotaStatus,
    default: QuotaStatus.COLLECTING,
  })
  status: QuotaStatus;

  @Column({ default: 0 })
  targetCount: number;

  @Column({ default: 0 })
  currentCount: number;

  @Column({ default: 0 })
  invalidCount: number;

  @Column({ type: 'text', nullable: true })
  remark: string;

  @ManyToOne(() => Survey, (survey) => survey.quotaGroups)
  @JoinColumn({ name: 'surveyId' })
  survey: Survey;

  @OneToMany(() => Sample, (sample) => sample.quotaGroup)
  samples: Sample[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}