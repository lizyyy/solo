import { DataTypes, Model } from 'sequelize';
import sequelize from './database';
import { NodeType } from '../types';

class ConstructionNode extends Model {
  public id!: string;
  public projectId!: string;
  public nodeType!: NodeType;
  public nodeName!: string;
  public nodeOrder!: number;
  public isCompleted!: boolean;
  public completedTime!: Date | null;
  public completedBy!: string;
  public remarks!: string;
  public deductionAmount!: number;
  public isDeducted!: boolean;
  public deductedTime!: Date | null;
  public deductedBy!: string;
  public deductionRequestId!: string | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

ConstructionNode.init({
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
  nodeType: {
    type: DataTypes.ENUM(...Object.values(NodeType)),
    allowNull: false
  },
  nodeName: {
    type: DataTypes.STRING(200),
    allowNull: false
  },
  nodeOrder: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  isCompleted: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  completedTime: {
    type: DataTypes.DATE,
    allowNull: true
  },
  completedBy: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  remarks: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  deductionAmount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0
  },
  isDeducted: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  deductedTime: {
    type: DataTypes.DATE,
    allowNull: true
  },
  deductedBy: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  deductionRequestId: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true
  }
}, {
  sequelize,
  modelName: 'ConstructionNode',
  tableName: 'construction_nodes'
});

export default ConstructionNode;
