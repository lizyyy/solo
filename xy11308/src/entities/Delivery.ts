import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { MealAssignment } from './MealAssignment';

export enum DeliveryStatus {
  PENDING = 'pending',
  IN_TRANSIT = 'in_transit',
  DELIVERED = 'delivered',
  FAILED = 'failed',
  RETURNED = 'returned'
}

@Entity('deliveries')
export class Delivery {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  assignmentId: string;

  @Column({ type: 'simple-enum', enum: DeliveryStatus, default: DeliveryStatus.PENDING })
  status: DeliveryStatus;

  @Column({ nullable: true })
  deliveryPerson: string;

  @Column({ type: 'simple-array', nullable: true })
  deliveryRoute: string[];

  @Column({ nullable: true })
  estimatedDeliveryTime: Date;

  @Column({ nullable: true })
  actualDeliveryTime: Date;

  @Column({ nullable: true })
  recipientName: string;

  @Column({ nullable: true })
  recipientSignature: string;

  @Column({ nullable: true })
  failureReason: string;

  @Column({ nullable: true })
  notes: string;

  @Column()
  createdBy: string;

  @Column()
  createdByRole: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => MealAssignment)
  @JoinColumn({ name: 'assignmentId' })
  assignment: MealAssignment;
}