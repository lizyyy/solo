import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn, JoinColumn, Index } from 'typeorm';
import { AnomalyType, AnomalySeverity, AnomalyStatus, EntityType } from './enums';
import { Track } from './Track';

@Entity()
@Index(['trackId', 'type', 'relatedEntityType', 'relatedEntityId'], { unique: true })
export class Anomaly {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  trackId!: number;

  @ManyToOne(() => Track, (track) => track.anomalies)
  @JoinColumn({ name: 'trackId' })
  track!: Track;

  @Column({
    type: 'simple-enum',
    enum: AnomalyType,
  })
  type!: AnomalyType;

  @Column({
    type: 'simple-enum',
    enum: AnomalySeverity,
    default: AnomalySeverity.MEDIUM,
  })
  severity!: AnomalySeverity;

  @Column({ type: 'text' })
  description!: string;

  @Column({
    type: 'simple-enum',
    enum: EntityType,
    nullable: true,
  })
  relatedEntityType?: EntityType;

  @Column({ nullable: true })
  relatedEntityId?: number;

  @Column({
    type: 'simple-enum',
    enum: AnomalyStatus,
    default: AnomalyStatus.OPEN,
  })
  status!: AnomalyStatus;

  @Column({ type: 'text', nullable: true })
  impactOnMoney?: string;

  @Column({ type: 'text', nullable: true })
  impactOnTime?: string;

  @Column({ type: 'text', nullable: true })
  impactOnRoster?: string;

  @Column({ type: 'json', nullable: true })
  affectedFields?: string[];

  @Column({ type: 'json', nullable: true })
  suggestedActions?: string[];

  @Column({ type: 'text', nullable: true })
  resolutionNote?: string;

  @Column({ nullable: true })
  resolvedBy?: string;

  @Column({ type: 'datetime', nullable: true })
  resolvedAt?: Date;

  @Column({ type: 'text', nullable: true })
  context?: string;

  @Column({ default: 0 })
  occurrences!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
