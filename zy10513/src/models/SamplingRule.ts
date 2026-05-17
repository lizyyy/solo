import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../database/connection';

export enum SamplingMethod {
  RANDOM = 'random',
  SYSTEMATIC = 'systematic',
  STRATIFIED = 'stratified',
  CLUSTER = 'cluster',
  CONVENIENCE = 'convenience',
  RULE_BASED = 'rule_based',
}

export interface SamplingRuleAttributes {
  id: string;
  name: string;
  description?: string;
  method: SamplingMethod;
  sampleSize: number;
  sampleRate?: number;
  stratifyField?: string;
  filterConditions?: Record<string, any>;
  isActive: boolean;
  createdBy: string;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date;
}

export interface SamplingRuleCreationAttributes
  extends Optional<SamplingRuleAttributes, 'id' | 'isActive' | 'createdAt' | 'updatedAt' | 'deletedAt'> {}

class SamplingRule
  extends Model<SamplingRuleAttributes, SamplingRuleCreationAttributes>
  implements SamplingRuleAttributes {
  public id!: string;
  public name!: string;
  public description?: string;
  public method!: SamplingMethod;
  public sampleSize!: number;
  public sampleRate?: number;
  public stratifyField?: string;
  public filterConditions?: Record<string, any>;
  public isActive!: boolean;
  public createdBy!: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
  public readonly deletedAt!: Date;
}

SamplingRule.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    name: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    method: {
      type: DataTypes.ENUM(...Object.values(SamplingMethod)),
      allowNull: false,
    },
    sampleSize: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    sampleRate: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    stratifyField: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    filterConditions: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    createdBy: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'sampling_rules',
    modelName: 'SamplingRule',
  }
);

export default SamplingRule;
