import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
} from 'typeorm'
import { SettlementTask } from './SettlementTask.js'

@Entity()
export class FilmContract {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ type: 'text' })
  filmName!: string

  @Column({ type: 'text' })
  distributor!: string

  @Column({ type: 'real' })
  shareRatio!: number

  @Column({ type: 'real', nullable: true })
  minimumGuarantee!: number | null

  @Column({ type: 'boolean', default: false })
  isTiered!: boolean

  @Column({ type: 'text', nullable: true })
  tierRules!: string | null

  @ManyToOne(() => SettlementTask, (t) => t.filmContracts)
  task!: SettlementTask
}
