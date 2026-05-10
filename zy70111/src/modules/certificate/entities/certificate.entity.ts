import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { CertificateStatus, CertificateSource } from '../../../common/types';
import { CertificateDuplicate } from './certificate-duplicate.entity';
import { FlowHistory } from '../../history/entities/flow-history.entity';

@Entity('certificates')
@Index(['certificateNumber'], { unique: false })
@Index(['status'])
@Index(['source'])
@Index(['issuerId'])
export class Certificate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100, comment: '检疫证号' })
  certificateNumber: string;

  @Column({
    type: 'varchar',
    length: 50,
    enum: CertificateStatus,
    default: CertificateStatus.ISSUED,
    comment: '检疫证状态',
  })
  status: CertificateStatus;

  @Column({
    type: 'varchar',
    length: 50,
    enum: CertificateSource,
    comment: '证号来源',
  })
  source: CertificateSource;

  @Column({ type: 'varchar', length: 200, comment: '养殖场名称' })
  farmName: string;

  @Column({ type: 'varchar', length: 100, nullable: true, comment: '养殖场ID' })
  farmId: string;

  @Column({ type: 'varchar', length: 200, comment: '屠宰场名称' })
  slaughterhouseName: string;

  @Column({ type: 'varchar', length: 100, nullable: true, comment: '屠宰场ID' })
  slaughterhouseId: string;

  @Column({ type: 'varchar', length: 100, comment: '动物种类' })
  animalType: string;

  @Column({ type: 'int', comment: '动物数量' })
  animalQuantity: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true, comment: '总重量' })
  totalWeight: number;

  @Column({ type: 'date', comment: '出栏日期' })
  slaughterDate: Date;

  @Column({ type: 'date', comment: '检疫日期' })
  inspectionDate: Date;

  @Column({ type: 'varchar', length: 100, comment: '检疫人员姓名' })
  inspectorName: string;

  @Column({ type: 'varchar', length: 100, comment: '开证人ID' })
  issuerId: string;

  @Column({ type: 'varchar', length: 100, comment: '开证人姓名' })
  issuerName: string;

  @Column({ type: 'uuid', nullable: true, comment: '绑定的批次ID' })
  batchId: string;

  @Column({ type: 'varchar', length: 100, nullable: true, comment: '批次号' })
  batchNumber: string;

  @Column({ type: 'boolean', default: false, comment: '是否存在证号重复' })
  hasDuplicate: boolean;

  @Column({ type: 'boolean', default: false, comment: '是否被人工修正过' })
  hasManualCorrection: boolean;

  @Column({
    type: 'uuid',
    nullable: true,
    comment: '如果是重开证，指向原始证ID',
  })
  originalCertificateId: string;

  @Column({
    type: 'uuid',
    nullable: true,
    comment: '如果已作废重开，指向新证ID',
  })
  reissuedCertificateId: string;

  @Column({ type: 'text', nullable: true, comment: '备注' })
  remarks: string;

  @Column({
    type: 'jsonb',
    nullable: true,
    comment: '扩展字段，存储各来源系统的原始数据',
  })
  metadata: Record<string, any>;

  @OneToMany(() => CertificateDuplicate, (dup) => dup.certificate)
  duplicates: CertificateDuplicate[];

  @OneToMany(() => FlowHistory, (history) => history.certificate)
  flowHistories: FlowHistory[];

  @CreateDateColumn({ comment: '创建时间' })
  createdAt: Date;

  @UpdateDateColumn({ comment: '更新时间' })
  updatedAt: Date;

  @Column({ type: 'varchar', length: 100, nullable: true, comment: '最后操作人ID' })
  lastOperatorId: string;

  @Column({ type: 'varchar', length: 100, nullable: true, comment: '最后操作人姓名' })
  lastOperatorName: string;
}
