import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database';

export enum WorkOrderStatus {
  PENDING = 'pending',
  ASSIGNED = 'assigned',
  PROCESSING = 'processing',
  REVIEWING = 'reviewing',
  COMPLETED = 'completed',
  REJECTED = 'rejected',
  BLOCKED = 'blocked'
}

export enum WorkOrderScene {
  NORMAL = 'normal',
  BLOCKED = 'blocked',
  REVIEW = 'review',
  DUPLICATE = 'duplicate'
}

interface WorkOrderAttributes {
  id: string;
  orderNo: string;
  residentAddressId: string;
  problemTypeId: string;
  gridWorkerId: string;
  responsibleUnitId: string | null;
  description: string;
  status: WorkOrderStatus;
  scene: WorkOrderScene;
  priority: number;
  isUrgent: boolean;
  blockerReason: string | null;
  reviewerId: string | null;
  reviewerComment: string | null;
  processedAt: Date | null;
  completedAt: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

class WorkOrder extends Model<WorkOrderAttributes> implements WorkOrderAttributes {
  public id!: string;
  public orderNo!: string;
  public residentAddressId!: string;
  public problemTypeId!: string;
  public gridWorkerId!: string;
  public responsibleUnitId!: string | null;
  public description!: string;
  public status!: WorkOrderStatus;
  public scene!: WorkOrderScene;
  public priority!: number;
  public isUrgent!: boolean;
  public blockerReason!: string | null;
  public reviewerId!: string | null;
  public reviewerComment!: string | null;
  public processedAt!: Date | null;
  public completedAt!: Date | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

WorkOrder.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false
    },
    orderNo: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true
    },
    residentAddressId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    problemTypeId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    gridWorkerId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    responsibleUnitId: {
      type: DataTypes.UUID,
      allowNull: true
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM(...Object.values(WorkOrderStatus)),
      allowNull: false,
      defaultValue: WorkOrderStatus.PENDING
    },
    scene: {
      type: DataTypes.ENUM(...Object.values(WorkOrderScene)),
      allowNull: false,
      defaultValue: WorkOrderScene.NORMAL
    },
    priority: {
      type: DataTypes.INTEGER,
      defaultValue: 1
    },
    isUrgent: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    blockerReason: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    reviewerId: {
      type: DataTypes.UUID,
      allowNull: true
    },
    reviewerComment: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    processedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    completedAt: {
      type: DataTypes.DATE,
      allowNull: true
    }
  },
  {
    sequelize,
    modelName: 'WorkOrder',
    tableName: 'work_orders'
  }
);

export default WorkOrder;
