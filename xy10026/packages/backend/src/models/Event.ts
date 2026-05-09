import { Schema, model, Document } from 'mongoose';
import { EventType, Event } from '@live-push/shared';

export interface EventDocument extends Document, Omit<Event, 'id'> {}

const EventSchema = new Schema<EventDocument>(
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
      transform: (doc, ret) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

EventSchema.index({ aggregateId: 1, version: 1 }, { unique: true });
EventSchema.index({ aggregateId: 1, timestamp: 1 });
EventSchema.index({ type: 1, timestamp: -1 });
EventSchema.index({ traceId: 1 });

export default model<EventDocument>('Event', EventSchema);
