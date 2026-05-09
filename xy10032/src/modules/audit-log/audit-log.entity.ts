import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
} from 'typeorm';
import { ActionType } from '../../common/enums/action-type.enum';
import { LogLevel } from '../../common/enums/log-level.enum';
import { User } from '../user/user.entity';
import { Refund } from '../refund/refund.entity';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: LogLevel,
    default: LogLevel.INFO,
  })
  level: LogLevel;

  @Column({
    type: 'enum',
    enum: ActionType,
  })
  actionType: ActionType;

  @Column()
  entityType: string;

  @Column({ nullable: true })
  entityId: string;

  @ManyToOne(() => Refund, (refund) => refund.auditLogs, { nullable: true, onDelete: 'SET NULL' })
  refund: Refund;

  @ManyToOne(() => User, (user) => user.auditLogs, { nullable: true, onDelete: 'SET NULL' })
  performedBy: User;

  @Column({ nullable: true })
  performedById: string;

  @Column({ nullable: true })
  performedByUsername: string;

  @Column()
  description: string;

  @Column({ nullable: true, type: 'json' })
  details: Record<string, any>;

  @Column({ nullable: true, type: 'text' })
  errorMessage: string;

  @Column({ nullable: true, type: 'text' })
  stackTrace: string;

  @Column({ nullable: true })
  requestId: string;

  @Column({ nullable: true })
  ipAddress: string;

  @CreateDateColumn()
  createdAt: Date;
}
