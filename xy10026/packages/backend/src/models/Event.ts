import { Schema, model } from 'mongoose';
import { EventType, Event } from '@live-push/shared';

export interface EventDocument {
  _id: string;
  type: string;
  aggregateId: string;
  data: unknown;
  version: number;
  timestamp: Date;
  traceId: string;
  metadata?: unknown;
}

const EventSchema = new Schema(
  {
    _id: { type: String, required: true },
    type: {
      type: String,
      required: true,
      enum: Object.values(EventType),
    },
    aggregateId: { type: String, required: true, index: true },
    data: { type: Schema.Types.Mixed, required: true },
    version: { type: Number, required: true },
    traceId: { type: String, required: true, index: true },
    metadata: { type: Schema.Types.Mixed },
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

EventSchema.index({ aggregateId: 1, version: 1 }, { unique: true });
EventSchema.index({ aggregateId: 1, timestamp: 1 });
EventSchema.index({ type: 1, timestamp: -1 });
EventSchema.index({ traceId: 1 });

export default model<EventDocument>('Event', EventSchema);
