import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './BaseEntity';
import { Material } from './Material';

@Entity('headquarters_prices')
export class HeadquartersPrice extends BaseEntity {
  @Column({ type: 'uuid' })
  materialId!: string;

  @ManyToOne(() => Material, material => material.prices)
  @JoinColumn({ name: 'materialId' })
  material!: Material;

  @Column({ type: 'date' })
  effectiveDate!: Date;

  @Column({ type: 'date', nullable: true })
  expiryDate!: Date;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  unitPrice!: number;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;
}
