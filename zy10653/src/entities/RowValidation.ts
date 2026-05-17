import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { TranscodeTask } from './TranscodeTask';

export enum ValidationStatus {
  PENDING = 'pending',
  PASSED = 'passed',
  FAILED = 'failed',
  SKIPPED = 'skipped',
  FIXED = 'fixed',
}

export enum ValidationRule {
  REQUIRED = 'required',
  DATA_TYPE = 'data_type',
  FORMAT = 'format',
  RANGE = 'range',
  UNIQUENESS = 'uniqueness',
  REFERENCE = 'reference',
  CUSTOM = 'custom',
}

@Entity('row_validations')
export class RowValidation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  taskId: string;

  @Column({ type: 'int' })
  rowNumber: number;

  @Column({ nullable: true })
  sheetName?: string;

  @Column({ type: 'simple-json', nullable: true })
  rowData?: Record<string, any>;

  @Column({ type: 'simple-enum', enum: ValidationStatus })
  status: ValidationStatus;

  @Column({ type: 'simple-json', nullable: true })
  validationErrors?: ValidationError[];

  @Column({ type: 'simple-json', nullable: true })
  originalRowData?: Record<string, any>;

  @Column({ type: 'text', nullable: true })
  fixNote?: string;

  @Column({ nullable: true })
  fixedBy?: string;

  @Column({ type: 'datetime', nullable: true })
  fixedAt?: Date;

  @Column({ default: false })
  isBadRow: boolean;

  @Column({ default: false })
  isImported: boolean;

  @Column({ type: 'simple-json', nullable: true })
  importMetadata?: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'datetime', nullable: true })
  validatedAt?: Date;

  @ManyToOne(() => TranscodeTask, (task) => task.rowValidations)
  @JoinColumn({ name: 'taskId' })
  task: TranscodeTask;
}

export interface ValidationError {
  field: string;
  rule: ValidationRule;
  message: string;
  expected?: string;
  actual?: string;
  severity: 'error' | 'warning';
}
