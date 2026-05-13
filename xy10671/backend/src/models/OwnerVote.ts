import { DataTypes, Model } from 'sequelize';
import sequelize from './database';
import { VoteResult } from '../types';

class OwnerVote extends Model {
  public id!: string;
  public projectId!: string;
  public ownerName!: string;
  public ownerRoom!: string;
  public voteResult!: VoteResult;
  public voteTime!: Date;
  public remarks!: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

OwnerVote.init({
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
  ownerName: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  ownerRoom: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  voteResult: {
    type: DataTypes.ENUM(...Object.values(VoteResult)),
    allowNull: false
  },
  voteTime: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  remarks: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  sequelize,
  modelName: 'OwnerVote',
  tableName: 'owner_votes'
});

export default OwnerVote;
