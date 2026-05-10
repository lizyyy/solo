import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { MarketInspectionResult } from '../../../common/types';

@Entity('market_inspections')
@Index(['certificateNumber'])
@Index(['result'])
@Index(['inspectedAt'])
export class MarketInspection {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100, comment: '检疫证号' })
  certificateNumber: string;

  @Column({ type: 'uuid', nullable: true, comment: '检疫证ID' })
  certificateId: string;

  @Column({ type: 'uuid', nullable: true, comment: '运输记录ID' })
  transportRecordId: string;

  @Column({ type: 'varchar', length: 100, nullable: true, comment: '批次号' })
  batchNumber: string;

  @Column({ type: 'varchar', length: 200, comment: '验收市场名称' })
  marketName: string;

  @Column({ type: 'varchar', length: 100, nullable: true, comment: '验收市场ID' })
  marketId: string;

  @Column({ type: 'varchar', length: 200, comment: '经营户名称' })
  merchantName: string;

  @Column({ type: 'varchar', length: 100, nullable: true, comment: '经营户ID' })
  merchantId: string;

  @Column({
    type: 'varchar',
    length: 50,
    enum: MarketInspectionResult,
    comment: '验收结果',
  })
  result: MarketInspectionResult;

  @Column({ type: 'timestamp', comment: '验收时间' })
  inspectedAt: Date;

  @Column({ type: 'varchar', length: 100, comment: '验收人ID' })
  inspectorId: string;

  @Column({ type: 'varchar', length: 100, comment: '验收人姓名' })
  inspectorName: string;

  @Column({ type: 'int', comment: '验收动物数量' })
  inspectedQuantity: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true, comment: '验收重量' })
  inspectedWeight: number;

  @Column({ type: 'text', nullable: true, comment: '验收发现的问题' })
  issuesFound: string;

  @Column({ type: 'text', nullable: true, comment: '处理措施' })
  measuresTaken: string;

  @Column({ type: 'text', nullable: true, comment: '备注' })
  remarks: string;

  @Column({ type: 'jsonb', nullable: true, comment: '扩展字段' })
  metadata: Record<string, any>;

  @CreateDateColumn({ comment: '创建时间' })
  createdAt: Date;
}
