import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Bin, BinStatus, BinType } from './bin.entity';

export enum BinEventType {
  FILL_LEVEL_UPDATE = '余量更新',
  FULL_ALERT = '满溢告警',
  OVERFLOW_ALERT = '溢漏告警',
  CLEARED = '已清运',
  MAINTENANCE_START = '开始维护',
  MAINTENANCE_END = '维护完成',
  MANUAL_CHECK = '人工巡检',
}

export enum EventLevel {
  INFO = '普通',
  WARNING = '警告',
  URGENT = '紧急',
  CRITICAL = '重大',
}

export enum EventStatus {
  PENDING = '待处理',
  PROCESSING = '处理中',
  RESOLVED = '已解决',
  ESCALATED = '已升级',
}

@Entity('bin_events')
export class BinEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ comment: '业务幂等键（防止重复上报）' })
  requestId!: string;

  @Index()
  @Column({ comment: '桶点ID' })
  binId!: string;

  @ManyToOne(() => Bin, { nullable: true })
  @JoinColumn({ name: 'binId' })
  bin!: Bin | null;

  @Column({ type: 'simple-enum', enum: BinEventType, comment: '事件类型' })
  eventType!: BinEventType;

  @Column({ type: 'simple-enum', enum: EventLevel, default: EventLevel.INFO, comment: '事件级别' })
  level!: EventLevel;

  @Column({ type: 'simple-enum', enum: EventStatus, default: EventStatus.PENDING, comment: '事件状态' })
  status!: EventStatus;

  @Column({ type: 'int', nullable: true, comment: '上报时的余量百分比' })
  fillLevel!: number | null;

  @Column({
    type: 'simple-enum',
    enum: BinStatus,
    nullable: true,
    comment: '上报时的桶点状态',
  })
  binStatusAtReport!: BinStatus | null;

  @Column({
    type: 'simple-enum',
    enum: BinType,
    nullable: true,
    comment: '上报时的垃圾桶类型（冗余便于统计）',
  })
  binTypeAtReport!: BinType | null;

  @Column({ type: 'varchar', nullable: true, comment: '上报来源：传感器/人工/系统' })
  source!: string | null;

  @Column({ type: 'varchar', nullable: true, comment: '事件描述' })
  description!: string | null;

  @Column({ type: 'int', default: 0, comment: '升级次数' })
  escalateCount!: number;

  @Column({ type: 'varchar', nullable: true, comment: '处理人' })
  handler!: string | null;

  @Column({ type: 'text', nullable: true, comment: '处理备注' })
  handleRemark!: string | null;

  @Column({ type: 'datetime', nullable: true, comment: '处理完成时间' })
  resolvedAt!: Date | null;

  @Column({ type: 'varchar', nullable: true, comment: '关联的调度单ID' })
  relatedDispatchId!: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
