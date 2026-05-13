import mongoose, { Document, Schema } from 'mongoose';

export interface IReleaseRequest extends Document {
  requestId: string;
  title: string;
  description: string;
  applicant: string;
  department: string;
  status: 'pending' | 'approved' | 'rejected' | 'processing' | 'completed' | 'rolled_back';
  priority: 'low' | 'medium' | 'high' | 'critical';
  type: 'config' | 'resource' | 'code' | 'database';
  changeHistory: Array<{
    field: string;
    oldValue: any;
    newValue: any;
    modifiedBy: string;
    modifiedAt: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const ReleaseRequestSchema: Schema = new Schema({
  requestId: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  applicant: { type: String, required: true },
  department: { type: String, required: true },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'processing', 'completed', 'rolled_back'],
    default: 'pending'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  type: {
    type: String,
    enum: ['config', 'resource', 'code', 'database'],
    default: 'config'
  },
  changeHistory: [{
    field: { type: String, required: true },
    oldValue: { type: Schema.Types.Mixed },
    newValue: { type: Schema.Types.Mixed },
    modifiedBy: { type: String, required: true },
    modifiedAt: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

export default mongoose.model<IReleaseRequest>('ReleaseRequest', ReleaseRequestSchema);
