import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { Customer } from './Customer';
import { PersonInCharge } from './PersonInCharge';
import { DelayRecord } from './DelayRecord';
import { VisitReport } from './VisitReport';

export enum VisitType {
  NEW_CUSTOMER = 'NEW_CUSTOMER',
  REGULAR_FOLLOWUP = 'REGULAR_FOLLOWUP',
  COMPLAINT_HANDLING = 'COMPLAINT_HANDLING',
  CONTRACT_RENEWAL = 'CONTRACT_RENEWAL',
  UPGRADE_SALES = 'UPGRADE_SALES',
  TRAINING = 'TRAINING',
  OTHER = 'OTHER'
}

export enum VisitStatus {
  DRAFT = 'DRAFT',
  SCHEDULED = 'SCHEDULED',
  CONFIRMED = 'CONFIRMED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  DELAYED = 'DELAYED',
  MISSED = 'MISSED',
  CANCELLED = 'CANCELLED'
}

export enum VisitChannel {
  PHONE = 'PHONE',
  VIDEO = 'VIDEO',
  ONSITE = 'ONSITE',
  ONLINE_MEETING = 'ONLINE_MEETING'
}

@Entity()
export class VisitSchedule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  scheduleNumber: string;

  @ManyToOne(() => Customer, { nullable: false })
  @JoinColumn({ name: 'customerId' })
  customer: Customer;

  @Column()
  customerId: string;

  @ManyToOne(() => PersonInCharge, { nullable: false })
  @JoinColumn({ name: 'personInChargeId' })
  personInCharge: PersonInCharge;

  @Column()
  personInChargeId: string;

  @Column({
    type: 'simple-enum',
    enum: VisitType,
    default: VisitType.REGULAR_FOLLOWUP
  })
  visitType: VisitType;

  @Column({
    type: 'simple-enum',
    enum: VisitStatus,
    default: VisitStatus.DRAFT
  })
  status: VisitStatus;

  @Column({
    type: 'simple-enum',
    enum: VisitChannel,
    default: VisitChannel.PHONE
  })
  visitChannel: VisitChannel;

  @Column({ type: 'datetime' })
  scheduledStartTime: Date;

  @Column({ type: 'datetime' })
  scheduledEndTime: Date;

  @Column({ type: 'integer', default: 30 })
  durationMinutes: number;

  @Column({ nullable: true })
  subject: string;

  @Column({ nullable: true, type: 'text' })
  description: string;

  @Column({ nullable: true, type: 'datetime' })
  actualStartTime: Date;

  @Column({ nullable: true, type: 'datetime' })
  actualEndTime: Date;

  @Column({ default: false })
  isConfirmedByPerson: boolean;

  @Column({ nullable: true, type: 'datetime' })
  confirmedAt: Date;

  @OneToMany(() => DelayRecord, delay => delay.visitSchedule)
  delayRecords: DelayRecord[];

  @OneToMany(() => VisitReport, report => report.visitSchedule)
  reports: VisitReport[];

  @Column({ nullable: true, type: 'text' })
  cancelReason: string;

  @Column({ nullable: true, type: 'datetime' })
  cancelledAt: Date;

  @Column({ nullable: true })
  cancelledBy: string;

  @Column({ nullable: true, type: 'simple-json' })
  originalInput: any;

  @Column({ nullable: true, type: 'text' })
  lastProcessingBasis: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ nullable: true })
  createdBy: string;

  @Column({ nullable: true })
  updatedBy: string;
}
