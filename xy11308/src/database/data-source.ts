import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { Elder } from '../entities/Elder';
import { Meal } from '../entities/Meal';
import { MealAssignment } from '../entities/MealAssignment';
import { MealChange } from '../entities/MealChange';
import { Delivery } from '../entities/Delivery';
import { FollowUp } from '../entities/FollowUp';
import { AuditLog } from '../entities/AuditLog';
import { BatchOperation } from '../entities/BatchOperation';

export const AppDataSource = new DataSource({
  type: 'sqlite',
  database: './canteen.db',
  synchronize: true,
  logging: false,
  entities: [
    Elder,
    Meal,
    MealAssignment,
    MealChange,
    Delivery,
    FollowUp,
    AuditLog,
    BatchOperation
  ],
  migrations: [],
  subscribers: [],
});