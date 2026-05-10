import 'reflect-metadata';
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity()
export class Assignment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  vulnerabilityId: string;

  @Column()
  assigneeId: string;

  @Column()
  assigneeName: string;

  @Column('text')
  assignmentNote: string;

  @Column({ type: 'datetime', nullable: true })
  acceptedAt: Date;

  @Column({ type: 'datetime', nullable: true })
  rejectedAt: Date;

  @Column('text', { nullable: true })
  rejectionReason: string;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
