import { Entity, Column, OneToMany } from 'typeorm';
import { BaseEntity } from './BaseEntity';
import { PrintBatch } from './PrintBatch';

@Entity('paper_batches')
export class PaperBatch extends BaseEntity {
  @Column({ type: 'varchar', length: 100, unique: true })
  batchNumber!: string;

  @Column({ type: 'varchar', length: 200 })
  paperType!: string;

  @Column({ type: 'varchar', length: 100 })
  supplier!: string;

  @Column({ type: 'date' })
  productionDate!: Date;

  @Column({ type: 'int', nullable: true })
  totalQuantity?: number;

  @Column({ type: 'text', nullable: true })
  remark?: string;

  @Column({ type: 'simple-json', nullable: true })
  properties?: Record<string, any>;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @OneToMany(() => PrintBatch, printBatch => printBatch.paperBatch)
  printBatches!: PrintBatch[];
}
