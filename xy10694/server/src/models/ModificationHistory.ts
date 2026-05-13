import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database';

export enum EntityType {
  RESIDENT_ADDRESS = 'resident_address',
  PROBLEM_TYPE = 'problem_type',
  GRID_WORKER = 'grid_worker',
  WORK_ORDER = 'work_order',
  WORK_ORDER_PHOTO = 'work_order_photo'
}

interface ModificationHistoryAttributes {
  id: string;
  entityType: EntityType;
  entityId: string;
  fieldName: string;
  oldValue: string | null;
  newValue: string | null;
  modifiedBy: string;
  modifiedByName: string;
  reason: string | null;
  affectedRecords: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

class ModificationHistory extends Model<ModificationHistoryAttributes> implements ModificationHistoryAttributes {
  public id!: string;
  public entityType!: EntityType;
  public entityId!: string;
  public fieldName!: string;
  public oldValue!: string | null;
  public newValue!: string | null;
  public modifiedBy!: string;
  public modifiedByName!: string;
  public reason!: string | null;
  public affectedRecords!: string | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

ModificationHistory.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false
    },
    entityType: {
      type: DataTypes.ENUM(...Object.values(EntityType)),
      allowNull: false
    },
    entityId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    fieldName: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    oldValue: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    newValue: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    modifiedBy: {
      type: DataTypes.UUID,
      allowNull: false
    },
    modifiedByName: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    reason: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    affectedRecords: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  },
  {
    sequelize,
    modelName: 'ModificationHistory',
    tableName: 'modification_histories'
  }
);

export default ModificationHistory;
