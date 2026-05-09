import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { BinType } from './bin.entity';

@Entity('daily_stats')
export class DailyStat {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ comment: '统计日期（格式：YYYY-MM-DD）' })
  statDate!: string;

  @Column({ type: 'int', default: 0, comment: '桶点总数量' })
  totalBinCount!: number;

  @Column({ type: 'int', default: 0, comment: '正常桶点数量' })
  normalBinCount!: number;

  @Column({ type: 'int', default: 0, comment: '满溢桶点数量' })
  fullBinCount!: number;

  @Column({ type: 'int', default: 0, comment: '溢漏桶点数量' })
  overflowBinCount!: number;

  @Column({ type: 'int', default: 0, comment: '今日上报满溢事件数' })
  todayFullEventCount!: number;

  @Column({ type: 'int', default: 0, comment: '今日已处理满溢事件数' })
  todayResolvedEventCount!: number;

  @Column({ type: 'int', default: 0, comment: '今日调度单数量' })
  todayDispatchCount!: number;

  @Column({ type: 'int', default: 0, comment: '今日已完成调度单数量' })
  todayCompletedDispatchCount!: number;

  @Column({ type: 'int', default: 0, comment: '今日清运桶数' })
  todayCollectedBinCount!: number;

  @Column({ type: 'int', default: 0, comment: '今日清运总重量（千克）' })
  todayCollectedWeight!: number;

  @Column({ type: 'int', default: 0, comment: '今日回执数量' })
  todayReceiptCount!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0, comment: '今日清运总费用（元）' })
  todayTotalFee!: number;

  @Column({
    type: 'simple-enum',
    enum: BinType,
    nullable: true,
    comment: '按类型统计（可为空表示汇总）',
  })
  binType!: BinType | null;

  @Column({ type: 'text', comment: '明细数据（JSON）' })
  detailsJson!: string;

  @Column({ type: 'int', default: 0, comment: '统计版本号，用于幂等更新' })
  version!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
