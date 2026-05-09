import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Dispatch } from './dispatch.entity';
import { Vehicle } from './vehicle.entity';
import { BinType } from './bin.entity';

export enum ReceiptStatus {
  DRAFT = '草稿',
  SUBMITTED = '已提交',
  VERIFIED = '已核实',
  REJECTED = '已驳回',
  SETTLED = '已结算',
}

@Entity('receipts')
export class Receipt {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ comment: '回执单号（业务唯一）' })
  receiptNo!: string;

  @Index({ unique: true })
  @Column({ comment: '幂等请求ID' })
  requestId!: string;

  @Index()
  @Column({ comment: '关联调度单ID' })
  dispatchId!: string;

  @ManyToOne(() => Dispatch, { nullable: true })
  @JoinColumn({ name: 'dispatchId' })
  dispatch!: Dispatch | null;

  @Index()
  @Column({ comment: '车辆ID' })
  vehicleId!: string;

  @ManyToOne(() => Vehicle, { nullable: true })
  @JoinColumn({ name: 'vehicleId' })
  vehicle!: Vehicle | null;

  @Column({
    type: 'simple-enum',
    enum: BinType,
    nullable: true,
    comment: '清运垃圾类型',
  })
  binType!: BinType | null;

  @Column({
    type: 'simple-enum',
    enum: ReceiptStatus,
    default: ReceiptStatus.DRAFT,
    comment: '回执状态',
  })
  status!: ReceiptStatus;

  @Column({ type: 'int', default: 0, comment: '清运桶数' })
  collectedBinCount!: number;

  @Column({ type: 'int', default: 0, comment: '过磅毛重（千克）' })
  grossWeight!: number;

  @Column({ type: 'int', default: 0, comment: '过磅皮重（千克）' })
  tareWeight!: number;

  @Column({ type: 'int', default: 0, comment: '净重量（千克）= 毛重 - 皮重' })
  netWeight!: number;

  @Column({ type: 'varchar', nullable: true, comment: '过磅地点' })
  weighbridgeLocation!: string | null;

  @Column({ type: 'datetime', nullable: true, comment: '过磅时间' })
  weighedAt!: Date | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0, comment: '清运单价（元/千克）' })
  unitPrice!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0, comment: '清运费用（元）= 净重 * 单价' })
  totalFee!: number;

  @Column({ type: 'text', nullable: true, comment: '过磅单照片URL' })
  weighbridgePhotoUrl!: string | null;

  @Column({ type: 'text', nullable: true, comment: '清运现场照片URL（逗号分隔）' })
  sitePhotoUrls!: string | null;

  @Column({ type: 'varchar', nullable: true, comment: '提交人' })
  submitter!: string | null;

  @Column({ type: 'datetime', nullable: true, comment: '提交时间' })
  submittedAt!: Date | null;

  @Column({ type: 'varchar', nullable: true, comment: '核实人' })
  verifier!: string | null;

  @Column({ type: 'text', nullable: true, comment: '核实备注' })
  verifyRemark!: string | null;

  @Column({ type: 'datetime', nullable: true, comment: '核实时间' })
  verifiedAt!: Date | null;

  @Column({ type: 'varchar', nullable: true, comment: '结算人' })
  settler!: string | null;

  @Column({ type: 'datetime', nullable: true, comment: '结算时间' })
  settledAt!: Date | null;

  @Column({ type: 'text', nullable: true, comment: '备注' })
  remark!: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
