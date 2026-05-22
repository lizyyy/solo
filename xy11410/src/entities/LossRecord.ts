import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './BaseEntity';
import { Franchise } from './Franchise';
import { Material } from './Material';

@Entity('loss_records')
export class LossRecord extends BaseEntity {
  @Column({ type: 'varchar', length: 100, unique: true })
  recordNo!: string;

  @Column({ type: 'uuid' })
  franchiseId!: string;

  @ManyToOne(() => Franchise)
  @JoinColumn({ name: 'franchiseId' })
  franchise!: Franchise;

  @Column({ type: 'uuid' })
  materialId!: string;

  @ManyToOne(() => Material)
  @JoinColumn({ name: 'materialId' })
  material!: Material;

  @Column({ type: 'date' })
  lossDate!: Date;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  quantity!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  unitPrice!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  lossAmount!: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  batchNo!: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  lossType!: string;

  @Column({ type: 'text', nullable: true })
  reason!: string;
}
