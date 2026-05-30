import { Entity, PrimaryGeneratedColumn, Column, OneToMany, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { TrackStatus } from './enums';
import { MasterFile } from './MasterFile';
import { CoverArt } from './CoverArt';
import { DeliveryReport } from './DeliveryReport';
import { Anomaly } from './Anomaly';

@Entity()
export class Track {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  title!: string;

  @Column()
  artist!: string;

  @Column({ nullable: true })
  album?: string;

  @Column({ type: 'float', nullable: true })
  duration?: number;

  @Column({ nullable: true })
  isrc?: string;

  @Column({ nullable: true })
  upc?: string;

  @Column({ type: 'text', nullable: true })
  lyrics?: string;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ nullable: true })
  genre?: string;

  @Column({ nullable: true })
  releaseDate?: Date;

  @Column({ nullable: true })
  territory?: string;

  @Column({
    type: 'simple-enum',
    enum: TrackStatus,
    default: TrackStatus.DRAFT,
  })
  status!: TrackStatus;

  @Column({ default: false })
  isExplicit!: boolean;

  @Column({ nullable: true })
  createdBy?: string;

  @Column({ nullable: true })
  approvedBy?: string;

  @Column({ type: 'datetime', nullable: true })
  approvedAt?: Date;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  paymentAmount?: number;

  @Column({ type: 'text', nullable: true })
  paymentTerms?: string;

  @Column({ nullable: true })
  contractId?: string;

  @Column({ nullable: true })
  rosterPriority?: number;

  @OneToMany(() => MasterFile, (masterFile) => masterFile.track, { cascade: true })
  masterFiles!: MasterFile[];

  @OneToMany(() => CoverArt, (coverArt) => coverArt.track, { cascade: true })
  coverArts!: CoverArt[];

  @OneToMany(() => DeliveryReport, (report) => report.track, { cascade: true })
  deliveryReports!: DeliveryReport[];

  @OneToMany(() => Anomaly, (anomaly) => anomaly.track, { cascade: true })
  anomalies!: Anomaly[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
