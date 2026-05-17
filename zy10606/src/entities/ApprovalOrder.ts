import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany
} from 'typeorm';
import { ApprovalStatus } from '../types/enums';
import { SignRecord } from './SignRecord';
import { RemindRecord } from './RemindRecord';
import { OperationHistory } from './OperationHistory';

@Entity()
export class ApprovalOrder {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true, comment: '审批单号' })
  orderNo!: string;

  @Column({ comment: '审批标题' })
  title!: string;

  @Column({ comment: '申请人ID' })
  applicantId!: string;

  @Column({ comment: '申请人姓名' })
  applicantName!: string;

  @Column({ comment: '申请部门' })
  applicantDept!: string;

  @Column({ type: 'text', nullable: true, comment: '审批内容' })
  content?: string;

  @Column({
    type: 'simple-enum',
    enum: ApprovalStatus,
    default: ApprovalStatus.PENDING,
    comment: '审批状态'
  })
  status!: ApprovalStatus;

  @Column({ type: 'datetime', comment: '申请时间' })
  applyTime!: Date;

  @Column({ type: 'datetime', nullable: true, comment: '当前节点超时时间' })
  timeoutTime?: Date;

  @Column({ type: 'datetime', nullable: true, comment: '办结时间' })
  completeTime?: Date;

  @Column({ type: 'text', nullable: true, comment: '当前处理人备注' })
  currentRemark?: string;

  @Column({ default: 0, comment: '催办次数' })
  remindCount!: number;

  @Column({ type: 'boolean', default: false, comment: '是否历史导入记录' })
  isImported!: boolean;

  @OneToMany(() => SignRecord, (sign) => sign.approvalOrder, { cascade: true })
  signRecords!: SignRecord[];

  @OneToMany(() => RemindRecord, (remind) => remind.approvalOrder, { cascade: true })
  remindRecords!: RemindRecord[];

  @OneToMany(() => OperationHistory, (history) => history.approvalOrder, { cascade: true })
  operationHistories!: OperationHistory[];

  @CreateDateColumn({ comment: '创建时间' })
  createdAt!: Date;

  @UpdateDateColumn({ comment: '更新时间' })
  updatedAt!: Date;
}
