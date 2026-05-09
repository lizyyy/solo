import { Schema, model, Document } from 'mongoose';
import { ConflictResolution } from '@live-push/shared';

export interface ConflictResolutionDocument extends Document, Omit<ConflictResolution, 'id'> {}

const ConflictResolutionSchema = new Schema<ConflictResolutionDocument>(
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
      transform: (doc, ret) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

ConflictResolutionSchema.index({ messageId: 1, resolvedAt: -1 });

export default model<ConflictResolutionDocument>('ConflictResolution', ConflictResolutionSchema);
