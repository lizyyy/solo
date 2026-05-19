import { Entity, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { BaseEntity } from './BaseEntity';
import { BatchStatus } from '../types';
import { PaperBatch } from './PaperBatch';
import { LabRecord } from './LabRecord';
import { ReworkRecord } from './ReworkRecord';
import { QualityOrder } from './QualityOrder';

@Entity('print_batches')
export class PrintBatch extends BaseEntity {
  @Column({ type: 'varchar', length: 100, unique: true })
  batchNumber!: string;

  @Column({ type: 'varchar', length: 200 })
  productName!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  customerName?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  paperBatchId?: string;

  @Column({ type: 'int', nullable: true })
  quantity?: number;

  @Column({ type: 'date', nullable: true })
  productionDate?: Date;

  @Column({ type: 'varchar', length: 100, nullable: true })
  machineId?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  operator?: string;

  @Column({ type: 'varchar', length: 50, default: BatchStatus.IMPORTED })
  status!: BatchStatus;

  @Column({ type: 'text', nullable: true })
  judgmentRemark?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  judgedBy?: string;

  @Column({ type: 'datetime', nullable: true })
  judgedAt?: Date;

  @Column({ type: 'text', nullable: true })
  reviewRemark?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  reviewedBy?: string;

  @Column({ type: 'datetime', nullable: true })
  reviewedAt?: Date;

  @Column({ type: 'boolean', default: false })
  isPassed!: boolean;

  @Column({ type: 'boolean', default: false })
  hasRework!: boolean;

  @Column({ type: 'int', default: 0 })
  reworkCount!: number;

  @Column({ type: 'simple-json', nullable: true })
  standardLabValues?: { L: number; a: number; b: number; tolerance: number };

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  avgDeltaE?: number;

  @Column({ type: 'text', nullable: true })
  remark?: string;

  @Column({ type: 'varchar', length: 100, nullable: true, unique: true })
  importKey?: string;

  @ManyToOne(() => PaperBatch, paperBatch => paperBatch.printBatches, { nullable: true })
  @JoinColumn({ name: 'paperBatchId' })
  paperBatch?: PaperBatch;

  @OneToMany(() => LabRecord, labRecord => labRecord.printBatch)
  labRecords!: LabRecord[];

  @OneToMany(() => ReworkRecord, reworkRecord => reworkRecord.printBatch)
  reworkRecords!: ReworkRecord[];

  @OneToMany(() => QualityOrder, qualityOrder => qualityOrder.printBatch)
  qualityOrders!: QualityOrder[];
}
