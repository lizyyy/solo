import mongoose, { Document, Schema } from 'mongoose';

export interface IAffectedService extends Document {
  requestId: string;
  serviceName: string;
  serviceId: string;
  environment: 'dev' | 'test' | 'staging' | 'prod';
  impactLevel: 'low' | 'medium' | 'high' | 'critical';
  expectedDowntime: number;
  actualDowntime?: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
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

const AffectedServiceSchema: Schema = new Schema({
  requestId: { type: String, required: true, ref: 'ReleaseRequest' },
  serviceName: { type: String, required: true },
  serviceId: { type: String, required: true },
  environment: {
    type: String,
    enum: ['dev', 'test', 'staging', 'prod'],
    required: true
  },
  impactLevel: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  expectedDowntime: { type: Number, default: 0 },
  actualDowntime: { type: Number },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending'
  },
  changeHistory: [{
    field: { type: String, required: true },
    oldValue: { type: Schema.Types.Mixed },
    newValue: { type: Schema.Types.Mixed },
    modifiedBy: { type: String, required: true },
    modifiedAt: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

export default mongoose.model<IAffectedService>('AffectedService', AffectedServiceSchema);
