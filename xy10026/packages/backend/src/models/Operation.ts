import { Schema, model } from 'mongoose';
import { OperationType, Operation } from '@live-push/shared';

export interface OperationDocument {
  _id: string;
  messageId: string;
  type: string;
  operatorId: string;
  operatorName: string;
  beforeState?: unknown;
  afterState?: unknown;
  reason?: string;
  timestamp: Date;
  traceId: string;
  ip?: string;
  userAgent?: string;
}

const OperationSchema = new Schema(
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

OperationSchema.index({ messageId: 1, timestamp: 1 });
OperationSchema.index({ traceId: 1 });
OperationSchema.index({ operatorId: 1, timestamp: -1 });

export default model<OperationDocument>('Operation', OperationSchema);
