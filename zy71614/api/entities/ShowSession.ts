import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
} from 'typeorm'
import { SettlementTask } from './SettlementTask.js'

@Entity()
export class ShowSession {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ type: 'text' })
  showCode!: string

  @Column({ type: 'text' })
  filmName!: string

  @Column({ type: 'text' })
  showTime!: string

  @Column({ type: 'text' })
  hallName!: string

  @Column({ type: 'boolean', default: false })
  isSpecial!: boolean

  @Column({ type: 'text', nullable: true })
  specialType!: string | null

  @Column({ type: 'text', nullable: true })
  contractId!: string | null

  @ManyToOne(() => SettlementTask, (t) => t.showSessions)
  task!: SettlementTask
}
