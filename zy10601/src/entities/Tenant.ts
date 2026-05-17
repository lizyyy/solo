import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { Package } from './Package';

export enum TenantStatus {
  NORMAL = 'normal',
  FROZEN = 'frozen',
  APPEALING = 'appealing',
  RESTORED = 'restored'
}

@Entity()
export class Tenant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  tenantCode: string;

  @Column()
  tenantName: string;

  @Column({ nullable: true })
  contactPerson: string;

  @Column({ nullable: true })
  contactPhone: string;

  @Column({ nullable: true })
  contactEmail: string;

  @Column({ nullable: true })
  industry: string;

  @Column({ nullable: true })
  region: string;

  @Column({
    type: 'simple-enum',
    enum: TenantStatus,
    default: TenantStatus.NORMAL
  })
  status: TenantStatus;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  totalOverchargeAmount: number;

  @Column({ type: 'text', nullable: true })
  remark: string;

  @Column({ nullable: true })
  responsiblePerson: string;

  @Column({ nullable: true })
  businessObject: string;

  @OneToMany(() => Package, pkg => pkg.tenant)
  packages: Package[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
