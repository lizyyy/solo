import mongoose, { Document, Schema } from 'mongoose';

export interface IRollbackAction extends Document {
  requestId: string;
  triggeredBy: string;
  triggerTime: Date;
  reason: string;
  reasonCategory: 'service_exception' | 'performance_issue' | 'data_error' | 'user_complaint' | 'security_risk' | 'other';
  affectedBatches: string[];
  rollbackScope: 'partial' | 'full';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  startTime?: Date;
  endTime?: Date;
  rollbackDetails: Array<{
    serviceName: string;
    beforeVersion: string;
    afterVersion: string;
    status: string;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const RollbackActionSchema: Schema = new Schema({
  requestId: { type: String, required: true, ref: 'ReleaseRequest' },
  triggeredBy: { type: String, required: true },
  triggerTime: { type: Date, default: Date.now },
  reason: { type: String, required: true },
  reasonCategory: {
    type: String,
    enum: ['service_exception', 'performance_issue', 'data_error', 'user_complaint', 'security_risk', 'other'],
    required: true
  },
  affectedBatches: [{ type: String }],
  rollbackScope: {
    type: String,
    enum: ['partial', 'full'],
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending'
  },
  startTime: { type: Date },
  endTime: { type: Date },
  rollbackDetails: [{
    serviceName: { type: String, required: true },
    beforeVersion: { type: String, required: true },
    afterVersion: { type: String, required: true },
    status: { type: String, required: true }
  }]
}, { timestamps: true });

export default mongoose.model<IRollbackAction>('RollbackAction', RollbackActionSchema);
