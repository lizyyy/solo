import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { ReviewStatus, ReviewPriority } from '../../../common/types';

@Entity('review_tasks')
@Index(['status'])
@Index(['priority'])
@Index(['certificateNumber'])
@Index(['createdAt'])
export class ReviewTask {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100, comment: '任务编号' })
  taskNumber: string;

  @Column({ type: 'varchar', length: 100, nullable: true, comment: '关联检疫证号' })
  certificateNumber: string;

  @Column({ type: 'uuid', nullable: true, comment: '关联检疫证ID' })
  certificateId: string;

  @Column({ type: 'varchar', length: 100, nullable: true, comment: '关联批次号' })
  batchNumber: string;

  @Column({ type: 'uuid', nullable: true, comment: '关联批次ID' })
  batchId: string;

  @Column({ type: 'varchar', length: 100, nullable: true, comment: '关联运输单号' })
  transportNumber: string;

  @Column({ type: 'uuid', nullable: true, comment: '关联运输ID' })
  transportId: string;

  @Column({
    type: 'varchar',
    length: 50,
    enum: ReviewStatus,
    default: ReviewStatus.PENDING,
    comment: '任务状态',
  })
  status: ReviewStatus;

  @Column({
    type: 'varchar',
    length: 20,
    enum: ReviewPriority,
    default: ReviewPriority.MEDIUM,
    comment: '优先级',
  })
  priority: ReviewPriority;

  @Column({ type: 'varchar', length: 200, comment: '复核原因代码' })
  reasonCode: string;

  @Column({ type: 'text', comment: '复核原因描述' })
  reasonDescription: string;

  @Column({ type: 'jsonb', nullable: true, comment: '相关数据上下文' })
  contextData: Record<string, any>;

  @Column({ type: 'text', nullable: true, comment: '复核结论' })
  conclusion: string;

  @Column({ type: 'jsonb', nullable: true, comment: '处理措施' })
  resolutionActions: Record<string, any>;

  @Column({ type: 'varchar', length: 100, nullable: true, comment: '处理人ID' })
  assigneeId: string;

  @Column({ type: 'varchar', length: 100, nullable: true, comment: '处理人姓名' })
  assigneeName: string;

  @Column({ type: 'timestamp', nullable: true, comment: '分配时间' })
  assignedAt: Date;

  @Column({ type: 'timestamp', nullable: true, comment: '处理时间' })
  resolvedAt: Date;

  @Column({ type: 'text', nullable: true, comment: '备注' })
  remarks: string;

  @Column({ type: 'varchar', length: 100, comment: '创建人ID' })
  createdBy: string;

  @Column({ type: 'varchar', length: 100, comment: '创建人姓名' })
  createdByName: string;

  @CreateDateColumn({ comment: '创建时间' })
  createdAt: Date;

  @UpdateDateColumn({ comment: '更新时间' })
  updatedAt: Date;
}
