import 'reflect-metadata';
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { RiskLevel } from '../types';

export enum RiskStatus {
  OPEN = 'OPEN',
  MITIGATED = 'MITIGATED',
  ACCEPTED = 'ACCEPTED',
  CLOSED = 'CLOSED'
}

@Entity()
export class RiskItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  vulnerabilityId: string;

  @Column()
  title: string;

  @Column('text')
  description: string;

  @Column({
    type: 'text',
    enum: RiskLevel
  })
  level: RiskLevel;

  @Column({
    type: 'text',
    enum: RiskStatus,
    default: RiskStatus.OPEN
  })
  status: RiskStatus;

  @Column('text', { nullable: true })
  mitigationPlan: string;

  @Column({ nullable: true })
  ownerId: string;

  @Column({ nullable: true })
  ownerName: string;

  @Column({ type: 'datetime', nullable: true })
  dueDate: Date;

  @Column({ type: 'datetime', nullable: true })
  resolvedAt: Date;

  @Column('text', { nullable: true })
  resolutionNote: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
