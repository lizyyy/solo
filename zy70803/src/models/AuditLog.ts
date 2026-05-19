import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { CriticalValueRecord } from './CriticalValueRecord';

@Entity()
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  recordId: string;

  @ManyToOne(() => CriticalValueRecord, record => record.auditLogs)
  @JoinColumn({ name: 'recordId' })
  record: CriticalValueRecord;

  @Column()
  operator: string;

  @Column()
  fieldName: string;

  @Column({ type: 'text', nullable: true })
  oldValue: string;

  @Column({ type: 'text', nullable: true })
  newValue: string;

  @Column({ type: 'text' })
  changeReason: string;

  @CreateDateColumn()
  changeTime: Date;
}
