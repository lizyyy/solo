import { DataTypes, Model } from 'sequelize';
import sequelize from './database';

class InspectionPhoto extends Model {
  public id!: string;
  public projectId!: string;
  public nodeId!: string | null;
  public photoUrl!: string;
  public photoName!: string;
  public description!: string;
  public uploadedBy!: string;
  public uploadTime!: Date;
  public isInspectionPhoto!: boolean;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

InspectionPhoto.init({
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
  nodeId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'construction_nodes',
      key: 'id'
    }
  },
  photoUrl: {
    type: DataTypes.STRING(500),
    allowNull: false
  },
  photoName: {
    type: DataTypes.STRING(200),
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  uploadedBy: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  uploadTime: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  isInspectionPhoto: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  }
}, {
  sequelize,
  modelName: 'InspectionPhoto',
  tableName: 'inspection_photos'
});

export default InspectionPhoto;
