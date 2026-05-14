import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn, JoinColumn } from 'typeorm';
import { ContentStatus, ChannelType } from '../types';
import { ContentEntity } from './ContentEntity';

@Entity('channel_sync')
export class ChannelSyncEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  contentId!: string;

  @ManyToOne(() => ContentEntity, content => content.channels)
  @JoinColumn({ name: 'contentId' })
  content!: ContentEntity;

  @Column({
    type: 'simple-enum',
    enum: ChannelType
  })
  channel!: ChannelType;

  @Column({
    type: 'simple-enum',
    enum: ContentStatus,
    default: ContentStatus.DRAFT
  })
  status!: ContentStatus;

  @Column({ type: 'datetime', nullable: true })
  syncedAt!: Date | null;

  @Column({ nullable: true })
  externalId!: string | null;

  @Column({ type: 'text', nullable: true })
  errorMessage!: string | null;

  @Column({ default: 0 })
  retryCount!: number;

  @Column({ default: 3 })
  maxRetries!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
