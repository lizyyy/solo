import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { VisitSchedule } from './VisitSchedule';

export enum ReportStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  REVIEWED = 'REVIEWED',
  ARCHIVED = 'ARCHIVED'
}

@Entity()
export class VisitReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => VisitSchedule, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'visitScheduleId' })
  visitSchedule: VisitSchedule;

  @Column()
  visitScheduleId: string;

  @Column({ unique: true })
  reportNumber: string;

  @Column({
    type: 'simple-enum',
    enum: ReportStatus,
    default: ReportStatus.DRAFT
  })
  status: ReportStatus;

  @Column({ type: 'text', nullable: true })
  visitSummary: string;

  @Column({ type: 'text', nullable: true })
  customerFeedback: string;

  @Column({ type: 'text', nullable: true })
  issuesIdentified: string;

  @Column({ type: 'text', nullable: true })
  actionItems: string;

  @Column({ type: 'text', nullable: true })
  followUpRequired: string;

  @Column({ type: 'datetime', nullable: true })
  nextFollowUpDate: Date;

  @Column({ nullable: true })
  satisfactionScore: number;

  @Column({ type: 'simple-json', nullable: true })
  additionalData: any;

  @Column({ nullable: true })
  submittedBy: string;

  @Column({ type: 'datetime', nullable: true })
  submittedAt: Date;

  @Column({ nullable: true })
  reviewedBy: string;

  @Column({ type: 'datetime', nullable: true })
  reviewedAt: Date;

  @Column({ type: 'text', nullable: true })
  reviewComments: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ nullable: true })
  createdBy: string;

  @Column({ nullable: true })
  updatedBy: string;
}
