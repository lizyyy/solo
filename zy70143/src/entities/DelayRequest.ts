import 'reflect-metadata';
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export enum DelayRequestStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED'
}

@Entity()
export class DelayRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  vulnerabilityId: string;

  @Column()
  requesterId: string;

  @Column()
  requesterName: string;

  @Column({ type: 'datetime' })
  originalDueDate: Date;

  @Column({ type: 'datetime' })
  newDueDate: Date;

  @Column('text')
  reason: string;

  @Column('text')
  riskMitigation: string;

  @Column({
    type: 'text',
    enum: DelayRequestStatus,
    default: DelayRequestStatus.PENDING
  })
  status: DelayRequestStatus;

  @Column({ nullable: true })
  approverId: string;

  @Column({ nullable: true })
  approverName: string;

  @Column({ type: 'datetime', nullable: true })
  approvedAt: Date;

  @Column('text', { nullable: true })
  approvalComment: string;

  @CreateDateColumn()
  createdAt: Date;
}
