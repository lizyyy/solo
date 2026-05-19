import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './BaseEntity';
import { PrintBatch } from './PrintBatch';

export enum OrderStatus {
  DRAFT = 'draft',
  ISSUED = 'issued',
  CONFIRMED = 'confirmed',
  CLOSED = 'closed'
}

@Entity('quality_orders')
export class QualityOrder extends BaseEntity {
  @Column({ type: 'varchar', length: 100 })
  printBatchId!: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  orderNumber!: string;

  @Column({ type: 'varchar', length: 50, default: OrderStatus.DRAFT })
  status!: OrderStatus;

  @Column({ type: 'date', nullable: true })
  orderDate?: Date;

  @Column({ type: 'varchar', length: 100, nullable: true })
  inspector?: string;

  @Column({ type: 'int', nullable: true })
  sampleCount?: number;

  @Column({ type: 'int', nullable: true })
  passCount?: number;

  @Column({ type: 'int', nullable: true })
  failCount?: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  passRate?: number;

  @Column({ type: 'text', nullable: true })
  inspectionItems?: string;

  @Column({ type: 'text', nullable: true })
  defectDescription?: string;

  @Column({ type: 'text', nullable: true })
  conclusion?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  approvedBy?: string;

  @Column({ type: 'datetime', nullable: true })
  approvedAt?: Date;

  @Column({ type: 'text', nullable: true })
  remark?: string;

  @Column({ type: 'simple-json', nullable: true })
  attachments?: string[];

  @ManyToOne(() => PrintBatch, printBatch => printBatch.qualityOrders, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'printBatchId' })
  printBatch!: PrintBatch;
}
