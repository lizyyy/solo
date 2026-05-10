import { Schema, model } from 'mongoose';
import { MessageType, MessageStatus, LiveMessage } from '@live-push/shared';

export interface LiveMessageDocument {
  _id: string;
  roomId: string;
  type: string;
  content: string;
  senderId: string;
  senderName: string;
  metadata?: unknown;
  sequence: number;
  status: string;
  retryCount: number;
  maxRetries: number;
  createdAt: Date;
  updatedAt: Date;
  deliveredAt?: Date;
  version: number;
}

const LiveMessageSchema = new Schema(
  {
    _id: { type: String, required: true },
    roomId: { type: String, required: true, index: true },
    type: {
      type: String,
      required: true,
      enum: Object.values(MessageType),
    },
    content: { type: String, required: true },
    senderId: { type: String, required: true, index: true },
    senderName: { type: String, required: true },
    metadata: { type: Schema.Types.Mixed },
    sequence: { type: Number, required: true, default: 0 },
    status: {
      type: String,
      required: true,
      enum: Object.values(MessageStatus),
      default: MessageStatus.PENDING,
    },
    retryCount: { type: Number, required: true, default: 0 },
    maxRetries: { type: Number, required: true, default: 5 },
    deliveredAt: { type: Date },
    version: { type: Number, required: true, default: 1 },
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
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

LiveMessageSchema.index({ roomId: 1, sequence: 1 }, { unique: true });
LiveMessageSchema.index({ status: 1, createdAt: -1 });
LiveMessageSchema.index({ roomId: 1, createdAt: -1 });

export default model<LiveMessageDocument>('LiveMessage', LiveMessageSchema);
