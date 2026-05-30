import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
} from 'typeorm'
import { SettlementTask } from './SettlementTask.js'
import { FilmContract } from './FilmContract.js'

@Entity()
export class SettlementResult {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ type: 'text' })
  filmName!: string

  @Column({ type: 'text' })
  distributor!: string

  @Column({ type: 'real', default: 0 })
  grossAmount!: number

  @Column({ type: 'real', default: 0 })
  shareRatio!: number

  @Column({ type: 'real', default: 0 })
  settlementAmount!: number

  @Column({ type: 'real', default: 0 })
  guaranteeAmount!: number

  @Column({ type: 'real', default: 0 })
  finalAmount!: number

  @Column({ type: 'text', nullable: true })
  remark!: string | null

  @ManyToOne(() => SettlementTask, (t) => t.settlementResults)
  task!: SettlementTask

  @ManyToOne(() => FilmContract)
  contract!: FilmContract
}
