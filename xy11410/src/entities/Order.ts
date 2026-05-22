import { Entity, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { BaseEntity } from './BaseEntity';
import { Franchise } from './Franchise';
import { OrderItem } from './OrderItem';
import { MaterialReceipt } from './MaterialReceipt';

@Entity('orders')
export class Order extends BaseEntity {
  @Column({ type: 'varchar', length: 100, unique: true })
  orderNo!: string;

  @Column({ type: 'uuid' })
  franchiseId!: string;

  @ManyToOne(() => Franchise, franchise => franchise.orders)
  @JoinColumn({ name: 'franchiseId' })
  franchise!: Franchise;

  @Column({ type: 'date' })
  orderDate!: Date;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  totalAmount!: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  status!: string;

  @Column({ type: 'text', nullable: true })
  remark!: string;

  @OneToMany(() => OrderItem, item => item.order)
  items!: OrderItem[];

  @OneToMany(() => MaterialReceipt, receipt => receipt.order)
  receipts!: MaterialReceipt[];
}
