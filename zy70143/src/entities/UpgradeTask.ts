import 'reflect-metadata';
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum TaskStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  BLOCKED = 'BLOCKED'
}

@Entity()
export class UpgradeTask {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  vulnerabilityId: string;

  @Column()
  title: string;

  @Column('text')
  description: string;

  @Column()
  packageName: string;

  @Column()
  fromVersion: string;

  @Column()
  toVersion: string;

  @Column({
    type: 'text',
    enum: TaskStatus,
    default: TaskStatus.PENDING
  })
  status: TaskStatus;

  @Column({ nullable: true })
  assigneeId: string;

  @Column({ nullable: true })
  assigneeName: string;

  @Column({ type: 'datetime', nullable: true })
  completedAt: Date;

  @Column('text', { nullable: true })
  notes: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
