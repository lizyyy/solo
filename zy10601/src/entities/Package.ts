import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { Tenant } from './Tenant';
import { OverchargeRecord } from './OverchargeRecord';

export enum PackageType {
  BASIC = 'basic',
  STANDARD = 'standard',
  PROFESSIONAL = 'professional',
  ENTERPRISE = 'enterprise'
}

@Entity()
export class Package {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  packageName: string;

  @Column({
    type: 'simple-enum',
    enum: PackageType
  })
  packageType: PackageType;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  quotaAmount: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  usedAmount: number;

  @Column({ type: 'date' })
  effectiveDate: Date;

  @Column({ type: 'date' })
  expiryDate: Date;

  @Column({ default: true })
  isActive: boolean;

  @Column()
  tenantId: string;

  @ManyToOne(() => Tenant, tenant => tenant.packages)
  @JoinColumn({ name: 'tenantId' })
  tenant: Tenant;

  @OneToMany(() => OverchargeRecord, record => record.package)
  overchargeRecords: OverchargeRecord[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
