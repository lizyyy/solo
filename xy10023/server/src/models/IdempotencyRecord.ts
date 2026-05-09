import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../database';

export enum IdempotencyStatus {
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

interface IdempotencyRecordAttributes {
  id: string;
  requestId: string;
  idempotencyKey?: string;
  endpoint: string;
  method: string;
  requestData?: Record<string, unknown>;
  responseData?: Record<string, unknown>;
  status: IdempotencyStatus;
  errorMessage?: string;
  statusCode?: number;
  createdAt: Date;
  expiresAt: Date;
}

interface IdempotencyRecordCreationAttributes extends Optional<IdempotencyRecordAttributes, 'id' | 'createdAt'> {}

export class IdempotencyRecord extends Model<IdempotencyRecordAttributes, IdempotencyRecordCreationAttributes> {
  public id!: string;
  public requestId!: string;
  public idempotencyKey?: string;
  public endpoint!: string;
  public method!: string;
  public requestData?: Record<string, unknown>;
  public responseData?: Record<string, unknown>;
  public status!: IdempotencyStatus;
  public errorMessage?: string;
  public statusCode?: number;
  public readonly createdAt!: Date;
  public expiresAt!: Date;
}

IdempotencyRecord.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    requestId: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: true,
      field: 'request_id',
    },
    idempotencyKey: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'idempotency_key',
    },
    endpoint: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    method: {
      type: DataTypes.STRING(10),
      allowNull: false,
    },
    requestData: {
      type: DataTypes.JSONB,
      allowNull: true,
      field: 'request_data',
    },
    responseData: {
      type: DataTypes.JSONB,
      allowNull: true,
      field: 'response_data',
    },
    status: {
      type: DataTypes.ENUM(...Object.values(IdempotencyStatus)),
      allowNull: false,
    },
    errorMessage: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'error_message',
    },
    statusCode: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'status_code',
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'created_at',
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'expires_at',
    },
  },
  {
    sequelize,
    tableName: 'idempotency_records',
    timestamps: true,
    updatedAt: false,
    underscored: true,
    indexes: [
      { fields: ['request_id'], unique: true },
      { fields: ['idempotency_key', 'endpoint', 'method'] },
      { fields: ['expires_at'] },
      { fields: ['status'] },
    ],
  }
);

export default IdempotencyRecord;
