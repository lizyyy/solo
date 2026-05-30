import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn, JoinColumn, Index } from 'typeorm';
import { DeliveryStatus, EntityType } from './enums';
import { Track } from './Track';
import { PlatformSpec } from './PlatformSpec';
import { MasterFile } from './MasterFile';
import { CoverArt } from './CoverArt';

@Entity()
@Index(['trackId', 'platformSpecId'], { unique: true })
export class DeliveryReport {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  trackId!: number;

  @ManyToOne(() => Track, (track) => track.deliveryReports)
  @JoinColumn({ name: 'trackId' })
  track!: Track;

  @Column()
  platformSpecId!: number;

  @ManyToOne(() => PlatformSpec, (spec) => spec.deliveryReports)
  @JoinColumn({ name: 'platformSpecId' })
  platformSpec!: PlatformSpec;

  @Column({ nullable: true })
  masterFileId?: number;

  @ManyToOne(() => MasterFile)
  @JoinColumn({ name: 'masterFileId' })
  masterFile?: MasterFile;

  @Column({ nullable: true })
  coverArtId?: number;

  @ManyToOne(() => CoverArt)
  @JoinColumn({ name: 'coverArtId' })
  coverArt?: CoverArt;

  @Column({
    type: 'simple-enum',
    enum: DeliveryStatus,
    default: DeliveryStatus.PENDING,
  })
  status!: DeliveryStatus;

  @Column({ type: 'json', nullable: true })
  masterValidationErrors?: string[];

  @Column({ type: 'json', nullable: true })
  coverValidationErrors?: string[];

  @Column({ type: 'json', nullable: true })
  metadataValidationErrors?: string[];

  @Column({ type: 'text', nullable: true })
  rejectionReason?: string;

  @Column({ type: 'text', nullable: true })
  approvalNotes?: string;

  @Column({ nullable: true })
  approvedBy?: string;

  @Column({ type: 'datetime', nullable: true })
  approvedAt?: Date;

  @Column({ nullable: true })
  rejectedBy?: string;

  @Column({ type: 'datetime', nullable: true })
  rejectedAt?: Date;

  @Column({ nullable: true })
  deliveredBy?: string;

  @Column({ type: 'datetime', nullable: true })
  deliveredAt?: Date;

  @Column({ nullable: true })
  acknowledgedBy?: string;

  @Column({ type: 'datetime', nullable: true })
  acknowledgedAt?: Date;

  @Column({ nullable: true })
  deliveryBatchId?: string;

  @Column({ nullable: true })
  externalReferenceId?: string;

  @Column({ type: 'text', nullable: true })
  deliveryLog?: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  estimatedRevenue?: number;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  get entityType(): EntityType {
    return EntityType.DELIVERY_REPORT;
  }
}
