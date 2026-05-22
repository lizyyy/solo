import { Entity, Column } from 'typeorm';
import { BaseEntity } from './BaseEntity';

@Entity('failed_records')
export class FailedRecord extends BaseEntity {
  @Column({ type: 'varchar', length: 100 })
  sourceType!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  sourceNo!: string;

  @Column({ type: 'simple-json', nullable: true })
  originalData!: any;

  @Column({ type: 'text' })
  errorReason!: string;

  @Column({ type: 'varchar', length: 50 })
  errorCode!: string;

  @Column({ type: 'boolean', default: false })
  isResolved!: boolean;

  @Column({ type: 'text', nullable: true })
  resolveRemark!: string;

  @Column({ type: 'datetime', nullable: true })
  resolvedAt!: Date;
}
