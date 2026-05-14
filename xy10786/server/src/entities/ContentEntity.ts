import { Entity, PrimaryGeneratedColumn, Column, OneToMany, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { ContentStatus, ChannelType } from '../types';
import { ChannelSyncEntity } from './ChannelSyncEntity';
import { ReviewRecordEntity } from './ReviewRecordEntity';

@Entity('content')
export class ContentEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  title!: string;

  @Column('text')
  content!: string;

  @Column()
  author!: string;

  @Column({
    type: 'simple-enum',
    enum: ContentStatus,
    default: ContentStatus.DRAFT
  })
  status!: ContentStatus;

  @Column({ type: 'datetime', nullable: true })
  scheduledAt!: Date | null;

  @Column({ type: 'datetime', nullable: true })
  publishedAt!: Date | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @OneToMany(() => ChannelSyncEntity, channel => channel.content, { cascade: true })
  channels!: ChannelSyncEntity[];

  @OneToMany(() => ReviewRecordEntity, review => review.content, { cascade: true })
  reviewHistory!: ReviewRecordEntity[];

  @Column({ default: 1 })
  version!: number;

  @Column({ unique: true })
  idempotencyKey!: string;

  @Column({ default: 0 })
  retryCount!: number;

  @Column({ default: 3 })
  maxRetries!: number;
}
