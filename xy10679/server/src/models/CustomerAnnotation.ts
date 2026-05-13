import { DataTypes, Model } from 'sequelize';
import sequelize from '../database';

export interface CustomerAnnotationAttributes {
  id?: number;
  photoSelectionId: number;
  editingVersionId?: number;
  annotationType: 'adjustment' | 'addition' | 'deletion' | 'other';
  content: string;
  annotator: string;
  annotationTime?: Date;
  status: 'pending' | 'processing' | 'resolved';
  handler?: string;
  handleTime?: Date;
  remark?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

class CustomerAnnotation extends Model<CustomerAnnotationAttributes> implements CustomerAnnotationAttributes {
  public id!: number;
  public photoSelectionId!: number;
  public editingVersionId?: number;
  public annotationType!: 'adjustment' | 'addition' | 'deletion' | 'other';
  public content!: string;
  public annotator!: string;
  public annotationTime?: Date;
  public status!: 'pending' | 'processing' | 'resolved';
  public handler?: string;
  public handleTime?: Date;
  public remark?: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

CustomerAnnotation.init({
  photoSelectionId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  editingVersionId: {
    type: DataTypes.INTEGER
  },
  annotationType: {
    type: DataTypes.ENUM('adjustment', 'addition', 'deletion', 'other'),
    allowNull: false
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  annotator: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  annotationTime: {
    type: DataTypes.DATE
  },
  status: {
    type: DataTypes.ENUM('pending', 'processing', 'resolved'),
    defaultValue: 'pending'
  },
  handler: {
    type: DataTypes.STRING(50)
  },
  handleTime: {
    type: DataTypes.DATE
  },
  remark: {
    type: DataTypes.TEXT
  }
}, {
  sequelize,
  modelName: 'CustomerAnnotation',
  tableName: 'customer_annotations'
});

export default CustomerAnnotation;
