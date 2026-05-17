import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Package } from './Package';
import { Appeal } from './Appeal';

export enum OverchargeType {
  API_CALL = 'api_call',
  STORAGE = 'storage',
  BANDWIDTH = 'bandwidth',
  USER_SEAT = 'user_seat',
  OTHER = 'other'
}

@Entity()
export class OverchargeRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  recordCode: string;

  @Column({
    type: 'simple-enum',
    enum: OverchargeType
  })
  overchargeType: OverchargeType;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  overchargeAmount: number;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  unitPrice: number;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  quantity: number;

  @Column({ type: 'date' })
  occurrenceDate: Date;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ default: false })
  isDisputed: boolean;

  @Column()
  packageId: string;

  @ManyToOne(() => Package, pkg => pkg.overchargeRecords)
  @JoinColumn({ name: 'packageId' })
  package: Package;

  @Column({ nullable: true })
  appealId: string;

  @ManyToOne(() => Appeal, appeal => appeal.overchargeRecords)
  @JoinColumn({ name: 'appealId' })
  appeal: Appeal;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
