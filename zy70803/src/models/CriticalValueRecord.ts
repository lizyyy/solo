import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { AuditLog } from './AuditLog';

export enum DataCategory {
  NORMAL = 'normal',
  PENDING_SUPPLEMENT = 'pending_supplement',
  BLOCKED = 'blocked'
}

export enum TaskStatus {
  PROCESSING = 'processing',
  FAILED = 'failed',
  MANUAL_CONFIRMED = 'manual_confirmed',
  EXPORTED = 'exported'
}

@Entity()
export class CriticalValueRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  patientId: string;

  @Column()
  patientName: string;

  @Column()
  department: string;

  @Column()
  ward: string;

  @Column()
  bedNo: string;

  @Column()
  testItem: string;

  @Column()
  testValue: string;

  @Column()
  referenceRange: string;

  @Column()
  testTime: Date;

  @Column({ nullable: true })
  reporter: string;

  @Column({ nullable: true })
  smsContent: string;

  @Column({ nullable: true })
  smsTime: Date;

  @Column({ nullable: true })
  phoneCallTime: Date;

  @Column({ nullable: true })
  phoneCallOperator: string;

  @Column({ nullable: true })
  doctorConfirmer: string;

  @Column({ nullable: true })
  doctorConfirmTime: Date;

  @Column({ nullable: true })
  finalProcessor: string;

  @Column({
    type: 'simple-enum',
    enum: DataCategory,
    default: DataCategory.NORMAL
  })
  category: DataCategory;

  @Column({
    type: 'simple-enum',
    enum: TaskStatus,
    default: TaskStatus.PROCESSING
  })
  status: TaskStatus;

  @Column({ type: 'text', nullable: true })
  categoryReason: string;

  @Column({ type: 'text', nullable: true })
  supplementRequirements: string;

  @Column({ type: 'text', nullable: true })
  blockReason: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => AuditLog, log => log.record)
  auditLogs: AuditLog[];
}
