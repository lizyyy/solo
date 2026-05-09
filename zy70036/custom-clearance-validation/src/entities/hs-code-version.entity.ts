import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { ClearanceBatch } from './clearance-batch.entity';

export enum HsCodeSource {
  INVOICE = 'invoice',
  PACKING_LIST = 'packing_list',
  DECLARATION = 'declaration',
}

export enum HsCodeVerificationStatus {
  PENDING = 'pending',
  VALID = 'valid',
  INVALID = 'invalid',
  MISMATCH = 'mismatch',
}

@Entity('hs_code_versions')
export class HsCodeVersion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => ClearanceBatch, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'batchId' })
  batch: ClearanceBatch;

  @Column()
  batchId: string;

  @Column({ type: 'int' })
  version: number;

  @Column()
  hsCode: string;

  @Column({ nullable: true })
  description: string;

  @Column({ nullable: true })
  productName: string;

  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  quantity: number;

  @Column({ nullable: true })
  unit: string;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 })
  unitPrice: number;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 })
  totalAmount: number;

  @Column({ nullable: true })
  currency: string;

  @Column({
    type: 'enum',
    enum: HsCodeSource,
  })
  source: HsCodeSource;

  @Column({
    type: 'enum',
    enum: HsCodeVerificationStatus,
    default: HsCodeVerificationStatus.PENDING,
  })
  verificationStatus: HsCodeVerificationStatus;

  @Column({ type: 'text', nullable: true })
  verificationMessage: string;

  @Column({ default: false })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
