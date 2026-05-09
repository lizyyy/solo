import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
} from 'typeorm';
import { RefundStatus } from '../../common/enums/refund-status.enum';
import { Refund } from './refund.entity';

@Entity('refund_histories')
export class RefundHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Refund, (refund) => refund.histories, { onDelete: 'CASCADE' })
  refund: Refund;

  @Column()
  refundId: string;

  @Column()
  version: number;

  @Column({
    type: 'enum',
    enum: RefundStatus,
  })
  status: RefundStatus;

  @Column('decimal', { precision: 12, scale: 2 })
  amount: number;

  @Column({ type: 'text', nullable: true })
  reason: string;

  @Column({ nullable: true, type: 'text' })
  remark: string;

  @Column()
  changedBy: string;

  @Column()
  changedByUsername: string;

  @Column({ nullable: true, type: 'json' })
  previousData: Record<string, any>;

  @Column({ nullable: true, type: 'json' })
  newData: Record<string, any>;

  @Column({ nullable: true })
  changeDescription: string;

  @CreateDateColumn()
  createdAt: Date;
}
