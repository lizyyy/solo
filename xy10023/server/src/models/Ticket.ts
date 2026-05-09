import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../database';

export enum TicketStatus {
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  PENDING_FOLLOWUP = 'pending_followup',
  COMPLETED = 'completed',
  CLOSED = 'closed',
  CANCELLED = 'cancelled',
}

export enum TicketPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent',
}

interface TicketAttributes {
  id: string;
  title: string;
  customerId: string;
  customerName?: string;
  customerPhone?: string;
  assigneeId?: string;
  status: TicketStatus;
  priority: TicketPriority;
  category?: string;
  description?: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

interface TicketCreationAttributes extends Optional<TicketAttributes, 'id' | 'version' | 'createdAt' | 'updatedAt' | 'status' | 'priority'> {}

export class Ticket extends Model<TicketAttributes, TicketCreationAttributes> {
  public id!: string;
  public title!: string;
  public customerId!: string;
  public customerName?: string;
  public customerPhone?: string;
  public assigneeId?: string;
  public status!: TicketStatus;
  public priority!: TicketPriority;
  public category?: string;
  public description?: string;
  public version!: number;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  public static async updateWithOptimisticLock(
    id: string,
    updates: Partial<TicketAttributes>,
    expectedVersion: number
  ): Promise<Ticket> {
    const [updatedCount, updatedTickets] = await this.update(
      {
        ...updates,
        version: expectedVersion + 1,
      },
      {
        where: {
          id,
          version: expectedVersion,
        },
        returning: true,
      }
    );

    if (updatedCount === 0) {
      throw new VersionConflictError(id, expectedVersion);
    }

    return updatedTickets[0];
  }
}

export class VersionConflictError extends Error {
  public ticketId: string;
  public expectedVersion: number;

  constructor(ticketId: string, expectedVersion: number) {
    super(`Version conflict for ticket ${ticketId}. Expected version ${expectedVersion}`);
    this.name = 'VersionConflictError';
    this.ticketId = ticketId;
    this.expectedVersion = expectedVersion;
  }
}

Ticket.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    title: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    customerId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'customer_id',
    },
    customerName: {
      type: DataTypes.STRING(200),
      allowNull: true,
      field: 'customer_name',
    },
    customerPhone: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: 'customer_phone',
    },
    assigneeId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'assignee_id',
    },
    status: {
      type: DataTypes.ENUM(...Object.values(TicketStatus)),
      allowNull: false,
      defaultValue: TicketStatus.OPEN,
    },
    priority: {
      type: DataTypes.ENUM(...Object.values(TicketPriority)),
      allowNull: false,
      defaultValue: TicketPriority.NORMAL,
    },
    category: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    version: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'created_at',
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'updated_at',
    },
  },
  {
    sequelize,
    tableName: 'tickets',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['status'] },
      { fields: ['assignee_id'] },
      { fields: ['customer_id'] },
      { fields: ['priority'] },
      { fields: ['category'] },
      { fields: ['created_at'] },
    ],
  }
);

export default Ticket;
