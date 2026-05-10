import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { ReviewStatus, ReviewPriority } from '../../../common/types';
import { Certificate } from './certificate.entity';

@Entity('certificate_duplicates')
@Index(['certificateNumber'])
@Index(['status'])
export class CertificateDuplicate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100, comment: '重复的证号' })
  certificateNumber: string;

  @Column({ type: 'uuid', comment: '检疫证ID（冲突方之一）' })
  certificateId: string;

  @Column({ type: 'uuid', comment: '冲突的另一个检疫证ID' })
  conflictingCertificateId: string;

  @Column({
    type: 'varchar',
    length: 50,
    enum: ReviewStatus,
    default: ReviewStatus.PENDING,
    comment: '处理状态',
  })
  status: ReviewStatus;

  @Column({
    type: 'varchar',
    length: 20,
    enum: ReviewPriority,
    default: ReviewPriority.HIGH,
    comment: '优先级',
  })
  priority: ReviewPriority;

  @Column({ type: 'text', comment: '检测到的冲突原因' })
  conflictReason: string;

  @Column({ type: 'jsonb', nullable: true, comment: '冲突详情对比' })
  conflictDetails: Record<string, any>;

  @Column({
    type: 'boolean',
    default: false,
    comment: '是否为首次检测到的记录',
  })
  isPrimary: boolean;

  @Column({ type: 'text', nullable: true, comment: '处理方案' })
  resolution: string;

  @Column({ type: 'varchar', length: 100, nullable: true, comment: '处理人ID' })
  resolvedBy: string;

  @Column({ type: 'varchar', length: 100, nullable: true, comment: '处理人姓名' })
  resolvedByName: string;

  @Column({ type: 'timestamp', nullable: true, comment: '处理时间' })
  resolvedAt: Date;

  @ManyToOne(() => Certificate, (cert) => cert.duplicates)
  @JoinColumn({ name: 'certificateId' })
  certificate: Certificate;

  @CreateDateColumn({ comment: '检测时间' })
  createdAt: Date;
}
