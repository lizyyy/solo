import { Entity, Column, ManyToMany, JoinTable, OneToMany } from 'typeorm';
import { BaseEntity } from '../common/base.entity';
import { Group } from '../groups/group.entity';
import { AuditLog } from '../audit/audit-log.entity';

@Entity('users')
export class User extends BaseEntity {
  @Column({ unique: true })
  username: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column({ nullable: true })
  displayName: string;

  @Column({ default: true })
  isActive: boolean;

  @ManyToMany(() => Group, (group) => group.members)
  @JoinTable({
    name: 'user_groups',
    joinColumn: { name: 'user_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'group_id', referencedColumnName: 'id' },
  })
  groups: Group[];

  @OneToMany(() => AuditLog, (log) => log.user)
  auditLogs: AuditLog[];
}
