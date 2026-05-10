import { Schema, model } from 'mongoose';
import { ConflictResolution } from '@live-push/shared';

export interface ConflictResolutionDocument {
  _id: string;
  messageId: string;
  baseVersion: number;
  currentVersion: number;
  proposedVersion: number;
  resolved: boolean;
  winner: string;
  mergedData?: unknown;
  resolvedAt: Date;
}

const ConflictResolutionSchema = new Schema(
  {
    _id: { type: String, required: true },
    messageId: { type: String, required: true, index: true },
    baseVersion: { type: Number, required: true },
    currentVersion: { type: Number, required: true },
    proposedVersion: { type: Number, required: true },
    resolved: { type: Boolean, required: true, default: false },
    winner: {
      type: String,
      required: true,
      enum: ['current', 'proposed', 'merged'],
    },
    mergedData: { type: Schema.Types.Mixed },
  },
  {
    timestamps: { createdAt: 'resolvedAt', updatedAt: false },
    toJSON: {
      transform: (_doc, ret) => {
        const result = ret as any;
        result.id = result._id;
        delete result._id;
        delete result.__v;
        return result;
      },
    },
  }
);

ConflictResolutionSchema.index({ messageId: 1, resolvedAt: -1 });

export default model<ConflictResolutionDocument>('ConflictResolution', ConflictResolutionSchema);
