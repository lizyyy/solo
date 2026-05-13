import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../database';

interface CompanionSeatAttributes {
  id: string;
  waitlistId: string;
  seatNumber: string;
  seatRow: string;
  seatColumn: string;
  isMain: boolean;
  status: 'available' | 'assigned' | 'locked' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
}

interface CompanionSeatCreationAttributes extends Optional<CompanionSeatAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

class CompanionSeat extends Model<CompanionSeatAttributes, CompanionSeatCreationAttributes> implements CompanionSeatAttributes {
  public id!: string;
  public waitlistId!: string;
  public seatNumber!: string;
  public seatRow!: string;
  public seatColumn!: string;
  public isMain!: boolean;
  public status!: 'available' | 'assigned' | 'locked' | 'cancelled';
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

CompanionSeat.init({
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4
  },
  waitlistId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'waitlist_queues',
      key: 'id'
    }
  },
  seatNumber: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  seatRow: {
    type: DataTypes.STRING(20),
    allowNull: false
  },
  seatColumn: {
    type: DataTypes.STRING(20),
    allowNull: false
  },
  isMain: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  status: {
    type: DataTypes.ENUM('available', 'assigned', 'locked', 'cancelled'),
    allowNull: false,
    defaultValue: 'available'
  }
}, {
  sequelize,
  modelName: 'CompanionSeat',
  tableName: 'companion_seats',
  timestamps: true,
  indexes: [
    { fields: ['waitlistId'] },
    { fields: ['seatNumber'], unique: true }
  ]
});

export default CompanionSeat;
