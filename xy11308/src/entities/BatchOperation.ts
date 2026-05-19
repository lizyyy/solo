import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum BatchOperationType {
  MEAL_ASSIGN = 'meal_assign',
  MEAL_CHANGE = 'meal_change',
  DELIVERY_UPDATE = 'delivery_update',
  FOLLOW_UP = 'follow_up'
}

export enum BatchOperationStatus {
  RUNNING = 'running',
  COMPLETED = 'completed',
  PARTIALLY_COMPLETED = 'partially_completed',
  FAILED = 'failed'
}

export interface SuccessItemResult {
  index: number;
  itemId?: string;
  data?: any;
}

export interface FailureItemResult {
  index: number;
  error: string;
  data?: any;
}

@Entity('batch_operations')
export class BatchOperation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'simple-enum', enum: BatchOperationType })
  type: BatchOperationType;

  @Column({ type: 'simple-enum', enum: BatchOperationStatus, default: BatchOperationStatus.RUNNING })
  status: BatchOperationStatus;

  @Column({ type: 'int' })
  totalItems: number;

  @Column({ type: 'int', default: 0 })
  successCount: number;

  @Column({ type: 'int', default: 0 })
  failureCount: number;

  @Column({ type: 'text', nullable: true })
  successItems: string;

  @Column({ type: 'text', nullable: true })
  failureItems: string;

  @Column({ type: 'text', nullable: true })
  errorSummary: string;

  @Column()
  operatedBy: string;

  @Column()
  operatedByRole: string;

  @CreateDateColumn()
  startedAt: Date;

  @UpdateDateColumn()
  completedAt: Date;

  setSuccessItems(items: SuccessItemResult[]) {
    this.successItems = JSON.stringify(items);
  }

  getSuccessItems(): SuccessItemResult[] {
    return this.successItems ? JSON.parse(this.successItems) : [];
  }

  setFailureItems(items: FailureItemResult[]) {
    this.failureItems = JSON.stringify(items);
  }

  getFailureItems(): FailureItemResult[] {
    return this.failureItems ? JSON.parse(this.failureItems) : [];
  }
}