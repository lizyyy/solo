import { DataTypes, Model } from 'sequelize';
import sequelize from './database';
import { ProjectStatus } from '../types';

class Project extends Model {
  public id!: string;
  public name!: string;
  public description!: string;
  public location!: string;
  public estimatedAmount!: number;
  public actualAmount!: number;
  public status!: ProjectStatus;
  public responsiblePerson!: string;
  public currentNodeId!: string | null;
  public createdBy!: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Project.init({
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4
  },
  name: {
    type: DataTypes.STRING(200),
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  location: {
    type: DataTypes.STRING(200),
    allowNull: false
  },
  estimatedAmount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0
  },
  actualAmount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0
  },
  status: {
    type: DataTypes.ENUM(...Object.values(ProjectStatus)),
    allowNull: false,
    defaultValue: ProjectStatus.DRAFT
  },
  responsiblePerson: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  currentNodeId: {
    type: DataTypes.UUID,
    allowNull: true
  },
  createdBy: {
    type: DataTypes.STRING(100),
    allowNull: false
  }
}, {
  sequelize,
  modelName: 'Project',
  tableName: 'projects'
});

export default Project;
