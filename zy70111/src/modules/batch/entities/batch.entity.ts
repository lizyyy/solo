import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('batches')
@Index(['batchNumber'], { unique: true })
@Index(['status'])
@Index(['createdBy'])
export class Batch {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100, unique: true, comment: '批次号' })
  batchNumber: string;

  @Column({ type: 'varchar', length: 200, comment: '批次名称' })
  batchName: string;

  @Column({ type: 'varchar', length: 50, comment: '批次状态' })
  status: string;

  @Column({ type: 'int', default: 0, comment: '绑定的检疫证数量' })
  certificateCount: number;

  @Column({ type: 'int', default: 0, comment: '批次内动物总数' })
  totalAnimals: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0, comment: '批次总重量' })
  totalWeight: number;

  @Column({ type: 'varchar', length: 200, comment: '目的地' })
  destination: string;

  @Column({ type: 'date', comment: '计划运输日期' })
  scheduledTransportDate: Date;

  @Column({ type: 'varchar', length: 200, nullable: true, comment: '运输车辆牌号' })
  vehiclePlateNumber: string;

  @Column({ type: 'varchar', length: 100, nullable: true, comment: '驾驶员姓名' })
  driverName: string;

  @Column({ type: 'varchar', length: 50, nullable: true, comment: '驾驶员电话' })
  driverPhone: string;

  @Column({ type: 'boolean', default: false, comment: '是否包含重复证号' })
  hasDuplicateCertificates: boolean;

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
