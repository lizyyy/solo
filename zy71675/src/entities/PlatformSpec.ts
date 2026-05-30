import { Entity, PrimaryGeneratedColumn, Column, OneToMany, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Platform, AudioFormat, ImageFormat } from './enums';
import { DeliveryReport } from './DeliveryReport';

@Entity()
export class PlatformSpec {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({
    type: 'simple-enum',
    enum: Platform,
  })
  platform!: Platform;

  @Column()
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'simple-array', nullable: true })
  requiredAudioFormats?: AudioFormat[];

  @Column({ type: 'int', nullable: true })
  minSampleRate?: number;

  @Column({ type: 'int', nullable: true })
  maxSampleRate?: number;

  @Column({ type: 'int', nullable: true })
  minBitDepth?: number;

  @Column({ type: 'int', nullable: true })
  maxBitDepth?: number;

  @Column({ type: 'float', nullable: true })
  minDuration?: number;

  @Column({ type: 'float', nullable: true })
  maxDuration?: number;

  @Column({ type: 'float', nullable: true })
  targetLoudnessIntegrated?: number;

  @Column({ type: 'float', nullable: true })
  maxLoudnessIntegrated?: number;

  @Column({ type: 'float', nullable: true })
  maxPeakLevel?: number;

  @Column({ type: 'simple-array', nullable: true })
  requiredImageFormats?: ImageFormat[];

  @Column({ type: 'int', nullable: true })
  minCoverWidth?: number;

  @Column({ type: 'int', nullable: true })
  maxCoverWidth?: number;

  @Column({ type: 'int', nullable: true })
  minCoverHeight?: number;

  @Column({ type: 'int', nullable: true })
  maxCoverHeight?: number;

  @Column({ type: 'boolean', default: false })
  requireSquareCover!: boolean;

  @Column({ type: 'int', nullable: true })
  minCoverDpi?: number;

  @Column({ type: 'bigint', nullable: true })
  maxCoverFileSize?: number;

  @Column({ type: 'boolean', default: false })
  allowTextOnCover!: boolean;

  @Column({ type: 'boolean', default: false })
  requireIsrc!: boolean;

  @Column({ type: 'boolean', default: false })
  requireUpc!: boolean;

  @Column({ type: 'text', nullable: true })
  deliveryInstructions?: string;

  @Column({ type: 'datetime', nullable: true })
  deliveryDeadline?: Date;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  platformFee?: number;

  @Column({ type: 'text', nullable: true })
  metadataGuidelines?: string;

  @Column({ default: true })
  isActive!: boolean;

  @Column({ nullable: true })
  version?: string;

  @OneToMany(() => DeliveryReport, (report) => report.platformSpec)
  deliveryReports!: DeliveryReport[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
