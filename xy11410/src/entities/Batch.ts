import { Entity, Column, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { BaseEntity } from './BaseEntity';
import { MaterialReceipt } from './MaterialReceipt';

@Entity('batches')
export class Batch extends BaseEntity {
  @Column({ type: 'varchar', length: 100, unique: true })
  batchNo!: string;

  @Column({ type: 'date' })
  batchDate!: Date;

  @Column({ type: 'varchar', length: 200 })
  batchName!: string;

  @Column({ type: 'uuid', nullable: true })
  createdBy!: string;

  @Column({ type: 'text', nullable: true })
  description!: string;

  @Column({ type: 'int', default: 0 })
  totalRecords!: number;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  totalAmount!: number;

  @OneToMany(() => MaterialReceipt, receipt => receipt.batch)
  receipts!: MaterialReceipt[];
}
