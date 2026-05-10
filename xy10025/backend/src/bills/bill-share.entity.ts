import { Entity, Column, ManyToOne } from 'typeorm';
import { BaseEntity } from '../common/base.entity';
import { Bill } from './bill.entity';

@Entity('bill_shares')
export class BillShare extends BaseEntity {
  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  percentage: number;

  @Column({ default: false })
  isSettled: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  settledAt: Date;

  @Column({ type: 'uuid' })
  billId: string;

  @ManyToOne(() => Bill, (bill) => bill.shares)
  bill: Bill;
}
