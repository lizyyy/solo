import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './BaseEntity';
import { Franchise } from './Franchise';

@Entity('refund_records')
export class RefundRecord extends BaseEntity {
  @Column({ type: 'varchar', length: 100, unique: true })
  refundNo!: string;

  @Column({ type: 'uuid' })
  franchiseId!: string;

  @ManyToOne(() => Franchise)
  @JoinColumn({ name: 'franchiseId' })
  franchise!: Franchise;

  @Column({ type: 'date' })
  refundDate!: Date;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  refundAmount!: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  relatedOrderNo!: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  refundType!: string;

  @Column({ type: 'text', nullable: true })
  reason!: string;

  @Column({ type: 'varchar', length: 50, default: 'pending' })
  status!: string;
}
