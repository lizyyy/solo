import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { TranscodeTask, TaskStatus, FailureCode } from './TranscodeTask';

export enum RetryType {
  AUTO = 'auto',
  MANUAL = 'manual',
  CALLBACK = 'callback',
  BATCH = 'batch',
}

export enum RetryTrigger {
  USER_CLICK = 'user_click',
  API_CALL = 'api_call',
  SCHEDULED_JOB = 'scheduled_job',
  CONFLICT_RESOLUTION = 'conflict_resolution',
}

@Entity('retry_histories')
export class RetryHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  taskId: string;

  @Column({ type: 'simple-enum', enum: RetryType })
  retryType: RetryType;

  @Column({ type: 'simple-enum', enum: RetryTrigger })
  retryTrigger: RetryTrigger;

  @Column({ type: 'simple-enum', enum: TaskStatus })
  statusBefore: TaskStatus;

  @Column({ type: 'simple-enum', enum: TaskStatus })
  statusAfter: TaskStatus;

  @Column({ type: 'simple-json', nullable: true })
  retryParams?: Record<string, any>;

  @Column({ nullable: true })
  fileHashBefore?: string;

  @Column({ nullable: true })
  fileHashAfter?: string;

  @Column({ default: false })
  isHashChanged: boolean;

  @Column({ type: 'simple-enum', enum: FailureCode, nullable: true })
  previousFailureCode?: FailureCode;

  @Column({ type: 'text', nullable: true })
  previousFailureMessage?: string;

  @Column({ nullable: true })
  retriedBy?: string;

  @Column({ type: 'text', nullable: true })
  retryNote?: string;

  @Column({ default: false })
  isDuplicateRequest: boolean;

  @Column({ default: false })
  isCallbackOverride: boolean;

  @Column({ nullable: true })
  requestId?: string;

  @Column({ type: 'simple-json', nullable: true })
  requestContext?: Record<string, any>;

  @Column({ type: 'simple-enum', enum: TaskStatus, nullable: true })
  finalStatus?: TaskStatus;

  @Column({ type: 'simple-enum', enum: FailureCode, nullable: true })
  finalFailureCode?: FailureCode;

  @Column({ type: 'text', nullable: true })
  finalFailureMessage?: string;

  @Column({ type: 'int', default: 0 })
  retryAttemptNumber: number;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'datetime', nullable: true })
  completedAt?: Date;

  @Column({ type: 'text', nullable: true })
  resolutionNote?: string;

  @Column({ default: false })
  sourceFileReplaced: boolean;

  @Column({ nullable: true })
  newTaskId?: string;

  @ManyToOne(() => TranscodeTask, (task) => task.retryHistories)
  @JoinColumn({ name: 'taskId' })
  task: TranscodeTask;
}
