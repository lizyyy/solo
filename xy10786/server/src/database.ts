import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { ContentEntity } from './entities/ContentEntity';
import { ChannelSyncEntity } from './entities/ChannelSyncEntity';
import { ReviewRecordEntity } from './entities/ReviewRecordEntity';

export const AppDataSource = new DataSource({
  type: 'sqlite',
  database: './content-publish.db',
  synchronize: true,
  logging: false,
  entities: [ContentEntity, ChannelSyncEntity, ReviewRecordEntity],
  migrations: [],
  subscribers: [],
});
