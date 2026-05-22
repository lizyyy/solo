import { Entity, Column, OneToMany } from 'typeorm';
import { BaseEntity } from './BaseEntity';
import { Order } from './Order';
import { MaterialReceipt } from './MaterialReceipt';

@Entity('franchises')
export class Franchise extends BaseEntity {
  @Column({ type: 'varchar', length: 100, unique: true })
  code!: string;

  @Column({ type: 'varchar', length: 200 })
  name!: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  ownerName!: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone!: string;

  @Column({ type: 'text', nullable: true })
  address!: string;

  @OneToMany(() => Order, order => order.franchise)
  orders!: Order[];

  @OneToMany(() => MaterialReceipt, receipt => receipt.franchise)
  receipts!: MaterialReceipt[];
}
