import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './BaseEntity';
import { PrintBatch } from './PrintBatch';

@Entity('lab_records')
export class LabRecord extends BaseEntity {
  @Column({ type: 'varchar', length: 100 })
  printBatchId!: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  L!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  a!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  b!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  standardL?: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  standardA?: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  standardB?: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  deltaE?: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 2.0 })
  tolerance!: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  measurePoint?: string;

  @Column({ type: 'int', default: 1 })
  measureOrder!: number;

  @Column({ type: 'boolean', default: true })
  isWithinTolerance!: boolean;

  @Column({ type: 'text', nullable: true })
  remark?: string;

  @ManyToOne(() => PrintBatch, printBatch => printBatch.labRecords, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'printBatchId' })
  printBatch!: PrintBatch;
}
