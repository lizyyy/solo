import { Column, CreateDateColumn, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { ClearanceBatch } from './clearance-batch.entity';

export enum ReportStatus {
  DRAFT = 'draft',
  GENERATING = 'generating',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum OverallStatus {
  PASSED = 'passed',
  WARNING = 'warning',
  BLOCKED = 'blocked',
}

@Entity('clearance_reports')
export class ClearanceReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => ClearanceBatch, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'batchId' })
  batch: ClearanceBatch;

  @Column()
  batchId: string;

  @Column({ unique: true })
  reportNumber: string;

  @Column({ type: 'int', default: 1 })
  version: number;

  @Column({
    type: 'enum',
    enum: ReportStatus,
    default: ReportStatus.DRAFT,
  })
  status: ReportStatus;

  @Column({
    type: 'enum',
    enum: OverallStatus,
    default: OverallStatus.WARNING,
  })
  overallStatus: OverallStatus;

  @Column({ type: 'json', nullable: true })
  versionSummary: {
    hsCodeVersions: number;
    invoiceVersions: number;
    packingListVersions: number;
    isVersionConsistent: boolean;
  };

  @Column({ type: 'json', nullable: true })
  hsCodeValidation: {
    totalItems: number;
    validCodes: number;
    invalidCodes: number;
    mismatchedCodes: number;
    pendingCodes: number;
    details: Array<{
      hsCode: string;
      productName: string;
      status: string;
      message: string;
    }>;
  };

  @Column({ type: 'json', nullable: true })
  packingListComparison: {
    isConsistent: boolean;
    invoiceVsPackingList: {
      quantityMatch: boolean;
      quantityDifference: number;
      itemCountMatch: boolean;
      mismatchedItems: Array<{
        hsCode: string;
        productName: string;
        invoiceQuantity: number;
        packingListQuantity: number;
        difference: number;
      }>;
    };
    weightSummary: {
      totalGrossWeight: number;
      totalNetWeight: number;
      unit: string;
    };
  };

  @Column({ type: 'json', nullable: true })
  missingComponents: {
    isBlocked: boolean;
    missingCount: number;
    criticalMissing: number;
    details: Array<{
      componentType: string;
      lineNumber: number;
      hsCode: string;
      productName: string;
      issue: string;
      priority: string;
    }>;
  };

  @Column({ type: 'json', nullable: true })
  complianceTasks: {
    totalTasks: number;
    pendingTasks: number;
    inProgressTasks: number;
    resolvedTasks: number;
    criticalTasks: number;
  };

  @Column({ type: 'text', nullable: true })
  recommendations: string;

  @Column({ type: 'timestamp', nullable: true })
  generatedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
