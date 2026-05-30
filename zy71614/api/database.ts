import 'reflect-metadata'
import { DataSource } from 'typeorm'
import { SettlementTask } from './entities/SettlementTask.js'
import { BoxOfficeRecord } from './entities/BoxOfficeRecord.js'
import { ShowSession } from './entities/ShowSession.js'
import { FilmContract } from './entities/FilmContract.js'
import { SettlementResult } from './entities/SettlementResult.js'
import { VersionHistory } from './entities/VersionHistory.js'

export const AppDataSource = new DataSource({
  type: 'sqljs',
  location: 'cinema_settlement.db',
  autoSave: true,
  synchronize: true,
  entities: [SettlementTask, BoxOfficeRecord, ShowSession, FilmContract, SettlementResult, VersionHistory],
})

export async function initDatabase() {
  await AppDataSource.initialize()
  console.log('Database initialized')
}
