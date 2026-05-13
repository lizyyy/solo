import mongoose, { Document, Schema } from 'mongoose';

export interface IGrayBatch extends Document {
  requestId: string;
  batchNumber: number;
  batchName: string;
  targetPercentage: number;
  actualPercentage?: number;
  startTime?: Date;
  endTime?: Date;
  status: 'pending' | 'processing' | 'completed' | 'paused' | 'failed';
  instanceCount: number;
  successCount?: number;
  failedCount?: number;
  createdAt: Date;
  updatedAt: Date;
}

const GrayBatchSchema: Schema = new Schema({
  requestId: { type: String, required: true, ref: 'ReleaseRequest' },
  batchNumber: { type: Number, required: true },
  batchName: { type: String, required: true },
  targetPercentage: { type: Number, required: true, min: 0, max: 100 },
  actualPercentage: { type: Number, min: 0, max: 100 },
  startTime: { type: Date },
  endTime: { type: Date },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'paused', 'failed'],
    default: 'pending'
  },
  instanceCount: { type: Number, default: 0 },
  successCount: { type: Number, default: 0 },
  failedCount: { type: Number, default: 0 }
}, { timestamps: true });

export default mongoose.model<IGrayBatch>('GrayBatch', GrayBatchSchema);
