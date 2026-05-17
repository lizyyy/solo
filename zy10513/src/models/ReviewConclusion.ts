import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../database/connection';

export enum ReviewResult {
  PASS = 'pass',
  FAIL = 'fail',
  NEEDS_REVIEW = 'needs_review',
  PENDING = 'pending',
}

export interface ReviewConclusionAttributes {
  id: string;
  batchId: string;
  originalRecordId: string;
  reviewerId: string;
  result: ReviewResult;
  comments?: string;
  evidence?: string[];
  correctionData?: Record<string, any>;
  processingBasis?: string;
  isManualCorrection: boolean;
  correctedAt?: Date;
  correctedBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date;
}

export interface ReviewConclusionCreationAttributes
  extends Optional<ReviewConclusionAttributes, 'id' | 'isManualCorrection' | 'createdAt' | 'updatedAt' | 'deletedAt'> {}

class ReviewConclusion
  extends Model<ReviewConclusionAttributes, ReviewConclusionCreationAttributes>
  implements ReviewConclusionAttributes {
  public id!: string;
  public batchId!: string;
  public originalRecordId!: string;
  public reviewerId!: string;
  public result!: ReviewResult;
  public comments?: string;
  public evidence?: string[];
  public correctionData?: Record<string, any>;
  public processingBasis?: string;
  public isManualCorrection!: boolean;
  public correctedAt?: Date;
  public correctedBy?: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
  public readonly deletedAt!: Date;
}

ReviewConclusion.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    batchId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'sampling_batches',
        key: 'id',
      },
    },
    originalRecordId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'original_records',
        key: 'id',
      },
    },
    reviewerId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'reviewers',
        key: 'id',
      },
    },
    result: {
      type: DataTypes.ENUM(...Object.values(ReviewResult)),
      allowNull: false,
      defaultValue: ReviewResult.PENDING,
    },
    comments: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    evidence: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    correctionData: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    processingBasis: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    isManualCorrection: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    correctedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    correctedBy: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'review_conclusions',
    modelName: 'ReviewConclusion',
    indexes: [
      {
        fields: ['batch_id', 'original_record_id'],
        unique: true,
      },
      {
        fields: ['batch_id', 'result'],
      },
    ],
  }
);

export default ReviewConclusion;
