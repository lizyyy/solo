import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, JoinColumn } from 'typeorm';
import { ReviewAction } from '../types';
import { ContentEntity } from './ContentEntity';

@Entity('review_record')
export class ReviewRecordEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  contentId!: string;

  @ManyToOne(() => ContentEntity, content => content.reviewHistory)
  @JoinColumn({ name: 'contentId' })
  content!: ContentEntity;

  @Column({
    type: 'simple-enum',
    enum: ReviewAction
  })
  action!: ReviewAction;

  @Column()
  reviewer!: string;

  @Column('text')
  reason!: string;

  @Column('text', { nullable: true })
  remark!: string;

  @CreateDateColumn()
  createdAt!: Date;
}
