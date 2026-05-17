import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { RetryHistory } from './RetryHistory';
import { RowValidation } from './RowValidation';

export enum TaskStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  FAILED = 'failed',
  RETRYING = 'retrying',
  COMPLETED = 'completed',
  CONFLICT = 'conflict',
  CANCELLED = 'cancelled',
}

export enum FailureCode {
  FILE_CORRUPTED = 'FILE_CORRUPTED',
  UNSUPPORTED_FORMAT = 'UNSUPPORTED_FORMAT',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  INVALID_ENCODING = 'INVALID_ENCODING',
  ROW_VALIDATION_FAILED = 'ROW_VALIDATION_FAILED',
  SOURCE_FILE_CHANGED = 'SOURCE_FILE_CHANGED',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

@Entity('transcode_tasks')
export class TranscodeTask {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  businessNo: string;

  @Column()
  fileName: string;

  @Column()
  fileHash: string;

  @Column({ type: 'bigint' })
  fileSize: number;

  @Column()
  sourceFormat: string;

  @Column()
  targetFormat: string;

  @Column({
    type: 'simple-enum',
    enum: TaskStatus,
    default: TaskStatus.PENDING,
  })
  @Index()
  status: TaskStatus;

  @Column({ type: 'simple-enum', enum: FailureCode, nullable: true })
  failureCode?: FailureCode;

  @Column({ type: 'text', nullable: true })
  failureMessage?: string;

  @Column({ type: 'simple-json', nullable: true })
  retryParams?: Record<string, any>;

  @Column({ type: 'int', default: 0 })
  retryCount: number;

  @Column({ type: 'int', default: 3 })
  maxRetryCount: number;

  @Column({ nullable: true })
  sourceFilePath?: string;

  @Column({ nullable: true })
  outputFilePath?: string;

  @Column({ type: 'simple-json', nullable: true })
  fileMetadata?: Record<string, any>;

  @Column({ default: false })
  isManuallyRetried: boolean;

  @Column({ nullable: true })
  lastRetriedBy?: string;

  @Column({ type: 'datetime', nullable: true })
  lastRetriedAt?: Date;

  @Column({ nullable: true })
  createdBy: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'text', nullable: true })
  conflictNote?: string;

  @Column({ nullable: true })
  resolvedBy?: string;

  @Column({ type: 'datetime', nullable: true })
  resolvedAt?: Date;

  @OneToMany(() => RetryHistory, (history) => history.task)
  retryHistories: RetryHistory[];

  @OneToMany(() => RowValidation, (validation) => validation.task)
  rowValidations: RowValidation[];
}
