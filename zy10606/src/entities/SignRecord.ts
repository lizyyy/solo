import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn
} from 'typeorm';
import { SignStatus } from '../types/enums';
import { ApprovalOrder } from './ApprovalOrder';

@Entity()
export class SignRecord {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ comment: '审批单ID' })
  approvalOrderId!: string;

  @ManyToOne(() => ApprovalOrder, (order) => order.signRecords)
  @JoinColumn({ name: 'approvalOrderId' })
  approvalOrder!: ApprovalOrder;

  @Column({ comment: '加签人ID' })
  signerId!: string;

  @Column({ comment: '加签人姓名' })
  signerName!: string;

  @Column({ comment: '加签人部门' })
  signerDept!: string;

  @Column({ type: 'boolean', default: false, comment: '是否离职' })
  isResigned!: boolean;

  @Column({ comment: '加签顺序' })
  signOrder!: number;

  @Column({
    type: 'simple-enum',
    enum: SignStatus,
    default: SignStatus.PENDING,
    comment: '加签状态'
  })
  status!: SignStatus;

  @Column({ type: 'datetime', comment: '加签开始时间' })
  signStartTime!: Date;

  @Column({ type: 'datetime', nullable: true, comment: '加签完成时间' })
  signCompleteTime?: Date;

  @Column({ type: 'datetime', nullable: true, comment: '超时时间' })
  timeoutTime?: Date;

  @Column({ type: 'text', nullable: true, comment: '审批意见' })
  opinion?: string;

  @Column({ type: 'text', nullable: true, comment: '人工备注' })
  remark?: string;

  @Column({ nullable: true, comment: '转交人ID' })
  transferToId?: string;

  @Column({ nullable: true, comment: '转交人姓名' })
  transferToName?: string;

  @CreateDateColumn({ comment: '创建时间' })
  createdAt!: Date;

  @UpdateDateColumn({ comment: '更新时间' })
  updatedAt!: Date;
}
