import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { ClearanceBatch } from './clearance-batch.entity';

export enum DocumentStatus {
  DRAFT = 'draft',
  SUBMITTED = 'submitted',
  VERIFIED = 'verified',
  REJECTED = 'rejected',
}

@Entity('invoices')
export class Invoice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => ClearanceBatch, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'batchId' })
  batch: ClearanceBatch;

  @Column()
  batchId: string;

  @Column({ unique: true })
  invoiceNumber: string;

  @Column({ type: 'int', default: 1 })
  version: number;

  @Column({ type: 'date', nullable: true })
  invoiceDate: string;

  @Column({ nullable: true })
  shipperName: string;

  @Column({ nullable: true })
  consigneeName: string;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 })
  totalAmount: number;

  @Column({ nullable: true })
  currency: string;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 })
  totalQuantity: number;

  @Column({ type: 'int', default: 0 })
  itemCount: number;

  @Column({
    type: 'enum',
    enum: DocumentStatus,
    default: DocumentStatus.DRAFT,
  })
  status: DocumentStatus;

  @Column({ type: 'json', nullable: true })
  items: Array<{
    lineNumber: number;
    hsCode: string;
    productName: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    totalAmount: number;
  }>;

  @Column({ type: 'text', nullable: true })
  remarks: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
