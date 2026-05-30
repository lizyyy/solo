import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
} from 'typeorm'
import { SettlementTask } from './SettlementTask.js'

@Entity()
export class BoxOfficeRecord {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ type: 'text' })
  ticketNo!: string

  @Column({ type: 'text' })
  showCode!: string

  @Column({ type: 'text' })
  filmName!: string

  @Column({ type: 'text' })
  showTime!: string

  @Column({ type: 'real', default: 0 })
  ticketAmount!: number

  @Column({ type: 'real', default: 0 })
  refundAmount!: number

  @Column({ type: 'real', default: 0 })
  couponAmount!: number

  @Column({ type: 'real', default: 0 })
  netAmount!: number

  @Column({ type: 'text', default: 'normal' })
  recordStatus!: string

  @Column({ type: 'text', nullable: true })
  errorMessage!: string | null

  @Column({ type: 'text', nullable: true })
  diffNote!: string | null

  @Column({ type: 'boolean', default: false })
  mapped!: boolean

  @Column({ type: 'text', nullable: true })
  sessionId!: string | null

  @Column({ type: 'text', nullable: true })
  contractId!: string | null

  @Column({ type: 'text', nullable: true })
  diffHash!: string | null

  @CreateDateColumn()
  createdAt!: Date

  @ManyToOne(() => SettlementTask, (t) => t.boxOfficeRecords)
  task!: SettlementTask
}
