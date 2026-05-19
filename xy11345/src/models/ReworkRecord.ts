import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './BaseEntity';
import { PrintBatch } from './PrintBatch';

export enum ReworkType {
  COLOR_ADJUSTMENT = 'color_adjustment',
  REPRINT = 'reprint',
  MATERIAL_REPLACEMENT = 'material_replacement',
  OTHER = 'other'
}

@Entity('rework_records')
export class ReworkRecord extends BaseEntity {
  @Column({ type: 'varchar', length: 100 })
  printBatchId!: string;

  @Column({ type: 'varchar', length: 50 })
  reworkType!: ReworkType;

  @Column({ type: 'text' })
  reason!: string;

  @Column({ type: 'text', nullable: true })
  solution?: string;

  @Column({ type: 'int', default: 1 })
  reworkCount!: number;

  @Column({ type: 'int', nullable: true })
  reworkedQuantity?: number;

  @Column({ type: 'int', nullable: true })
  scrappedQuantity?: number;

  @Column({ type: 'datetime', nullable: true })
  startedAt?: Date;

  @Column({ type: 'datetime', nullable: true })
  completedAt?: Date;

  @Column({ type: 'varchar', length: 100, nullable: true })
  operator?: string;

  @Column({ type: 'text', nullable: true })
  remark?: string;

  @Column({ type: 'simple-json', nullable: true })
  beforeLabValues?: { L: number; a: number; b: number };

  @Column({ type: 'simple-json', nullable: true })
  afterLabValues?: { L: number; a: number; b: number };

  @ManyToOne(() => PrintBatch, printBatch => printBatch.reworkRecords, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'printBatchId' })
  printBatch!: PrintBatch;
}
