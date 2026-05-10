import 'reflect-metadata';
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { BatchStatus } from '../types';

@Entity()
export class Batch {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ unique: true })
  code: string;

  @Column('text')
  description: string;

  @Column({
    type: 'text',
    enum: BatchStatus,
    default: BatchStatus.PLANNED
  })
  status: BatchStatus;

  @Column({ type: 'datetime' })
  plannedDate: Date;

  @Column({ type: 'datetime', nullable: true })
  deployedAt: Date;

  @Column({ nullable: true })
  ownerId: string;

  @Column({ nullable: true })
  ownerName: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
