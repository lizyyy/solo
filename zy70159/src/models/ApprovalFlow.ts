import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database';

class ApprovalFlow extends Model {
  public id!: string;
  public requestId!: string;
  public approverId!: string;
  public approverName!: string;
  public level!: number;
  public status!: 'pending' | 'approved' | 'rejected';
  public comment!: string | null;
  public decisionTime!: Date | null;
}

ApprovalFlow.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
    },
    requestId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    approverId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    approverName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    level: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM('pending', 'approved', 'rejected'),
      defaultValue: 'pending',
    },
    comment: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    decisionTime: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'ApprovalFlow',
    timestamps: true,
  }
);

export default ApprovalFlow;
