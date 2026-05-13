import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database';

export enum FollowUpResult {
  SATISFIED = 'satisfied',
  DISSATISFIED = 'dissatisfied',
  NO_ANSWER = 'no_answer'
}

interface FollowUpAttributes {
  id: string;
  workOrderId: string;
  followUpTime: Date;
  followUpPerson: string;
  followUpPersonName: string;
  result: FollowUpResult;
  dissatisfactionReason: string | null;
  feedback: string | null;
  needsReProcess: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

class FollowUp extends Model<FollowUpAttributes> implements FollowUpAttributes {
  public id!: string;
  public workOrderId!: string;
  public followUpTime!: Date;
  public followUpPerson!: string;
  public followUpPersonName!: string;
  public result!: FollowUpResult;
  public dissatisfactionReason!: string | null;
  public feedback!: string | null;
  public needsReProcess!: boolean;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

FollowUp.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false
    },
    workOrderId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    followUpTime: {
      type: DataTypes.DATE,
      allowNull: false
    },
    followUpPerson: {
      type: DataTypes.UUID,
      allowNull: false
    },
    followUpPersonName: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    result: {
      type: DataTypes.ENUM(...Object.values(FollowUpResult)),
      allowNull: false
    },
    dissatisfactionReason: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    feedback: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    needsReProcess: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    }
  },
  {
    sequelize,
    modelName: 'FollowUp',
    tableName: 'follow_ups'
  }
);

export default FollowUp;
