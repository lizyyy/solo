import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn, JoinColumn } from 'typeorm';
import { FileStatus, ImageFormat } from './enums';
import { Track } from './Track';

@Entity()
export class CoverArt {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  trackId!: number;

  @ManyToOne(() => Track, (track) => track.coverArts)
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

  @Column({ type: 'int', nullable: true })
  width?: number;

  @Column({ type: 'int', nullable: true })
  height?: number;

  @Column({
    type: 'simple-enum',
    enum: ImageFormat,
    default: ImageFormat.JPG,
  })
  format!: ImageFormat;

  @Column({ type: 'int', nullable: true })
  dpi?: number;

  @Column({ type: 'text', nullable: true })
  colorProfile?: string;

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

  @Column({ type: 'boolean', default: false })
  hasExplicitContent!: boolean;

  @Column({ type: 'boolean', default: false })
  hasTextOverlay!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
