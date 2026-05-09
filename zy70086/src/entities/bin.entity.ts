import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export enum BinType {
  RECYCLABLE = '可回收物',
  HAZARDOUS = '有害垃圾',
  KITCHEN = '厨余垃圾',
  OTHER = '其他垃圾',
}

export enum BinStatus {
  NORMAL = '正常',
  NEAR_FULL = '接近满溢',
  FULL = '满溢',
  OVERFLOW = '溢漏',
  MAINTENANCE = '维护中',
}

@Entity('bins')
export class Bin {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ comment: '小区名称' })
  community!: string;

  @Column({ comment: '楼栋/区域' })
  location!: string;

  @Column({
    type: 'simple-enum',
    enum: BinType,
    comment: '垃圾桶类型',
  })
  binType!: BinType;

  @Column({ type: 'int', comment: '容量（升）' })
  capacity!: number;

  @Column({ type: 'int', default: 0, comment: '当前余量百分比 0-100' })
  fillLevel!: number;

  @Column({
    type: 'simple-enum',
    enum: BinStatus,
    default: BinStatus.NORMAL,
    comment: '桶点状态',
  })
  status!: BinStatus;

  @Column({ type: 'boolean', default: false, comment: '是否需要紧急处理' })
  isUrgent!: boolean;

  @Column({ type: 'int', default: 0, comment: '连续满溢次数' })
  consecutiveFullCount!: number;

  @Column({ type: 'datetime', nullable: true, comment: '最近一次满溢时间' })
  lastFullAt!: Date | null;

  @Column({ type: 'datetime', nullable: true, comment: '最近一次清运时间' })
  lastClearedAt!: Date | null;

  @Column({ type: 'varchar', nullable: true, comment: '备注' })
  remark!: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
