import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Role } from '../../common/enums/role.enum';
import { Refund } from '../refund/refund.entity';
import { AuditLog } from '../audit-log/audit-log.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  username: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column()
  fullName: string;

  @Column({
    type: 'enum',
    enum: Role,
    default: Role.OPERATOR,
  })
  role: Role;

  @Column({ default: true })
  isActive: boolean;

  @OneToMany(() => Refund, (refund) => refund.createdBy)
  createdRefunds: Refund[];

  @OneToMany(() => AuditLog, (log) => log.performedBy)
  auditLogs: AuditLog[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
