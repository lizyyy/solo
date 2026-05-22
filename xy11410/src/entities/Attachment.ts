import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './BaseEntity';
import { MaterialReceipt } from './MaterialReceipt';

@Entity('attachments')
export class Attachment extends BaseEntity {
  @Column({ type: 'uuid' })
  receiptId!: string;

  @ManyToOne(() => MaterialReceipt, receipt => receipt.attachments)
  @JoinColumn({ name: 'receiptId' })
  receipt!: MaterialReceipt;

  @Column({ type: 'varchar', length: 255 })
  fileName!: string;

  @Column({ type: 'varchar', length: 500 })
  filePath!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  fileType!: string;

  @Column({ type: 'bigint', nullable: true })
  fileSize!: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  uploadedBy!: string;

  @Column({ type: 'text', nullable: true })
  description!: string;
}
