import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { ExportType, ExportStatus } from '../../../common/types';

@Entity('export_tasks')
@Index(['exportType'])
@Index(['status'])
@Index(['createdBy'])
@Index(['createdAt'])
export class ExportTask {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100, unique: true, comment: '导出任务编号' })
  taskNumber: string;

  @Column({
    type: 'varchar',
    length: 50,
    enum: ExportType,
    comment: '导出类型',
  })
  exportType: ExportType;

  @Column({ type: 'varchar', length: 200, comment: '导出名称' })
  exportName: string;

  @Column({
    type: 'varchar',
    length: 50,
    enum: ExportStatus,
    default: ExportStatus.PENDING,
    comment: '任务状态',
  })
  status: ExportStatus;

  @Column({ type: 'jsonb', nullable: true, comment: '导出筛选条件' })
  filters: Record<string, any>;

  @Column({ type: 'text', nullable: true, comment: '导出内容描述' })
  contentDescription: string;

  @Column({ type: 'int', default: 0, comment: '导出记录总数' })
  recordCount: number;

  @Column({ type: 'varchar', length: 500, nullable: true, comment: '导出文件路径' })
  filePath: string;

  @Column({ type: 'varchar', length: 200, nullable: true, comment: '文件名' })
  fileName: string;

  @Column({ type: 'int', default: 0, comment: '文件大小（字节）' })
  fileSize: number;

  @Column({ type: 'text', nullable: true, comment: '错误信息' })
  errorMessage: string;

  @Column({ type: 'varchar', length: 100, comment: '申请人ID' })
  createdBy: string;

  @Column({ type: 'varchar', length: 100, comment: '申请人姓名' })
  createdByName: string;

  @Column({ type: 'timestamp', nullable: true, comment: '完成时间' })
  completedAt: Date;

  @CreateDateColumn({ comment: '创建时间' })
  createdAt: Date;

  @UpdateDateColumn({ comment: '更新时间' })
  updatedAt: Date;
}
