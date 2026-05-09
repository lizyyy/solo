import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Vehicle, VehicleStatus } from './vehicle.entity';
import { Bin, BinType } from './bin.entity';

export enum DispatchStatus {
  PENDING = '待确认',
  CONFIRMED = '已确认',
  IN_PROGRESS = '执行中',
  COMPLETED = '已完成',
  CANCELLED = '已取消',
}

@Entity('dispatches')
export class Dispatch {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ comment: '调度单号（业务唯一）' })
  dispatchNo!: string;

  @Index({ unique: true })
  @Column({ comment: '幂等请求ID' })
  requestId!: string;

  @Index()
  @Column({ comment: '车辆ID' })
  vehicleId!: string;

  @ManyToOne(() => Vehicle, { nullable: true })
  @JoinColumn({ name: 'vehicleId' })
  vehicle!: Vehicle | null;

  @Column({ comment: '调度日期' })
  dispatchDate!: string;

  @Column({ type: 'simple-enum', enum: DispatchStatus, default: DispatchStatus.PENDING, comment: '调度单状态' })
  status!: DispatchStatus;

  @Column({ type: 'text', comment: '需要清运的桶点ID列表（JSON数组）' })
  binIdsJson!: string;

  @Column({ type: 'simple-enum', enum: BinType, nullable: true, comment: '本次清运的垃圾类型' })
  targetBinType!: BinType | null;

  @Column({ type: 'int', default: 0, comment: '预计清运桶数' })
  estimatedBinCount!: number;

  @Column({ type: 'int', default: 0, comment: '实际清运桶数' })
  actualBinCount!: number;

  @Column({ type: 'int', default: 0, comment: '预计总重量（千克）' })
  estimatedWeight!: number;

  @Column({ type: 'int', default: 0, comment: '实际总重量（千克）' })
  actualWeight!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0, comment: '清运费用（元）' })
  totalFee!: number;

  @Column({ type: 'varchar', nullable: true, comment: '调度人' })
  dispatcher!: string | null;

  @Column({ type: 'varchar', nullable: true, comment: '司机确认人' })
  driverConfirmedBy!: string | null;

  @Column({ type: 'datetime', nullable: true, comment: '司机确认时间' })
  driverConfirmedAt!: Date | null;

  @Column({ type: 'datetime', nullable: true, comment: '出发时间' })
  departAt!: Date | null;

  @Column({ type: 'datetime', nullable: true, comment: '完成时间' })
  completedAt!: Date | null;

  @Column({ type: 'text', nullable: true, comment: '调度备注' })
  remark!: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
