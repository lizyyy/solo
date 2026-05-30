import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm'
import { BoxOfficeRecord } from './BoxOfficeRecord.js'
import { ShowSession } from './ShowSession.js'
import { FilmContract } from './FilmContract.js'
import { SettlementResult } from './SettlementResult.js'
import { VersionHistory } from './VersionHistory.js'

@Entity()
export class SettlementTask {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ type: 'text' })
  name!: string

  @Column({ type: 'text', default: 'draft' })
  status!: string

  @Column({ type: 'text' })
  periodStart!: string

  @Column({ type: 'text' })
  periodEnd!: string

  @Column({ type: 'real', default: 0 })
  totalGross!: number

  @Column({ type: 'real', default: 0 })
  totalRefund!: number

  @Column({ type: 'real', default: 0 })
  totalCoupon!: number

  @Column({ type: 'real', default: 0 })
  netGross!: number

  @Column({ type: 'real', default: 0 })
  totalSettlement!: number

  @Column({ type: 'integer', default: 0 })
  errorCount!: number

  @Column({ type: 'integer', default: 1 })
  currentVersion!: number

  @CreateDateColumn()
  createdAt!: Date

  @UpdateDateColumn()
  updatedAt!: Date

  @OneToMany(() => BoxOfficeRecord, (r) => r.task)
  boxOfficeRecords!: BoxOfficeRecord[]

  @OneToMany(() => ShowSession, (s) => s.task)
  showSessions!: ShowSession[]

  @OneToMany(() => FilmContract, (c) => c.task)
  filmContracts!: FilmContract[]

  @OneToMany(() => SettlementResult, (r) => r.task)
  settlementResults!: SettlementResult[]

  @OneToMany(() => VersionHistory, (v) => v.task)
  versionHistories!: VersionHistory[]
}
