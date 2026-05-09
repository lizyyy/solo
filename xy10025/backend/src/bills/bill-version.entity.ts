import { Entity, Column, ManyToOne } from 'typeorm';
import { BaseEntity } from '../common/base.entity';
import { Bill } from './bill.entity';

@Entity('bill_versions')
export class BillVersion extends BaseEntity {
  @Column({ type: 'uuid' })
  billId: string;

  @Column()
  versionNumber: number;

  @Column('jsonb')
  snapshot: any;

  @Column({ type: 'text', nullable: true })
  changeDescription: string;

  @ManyToOne(() => Bill, (bill) => bill.versions)
  bill: Bill;
}
