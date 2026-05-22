import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { Franchise } from './entities/Franchise';
import { Material } from './entities/Material';
import { Order } from './entities/Order';
import { OrderItem } from './entities/OrderItem';
import { LossRecord } from './entities/LossRecord';
import { HeadquartersPrice } from './entities/HeadquartersPrice';
import { RefundRecord } from './entities/RefundRecord';
import { Batch } from './entities/Batch';
import { MaterialReceipt } from './entities/MaterialReceipt';
import { StatusTransition } from './entities/StatusTransition';
import { Attachment } from './entities/Attachment';
import { FailedRecord } from './entities/FailedRecord';

export const AppDataSource = new DataSource({
  type: 'sqlite',
  database: './database.sqlite',
  synchronize: true,
  logging: false,
  entities: [
    Franchise,
    Material,
    Order,
    OrderItem,
    LossRecord,
    HeadquartersPrice,
    RefundRecord,
    Batch,
    MaterialReceipt,
    StatusTransition,
    Attachment,
    FailedRecord
  ],
  migrations: [],
  subscribers: []
});
