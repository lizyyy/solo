import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { ClearanceBatch } from './clearance-batch.entity';

export enum TaskPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum TaskStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  RESOLVED = 'resolved',
  CANCELLED = 'cancelled',
}

export enum MissingComponentType {
  HS_CODE = 'hs_code',
  INVOICE = 'invoice',
  PACKING_LIST = 'packing_list',
  PRODUCT_INFO = 'product_info',
  WEIGHT = 'weight',
  QUANTITY = 'quantity',
  VALUE = 'value',
  OTHER = 'other',
}

@Entity('compliance_tasks')
export class ComplianceTask {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => ClearanceBatch, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'batchId' })
  batch: ClearanceBatch;

  @Column()
  batchId: string;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({
    type: 'enum',
    enum: MissingComponentType,
  })
  componentType: MissingComponentType;

  @Column({
    type: 'enum',
    enum: TaskPriority,
    default: TaskPriority.MEDIUM,
  })
  priority: TaskPriority;

  @Column({
    type: 'enum',
    enum: TaskStatus,
    default: TaskStatus.PENDING,
  })
  status: TaskStatus;

  @Column({ nullable: true })
  assignee: string;

  @Column({ type: 'timestamp', nullable: true })
  dueDate: Date;

  @Column({ type: 'timestamp', nullable: true })
  resolvedAt: Date;

  @Column({ type: 'text', nullable: true })
  resolutionNotes: string;

  @Column({ type: 'json', nullable: true })
  affectedItems: Array<{
    lineNumber: number;
    hsCode: string;
    productName: string;
    issue: string;
  }>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
