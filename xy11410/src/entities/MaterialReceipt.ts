import { Entity, Column, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { BaseEntity } from './BaseEntity';
import { Franchise } from './Franchise';
import { Order } from './Order';
import { Batch } from './Batch';
import { StatusTransition } from './StatusTransition';
import { Attachment } from './Attachment';
import { ReceiptStatus, RecordStatus } from '../constants/ReceiptStatus';

@Entity('material_receipts')
export class MaterialReceipt extends BaseEntity {
  @Column({ type: 'varchar', length: 100, unique: true })
  receiptNo!: string;

  @Column({ type: 'uuid', nullable: true })
  batchId!: string;

  @ManyToOne(() => Batch, batch => batch.receipts)
  @JoinColumn({ name: 'batchId' })
  batch!: Batch;

  @Column({ type: 'uuid' })
  franchiseId!: string;

  @ManyToOne(() => Franchise, franchise => franchise.receipts)
  @JoinColumn({ name: 'franchiseId' })
  franchise!: Franchise;

  @Column({ type: 'uuid', nullable: true })
  orderId!: string;

  @ManyToOne(() => Order, order => order.receipts)
  @JoinColumn({ name: 'orderId' })
  order!: Order;

  @Column({ type: 'varchar', length: 50 })
  sourceType!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  sourceNo!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  materialCode!: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  materialName!: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  quantity!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  reportedQuantity!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  unitPrice!: number;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  amount!: number;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  reportedAmount!: number;

  @Column({
    type: 'simple-enum',
    enum: ReceiptStatus,
    default: ReceiptStatus.DRAFT
  })
  status!: ReceiptStatus;

  @Column({
    type: 'simple-enum',
    enum: RecordStatus,
    default: RecordStatus.UNPROCESSED
  })
  recordStatus!: RecordStatus;

  @Column({ type: 'varchar', length: 100, nullable: true })
  abnormalType!: string;

  @Column({ type: 'text', nullable: true })
  abnormalReason!: string;

  @Column({ type: 'text', nullable: true })
  reviewReason!: string;

  @Column({ type: 'text', nullable: true })
  manualReason!: string;

  @Column({ type: 'simple-json', nullable: true })
  beforeFreezeData!: any;

  @Column({ type: 'simple-json', nullable: true })
  freezeReason!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  reviewedBy!: string;

  @Column({ type: 'datetime', nullable: true })
  reviewedAt!: Date;

  @Column({ type: 'varchar', length: 100, nullable: true })
  processedBy!: string;

  @Column({ type: 'datetime', nullable: true })
  processedAt!: Date;

  @Column({ type: 'text', nullable: true })
  remark!: string;

  @OneToMany(() => StatusTransition, transition => transition.receipt)
  statusTransitions!: StatusTransition[];

  @OneToMany(() => Attachment, attachment => attachment.receipt)
  attachments!: Attachment[];
}
