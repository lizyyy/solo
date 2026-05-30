import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
} from 'typeorm'
import { SettlementTask } from './SettlementTask.js'

@Entity()
export class VersionHistory {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ type: 'integer' })
  version!: number

  @Column({ type: 'text' })
  snapshotJson!: string

  @Column({ type: 'text' })
  operation!: string

  @Column({ type: 'text', nullable: true })
  operator!: string | null

  @Column({ type: 'text', nullable: true })
  remark!: string | null

  @CreateDateColumn()
  createdAt!: Date

  @ManyToOne(() => SettlementTask, (t) => t.versionHistories)
  task!: SettlementTask
}
