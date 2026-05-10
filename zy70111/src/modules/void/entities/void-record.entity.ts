import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { VoidReason } from '../../../common/types';

@Entity('void_records')
@Index(['certificateNumber'])
@Index(['reason'])
@Index(['createdAt'])
export class VoidRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100, comment: '被作废的证号' })
  certificateNumber: string;

  @Column({ type: 'uuid', comment: '被作废的检疫证ID' })
  certificateId: string;

  @Column({
    type: 'varchar',
    length: 50,
    enum: VoidReason,
    comment: '作废原因',
  })
  reason: VoidReason;

  @Column({ type: 'text', comment: '作废详细说明' })
  reasonDetails: string;

  @Column({
    type: 'boolean',
    default: false,
    comment: '是否重新开具新证',
  })
  isReissued: boolean;

  @Column({ type: 'uuid', nullable: true, comment: '重新开具的新证ID' })
  reissuedCertificateId: string;

  @Column({ type: 'varchar', length: 100, nullable: true, comment: '新证号' })
  reissuedCertificateNumber: string;

  @Column({ type: 'varchar', length: 100, comment: '作废申请人ID' })
  requestedBy: string;

  @Column({ type: 'varchar', length: 100, comment: '作废申请人姓名' })
  requestedByName: string;

  @Column({ type: 'varchar', length: 100, nullable: true, comment: '审批人ID' })
  approvedBy: string;

  @Column({ type: 'varchar', length: 100, nullable: true, comment: '审批人姓名' })
  approvedByName: string;

  @Column({ type: 'timestamp', nullable: true, comment: '审批时间' })
  approvedAt: Date;

  @Column({ type: 'text', nullable: true, comment: '备注' })
  remarks: string;

  @Column({ type: 'jsonb', nullable: true, comment: '扩展字段' })
  metadata: Record<string, any>;

  @CreateDateColumn({ comment: '作废时间' })
  createdAt: Date;
}
