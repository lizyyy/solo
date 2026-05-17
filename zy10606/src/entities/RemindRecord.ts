import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn
} from 'typeorm';
import { ApprovalOrder } from './ApprovalOrder';

@Entity()
export class RemindRecord {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ comment: '审批单ID' })
  approvalOrderId!: string;

  @ManyToOne(() => ApprovalOrder, (order) => order.remindRecords)
  @JoinColumn({ name: 'approvalOrderId' })
  approvalOrder!: ApprovalOrder;

  @Column({ comment: '催办人ID' })
  reminderId!: string;

  @Column({ comment: '催办人姓名' })
  reminderName!: string;

  @Column({ comment: '被催办人ID' })
  remindedId!: string;

  @Column({ comment: '被催办人姓名' })
  remindedName!: string;

  @Column({ type: 'text', nullable: true, comment: '催办内容' })
  content?: string;

  @Column({ type: 'text', nullable: true, comment: '催办方式' })
  remindChannel?: string;

  @CreateDateColumn({ comment: '催办时间' })
  remindTime!: Date;
}
