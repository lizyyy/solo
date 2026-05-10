import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { FlowAction, CertificateStatus } from '../../../common/types';
import { Certificate } from '../../certificate/entities/certificate.entity';

@Entity('flow_histories')
@Index(['certificateNumber'])
@Index(['action'])
@Index(['createdAt'])
export class FlowHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100, comment: '检疫证号' })
  certificateNumber: string;

  @Column({ type: 'uuid', comment: '检疫证ID' })
  certificateId: string;

  @Column({
    type: 'varchar',
    length: 50,
    enum: FlowAction,
    comment: '流转操作类型',
  })
  action: FlowAction;

  @Column({ type: 'varchar', length: 200, comment: '操作描述' })
  description: string;

  @Column({
    type: 'varchar',
    length: 50,
    nullable: true,
    enum: CertificateStatus,
    comment: '操作前状态',
  })
  previousStatus: CertificateStatus;

  @Column({
    type: 'varchar',
    length: 50,
    nullable: true,
    enum: CertificateStatus,
    comment: '操作后状态',
  })
  newStatus: CertificateStatus;

  @Column({ type: 'varchar', length: 100, comment: '操作人ID' })
  operatorId: string;

  @Column({ type: 'varchar', length: 100, comment: '操作人姓名' })
  operatorName: string;

  @Column({ type: 'varchar', length: 100, comment: '操作来源系统' })
  sourceSystem: string;

  @Column({ type: 'text', nullable: true, comment: '详细变更内容（JSON格式说明）' })
  changes: string;

  @Column({ type: 'text', nullable: true, comment: '原始数据快照（关键信息）' })
  snapshot: string;

  @Column({ type: 'varchar', length: 100, nullable: true, comment: '关联业务ID（如批次、运输、验收等）' })
  relatedEntityId: string;

  @Column({ type: 'varchar', length: 50, nullable: true, comment: '关联实体类型' })
  relatedEntityType: string;

  @Column({ type: 'boolean', default: false, comment: '是否为人工修正操作' })
  isManualCorrection: boolean;

  @Column({ type: 'text', nullable: true, comment: '人工修正说明' })
  correctionReason: string;

  @ManyToOne(() => Certificate, (cert) => cert.flowHistories)
  @JoinColumn({ name: 'certificateId' })
  certificate: Certificate;

  @CreateDateColumn({ comment: '操作时间' })
  createdAt: Date;
}
