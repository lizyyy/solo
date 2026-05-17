import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn
} from 'typeorm';
import { OperationType } from '../types/enums';
import { ApprovalOrder } from './ApprovalOrder';

@Entity()
export class OperationHistory {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ comment: '审批单ID' })
  approvalOrderId!: string;

  @ManyToOne(() => ApprovalOrder, (order) => order.operationHistories)
  @JoinColumn({ name: 'approvalOrderId' })
  approvalOrder!: ApprovalOrder;

  @Column({
    type: 'simple-enum',
    enum: OperationType,
    comment: '操作类型'
  })
  operationType!: OperationType;

  @Column({ comment: '操作人ID' })
  operatorId!: string;

  @Column({ comment: '操作人姓名' })
  operatorName!: string;

  @Column({ type: 'text', nullable: true, comment: '操作详情/备注' })
  detail?: string;

  @Column({ type: 'simple-json', nullable: true, comment: '变更前后数据快照' })
  snapshot?: Record<string, any>;

  @CreateDateColumn({ comment: '操作时间' })
  operateTime!: Date;
}
