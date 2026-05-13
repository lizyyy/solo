import { DataTypes, Model } from 'sequelize';
import sequelize from './database';

class PublicObjection extends Model {
  public id!: string;
  public projectId!: string;
  public objectionPerson!: string;
  public objectionTime!: Date;
  public objectionContent!: string;
  public isResolved!: boolean;
  public resolvedBy!: string;
  public resolvedTime!: Date | null;
  public resolutionContent!: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

PublicObjection.init({
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
  objectionPerson: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  objectionTime: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  objectionContent: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  isResolved: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  resolvedBy: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  resolvedTime: {
    type: DataTypes.DATE,
    allowNull: true
  },
  resolutionContent: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  sequelize,
  modelName: 'PublicObjection',
  tableName: 'public_objections'
});

export default PublicObjection;
