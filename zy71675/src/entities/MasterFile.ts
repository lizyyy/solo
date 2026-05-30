import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn, JoinColumn } from 'typeorm';
import { FileStatus, AudioFormat } from './enums';
import { Track } from './Track';

@Entity()
export class MasterFile {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  trackId!: number;

  @ManyToOne(() => Track, (track) => track.masterFiles)
  @JoinColumn({ name: 'trackId' })
  track!: Track;

  @Column()
  version!: number;

  @Column()
  fileName!: string;

  @Column()
  filePath!: string;

  @Column({ type: 'bigint', nullable: true })
  fileSize?: number;

  @Column({ type: 'float', nullable: true })
  duration?: number;

  @Column({ type: 'int', nullable: true })
  sampleRate?: number;

  @Column({ type: 'int', nullable: true })
  bitDepth?: number;

  @Column({ type: 'int', nullable: true })
  bitRate?: number;

  @Column({
    type: 'simple-enum',
    enum: AudioFormat,
    default: AudioFormat.WAV,
  })
  format!: AudioFormat;

  @Column({ type: 'int', nullable: true })
  channels?: number;

  @Column({ nullable: true })
  checksum?: string;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({
    type: 'simple-enum',
    enum: FileStatus,
    default: FileStatus.UPLOADED,
  })
  status!: FileStatus;

  @Column({ type: 'json', nullable: true })
  validationErrors?: string[];

  @Column({ nullable: true })
  uploadedBy?: string;

  @Column({ nullable: true })
  validatedBy?: string;

  @Column({ type: 'datetime', nullable: true })
  validatedAt?: Date;

  @Column({ type: 'boolean', default: false })
  isLatest!: boolean;

  @Column({ type: 'float', nullable: true })
  peakLevel?: number;

  @Column({ type: 'float', nullable: true })
  loudnessIntegrated?: number;

  @Column({ type: 'float', nullable: true })
  loudnessRange?: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
