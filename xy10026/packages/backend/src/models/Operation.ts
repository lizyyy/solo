import { Schema, model, Document } from 'mongoose';
import { OperationType, Operation } from '@live-push/shared';

export interface OperationDocument extends Document, Omit<Operation, 'id'> {}

const OperationSchema = new Schema<OperationDocument>(
  {
    _id: { type: String, required: true },
    messageId: { type: String, required: true, index: true },
    type: {
      type: String,
      required: true,
      enum: Object.values(OperationType),
    },
    operatorId: { type: String, required: true },
    operatorName: { type: String, required: true },
    beforeState: { type: Schema.Types.Mixed },
    afterState: { type: Schema.Types.Mixed },
    reason: { type: String },
    traceId: { type: String, required: true, index: true },
    ip: { type: String },
    userAgent: { type: String },
  },
  {
    timestamps: { createdAt: 'timestamp', updatedAt: false },
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

OperationSchema.index({ messageId: 1, timestamp: 1 });
OperationSchema.index({ traceId: 1 });
OperationSchema.index({ operatorId: 1, timestamp: -1 });

export default model<OperationDocument>('Operation', OperationSchema);
