import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Dispatch } from './dispatch.entity';
import { Bin, BinType } from './bin.entity';

export enum RoutePointStatus {
  PENDING = '待前往',
  ARRIVED = '已到达',
  COLLECTED = '已清运',
  SKIPPED = '已跳过',
}

@Entity('routes')
export class Route {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ comment: '调度单ID' })
  dispatchId!: string;

  @ManyToOne(() => Dispatch, { nullable: true })
  @JoinColumn({ name: 'dispatchId' })
  dispatch!: Dispatch | null;

  @Column({ type: 'int', comment: '路线点顺序号' })
  seqNo!: number;

  @Index()
  @Column({ comment: '桶点ID' })
  binId!: string;

  @ManyToOne(() => Bin, { nullable: true })
  @JoinColumn({ name: 'binId' })
  bin!: Bin | null;

  @Column({
    type: 'simple-enum',
    enum: BinType,
    nullable: true,
    comment: '桶点类型（冗余）',
  })
  binType!: BinType | null;

  @Column({ type: 'simple-enum', enum: RoutePointStatus, default: RoutePointStatus.PENDING, comment: '路线点状态' })
  status!: RoutePointStatus;

  @Column({ type: 'int', nullable: true, comment: '到达时桶点余量' })
  fillLevelAtArrive!: number | null;

  @Column({ type: 'int', nullable: true, comment: '清运重量（千克）' })
  collectedWeight!: number | null;

  @Column({ type: 'datetime', nullable: true, comment: '到达时间' })
  arrivedAt!: Date | null;

  @Column({ type: 'datetime', nullable: true, comment: '清运完成时间' })
  completedAt!: Date | null;

  @Column({ type: 'varchar', nullable: true, comment: '跳过原因' })
  skipReason!: string | null;

  @Column({ type: 'text', nullable: true, comment: '现场照片URL（逗号分隔）' })
  photoUrls!: string | null;

  @Column({ type: 'text', nullable: true, comment: '司机备注' })
  driverRemark!: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
