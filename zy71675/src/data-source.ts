import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { Track } from './entities/Track';
import { MasterFile } from './entities/MasterFile';
import { CoverArt } from './entities/CoverArt';
import { PlatformSpec } from './entities/PlatformSpec';
import { ModificationLog } from './entities/ModificationLog';
import { DeliveryReport } from './entities/DeliveryReport';
import { Anomaly } from './entities/Anomaly';

export const AppDataSource = new DataSource({
  type: 'sqlite',
  database: './master_delivery.db',
  synchronize: true,
  logging: false,
  entities: [
    Track,
    MasterFile,
    CoverArt,
    PlatformSpec,
    ModificationLog,
    DeliveryReport,
    Anomaly,
  ],
  migrations: [],
  subscribers: [],
});
