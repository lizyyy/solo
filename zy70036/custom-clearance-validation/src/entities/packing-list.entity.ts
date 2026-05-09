import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { ClearanceBatch } from './clearance-batch.entity';
import { DocumentStatus } from './invoice.entity';

@Entity('packing_lists')
export class PackingList {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => ClearanceBatch, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'batchId' })
  batch: ClearanceBatch;

  @Column()
  batchId: string;

  @Column({ unique: true })
  packingListNumber: string;

  @Column({ type: 'int', default: 1 })
  version: number;

  @Column({ type: 'date', nullable: true })
  packingDate: string;

  @Column({ nullable: true })
  shipperName: string;

  @Column({ nullable: true })
  consigneeName: string;

  @Column({ type: 'int', default: 0 })
  totalPackages: number;

  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  totalGrossWeight: number;

  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  totalNetWeight: number;

  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  totalVolume: number;

  @Column({ nullable: true })
  weightUnit: string;

  @Column({ nullable: true })
  volumeUnit: string;

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
    packages: number;
    grossWeight: number;
    netWeight: number;
    volume: number;
  }>;

  @Column({ type: 'text', nullable: true })
  remarks: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
