import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export enum ClearanceBatchStatus {
  DRAFT = 'draft',
  SUBMITTED = 'submitted',
  VALIDATING = 'validating',
  PASSED = 'passed',
  BLOCKED = 'blocked',
  COMPLETED = 'completed',
}

@Entity('clearance_batches')
export class ClearanceBatch {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  batchNumber: string;

  @Column()
  shipmentNumber: string;

  @Column({ nullable: true })
  originCountry: string;

  @Column({ nullable: true })
  destinationCountry: string;

  @Column({
    type: 'enum',
    enum: ClearanceBatchStatus,
    default: ClearanceBatchStatus.DRAFT,
  })
  status: ClearanceBatchStatus;

  @Column({ type: 'text', nullable: true })
  remarks: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
