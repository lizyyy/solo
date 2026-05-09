import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export enum JobStatus {
  PENDING = '待执行',
  RUNNING = '执行中',
  COMPLETED = '已完成',
  FAILED = '失败',
  RETRYING = '重试中',
  DEAD = '已死亡',
}

export enum JobType {
  EVENT_ESCALATE = '满溢事件升级',
  STATISTICS_AGGREGATE = '统计数据聚合',
  VEHICLE_RETURN_CHECK = '车辆返程检查',
  RECEIPT_REMINDER = '回执提醒',
  BIN_CLEAN_REMINDER = '桶点清运提醒',
}

@Entity('background_jobs')
export class BackgroundJob {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'simple-enum', enum: JobType, comment: '任务类型' })
  jobType!: JobType;

  @Column({ type: 'simple-enum', enum: JobStatus, default: JobStatus.PENDING, comment: '任务状态' })
  status!: JobStatus;

  @Column({ type: 'text', comment: '任务参数（JSON）' })
  payloadJson!: string;

  @Column({ type: 'int', default: 0, comment: '已尝试次数' })
  attemptCount!: number;

  @Column({ type: 'int', default: 3, comment: '最大尝试次数' })
  maxAttempts!: number;

  @Column({ type: 'int', default: 60, comment: '重试间隔（秒）' })
  retryIntervalSeconds!: number;

  @Column({ type: 'datetime', nullable: true, comment: '下次执行时间' })
  nextRunAt!: Date | null;

  @Column({ type: 'datetime', nullable: true, comment: '上次执行时间' })
  lastRunAt!: Date | null;

  @Column({ type: 'text', nullable: true, comment: '上次执行错误信息' })
  lastError!: string | null;

  @Column({ type: 'text', nullable: true, comment: '任务结果' })
  resultJson!: string | null;

  @Column({ type: 'varchar', nullable: true, comment: '关联业务类型' })
  relatedBizType!: string | null;

  @Column({ type: 'varchar', nullable: true, comment: '关联业务ID' })
  relatedBizId!: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
