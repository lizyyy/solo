import { Entity, Column, ManyToMany, OneToMany } from 'typeorm';
import { BaseEntity } from '../common/base.entity';
import { User } from '../users/user.entity';
import { Bill } from '../bills/bill.entity';
import { AuditLog } from '../audit/audit-log.entity';

@Entity('groups')
export class Group extends BaseEntity {
  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'uuid' })
  ownerId: string;

  @ManyToMany(() => User, (user) => user.groups)
  members: User[];

  @OneToMany(() => Bill, (bill) => bill.group)
  bills: Bill[];

  @OneToMany(() => AuditLog, (log) => log.group)
  auditLogs: AuditLog[];
}
