import { DataTypes, Model } from 'sequelize';
import sequelize from './database';

class ChangeHistory extends Model {
  public id!: string;
  public projectId!: string;
  public entityType!: string;
  public entityId!: string;
  public fieldName!: string;
  public oldValue!: string;
  public newValue!: string;
  public changedBy!: string;
  public changeTime!: Date;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

ChangeHistory.init({
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4
  },
  projectId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'projects',
      key: 'id'
    }
  },
  entityType: {
    type: DataTypes.STRING(50),
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
  changedBy: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  changeTime: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
}, {
  sequelize,
  modelName: 'ChangeHistory',
  tableName: 'change_histories'
});

export default ChangeHistory;
