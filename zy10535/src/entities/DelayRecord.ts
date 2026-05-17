import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { VisitSchedule } from './VisitSchedule';

export enum DelayReason {
  CUSTOMER_UNAVAILABLE = 'CUSTOMER_UNAVAILABLE',
  PERSON_UNAVAILABLE = 'PERSON_UNAVAILABLE',
  EMERGENCY = 'EMERGENCY',
  RESCHEDULED = 'RESCHEDULED',
  OTHER = 'OTHER'
}

@Entity()
export class DelayRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => VisitSchedule, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'visitScheduleId' })
  visitSchedule: VisitSchedule;

  @Column()
  visitScheduleId: string;

  @Column({
    type: 'simple-enum',
    enum: DelayReason,
    default: DelayReason.OTHER
  })
  reason: DelayReason;

  @Column({ type: 'text' })
  reasonDescription: string;

  @Column({ type: 'datetime' })
  originalScheduledTime: Date;

  @Column({ type: 'datetime', nullable: true })
  newScheduledTime: Date;

  @Column({ type: 'integer', nullable: true })
  delayMinutes: number;

  @Column({ nullable: true })
  requestedBy: string;

  @Column({ nullable: true })
  approvedBy: string;

  @Column({ default: false })
  isApproved: boolean;

  @Column({ nullable: true, type: 'datetime' })
  approvedAt: Date;

  @Column({ nullable: true, type: 'simple-json' })
  originalInput: any;

  @CreateDateColumn()
  createdAt: Date;
}
