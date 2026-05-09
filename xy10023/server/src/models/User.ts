import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../database';

export enum UserRole {
  ADMIN = 'admin',
  SUPERVISOR = 'supervisor',
  AGENT = 'agent',
}

interface UserAttributes {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface UserCreationAttributes extends Optional<UserAttributes, 'id' | 'createdAt' | 'updatedAt' | 'isActive' | 'role'> {}

export class User extends Model<UserAttributes, UserCreationAttributes> {
  public id!: string;
  public username!: string;
  public email!: string;
  public passwordHash!: string;
  public fullName!: string;
  public role!: UserRole;
  public isActive!: boolean;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  public toJSON(): Omit<UserAttributes, 'passwordHash'> {
    const values = { ...this.get() } as UserAttributes;
    delete values.passwordHash;
    return values;
  }
}

User.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    username: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
    passwordHash: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'password_hash',
    },
    fullName: {
      type: DataTypes.STRING(200),
      allowNull: false,
      field: 'full_name',
    },
    role: {
      type: DataTypes.ENUM(...Object.values(UserRole)),
      allowNull: false,
      defaultValue: UserRole.AGENT,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'is_active',
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
    tableName: 'users',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['username'], unique: true },
      { fields: ['email'], unique: true },
      { fields: ['role'] },
      { fields: ['is_active'] },
    ],
  }
);

export default User;
