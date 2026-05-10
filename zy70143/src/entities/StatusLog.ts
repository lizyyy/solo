import 'reflect-metadata';
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';
import { VulnerabilityStatus } from '../types';

@Entity()
export class StatusLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  vulnerabilityId: string;

  @Column({
    type: 'text',
    enum: VulnerabilityStatus
  })
  fromStatus: VulnerabilityStatus;

  @Column({
    type: 'text',
    enum: VulnerabilityStatus
  })
  toStatus: VulnerabilityStatus;

  @Column()
  operatorId: string;

  @Column()
  operatorName: string;

  @Column('text')
  reason: string;

  @Column({ default: false })
  isManualOverride: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
