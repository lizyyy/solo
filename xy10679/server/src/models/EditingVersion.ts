import { DataTypes, Model } from 'sequelize';
import sequelize from '../database';

export interface EditingVersionAttributes {
  id?: number;
  photoSelectionId: number;
  versionNo: string;
  versionType: 'original' | 'first' | 'revised' | 'final';
  editor: string;
  editTime?: Date;
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  remark?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

class EditingVersion extends Model<EditingVersionAttributes> implements EditingVersionAttributes {
  public id!: number;
  public photoSelectionId!: number;
  public versionNo!: string;
  public versionType!: 'original' | 'first' | 'revised' | 'final';
  public editor!: string;
  public editTime?: Date;
  public status!: 'draft' | 'submitted' | 'approved' | 'rejected';
  public remark?: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

EditingVersion.init({
  photoSelectionId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  versionNo: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  versionType: {
    type: DataTypes.ENUM('original', 'first', 'revised', 'final'),
    allowNull: false
  },
  editor: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  editTime: {
    type: DataTypes.DATE
  },
  status: {
    type: DataTypes.ENUM('draft', 'submitted', 'approved', 'rejected'),
    defaultValue: 'draft'
  },
  remark: {
    type: DataTypes.TEXT
  }
}, {
  sequelize,
  modelName: 'EditingVersion',
  tableName: 'editing_versions'
});

export default EditingVersion;
