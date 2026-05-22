import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './BaseEntity';
import { MaterialReceipt } from './MaterialReceipt';
import { ReceiptStatus, ActionType } from '../constants/ReceiptStatus';

@Entity('status_transitions')
export class StatusTransition extends BaseEntity {
  @Column({ type: 'uuid' })
  receiptId!: string;

  @ManyToOne(() => MaterialReceipt, receipt => receipt.statusTransitions)
  @JoinColumn({ name: 'receiptId' })
  receipt!: MaterialReceipt;

  @Column({ type: 'simple-enum', enum: ReceiptStatus, nullable: true })
  fromStatus!: ReceiptStatus;

  @Column({ type: 'simple-enum', enum: ReceiptStatus })
  toStatus!: ReceiptStatus;

  @Column({ type: 'simple-enum', enum: ActionType })
  actionType!: ActionType;

  @Column({ type: 'simple-json', nullable: true })
  beforeData!: any;

  @Column({ type: 'simple-json', nullable: true })
  afterData!: any;

  @Column({ type: 'simple-json', nullable: true })
  diffData!: any;

  @Column({ type: 'text', nullable: true })
  reason!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  operator!: string;

  @Column({ type: 'datetime' })
  operatedAt!: Date;
}
