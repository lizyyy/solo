import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { EntityType } from '../../../common/types';

@Entity('audit_logs')
@Index(['entityType', 'entityId'])
@Index(['action'])
@Index(['operatorId'])
@Index(['createdAt'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'varchar',
    length: 50,
    enum: EntityType,
    comment: '操作实体类型',
  })
  entityType: EntityType;

  @Column({ type: 'uuid', comment: '操作实体ID' })
  entityId: string;

  @Column({ type: 'varchar', length: 100, nullable: true, comment: '实体编号（如证号、批次号等）' })
  entityNumber: string;

  @Column({ type: 'varchar', length: 100, comment: '操作类型' })
  action: string;

  @Column({ type: 'varchar', length: 200, comment: '操作描述' })
  description: string;

  @Column({ type: 'varchar', length: 100, comment: '操作人ID' })
  operatorId: string;

  @Column({ type: 'varchar', length: 100, comment: '操作人姓名' })
  operatorName: string;

  @Column({ type: 'varchar', length: 100, comment: '操作人角色' })
  operatorRole: string;

  @Column({ type: 'varchar', length: 100, comment: '来源IP' })
  sourceIp: string;

  @Column({ type: 'varchar', length: 200, nullable: true, comment: '用户代理' })
  userAgent: string;

  @Column({ type: 'jsonb', nullable: true, comment: '变更前数据' })
  beforeData: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true, comment: '变更后数据' })
  afterData: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true, comment: '请求参数' })
  requestData: Record<string, any>;

  @Column({ type: 'text', nullable: true, comment: '备注' })
  remarks: string;

  @CreateDateColumn({ comment: '操作时间' })
  createdAt: Date;
}
