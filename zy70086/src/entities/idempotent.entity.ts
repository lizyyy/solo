import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('idempotent_records')
export class IdempotentRecord {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ comment: '业务类型' })
  bizType!: string;

  @Index({ unique: true })
  @Column({ comment: '幂等键' })
  idempotentKey!: string;

  @Column({ type: 'text', nullable: true, comment: '请求参数快照' })
  requestSnapshot!: string | null;

  @Column({ type: 'text', nullable: true, comment: '响应快照' })
  responseSnapshot!: string | null;

  @Column({ type: 'varchar', default: 'PENDING', comment: '处理状态' })
  status!: string;

  @Column({ type: 'varchar', nullable: true, comment: '关联业务记录ID' })
  bizId!: string | null;

  @CreateDateColumn()
  createdAt!: Date;
}
