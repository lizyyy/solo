import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { TransportStatus } from '../../../common/types';

@Entity('transport_records')
@Index(['batchId'])
@Index(['status'])
@Index(['vehiclePlateNumber'])
export class TransportRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100, unique: true, comment: '运输单号' })
  transportNumber: string;

  @Column({ type: 'uuid', comment: '批次ID' })
  batchId: string;

  @Column({ type: 'varchar', length: 100, comment: '批次号' })
  batchNumber: string;

  @Column({
    type: 'varchar',
    length: 50,
    enum: TransportStatus,
    default: TransportStatus.PENDING,
    comment: '运输状态',
  })
  status: TransportStatus;

  @Column({ type: 'varchar', length: 200, comment: '出发地' })
  origin: string;

  @Column({ type: 'varchar', length: 200, comment: '目的地' })
  destination: string;

  @Column({ type: 'varchar', length: 200, nullable: true, comment: '途经地点' })
  route: string;

  @Column({ type: 'varchar', length: 200, comment: '运输车辆牌号' })
  vehiclePlateNumber: string;

  @Column({ type: 'varchar', length: 100, comment: '驾驶员姓名' })
  driverName: string;

  @Column({ type: 'varchar', length: 50, comment: '驾驶员电话' })
  driverPhone: string;

  @Column({ type: 'timestamp', comment: '发车时间' })
  departureTime: Date;

  @Column({ type: 'timestamp', nullable: true, comment: '预计到达时间' })
  estimatedArrivalTime: Date;

  @Column({ type: 'timestamp', nullable: true, comment: '实际到达时间' })
  actualArrivalTime: Date;

  @Column({ type: 'timestamp', nullable: true, comment: '核销时间' })
  verifiedAt: Date;

  @Column({ type: 'varchar', length: 100, nullable: true, comment: '核销人ID' })
  verifiedBy: string;

  @Column({ type: 'varchar', length: 100, nullable: true, comment: '核销人姓名' })
  verifiedByName: string;

  @Column({ type: 'text', nullable: true, comment: '核销备注' })
  verificationRemarks: string;

  @Column({ type: 'boolean', default: false, comment: '运输中是否发现异常' })
  hasAnomaly: boolean;

  @Column({ type: 'text', nullable: true, comment: '异常描述' })
  anomalyDescription: string;

  @Column({ type: 'text', nullable: true, comment: '备注' })
  remarks: string;

  @Column({ type: 'jsonb', nullable: true, comment: '扩展字段' })
  metadata: Record<string, any>;

  @Column({ type: 'varchar', length: 100, comment: '创建人ID' })
  createdBy: string;

  @Column({ type: 'varchar', length: 100, comment: '创建人姓名' })
  createdByName: string;

  @CreateDateColumn({ comment: '创建时间' })
  createdAt: Date;

  @UpdateDateColumn({ comment: '更新时间' })
  updatedAt: Date;
}
