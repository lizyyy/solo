import mongoose, { Document, Schema } from 'mongoose';

export interface IReleaseReport extends Document {
  requestId: string;
  reportId: string;
  generatedBy: string;
  generatedAt: Date;
  overallStatus: 'success' | 'partial_success' | 'failed' | 'rolled_back';
  totalServices: number;
  successfulServices: number;
  failedServices: number;
  totalDowntime: number;
  maxDowntime: number;
  approvalSummary: {
    approverCount: number;
    approvedCount: number;
    rejectedCount: number;
  };
  grayBatchSummary: Array<{
    batchName: string;
    targetPercentage: number;
    actualPercentage: number;
    status: string;
    successRate: number;
  }>;
  rollbackSummary?: {
    hasRollback: boolean;
    rollbackReason: string;
    rollbackScope: string;
    affectedBatches: number;
  };
  exceptions: Array<{
    serviceName: string;
    errorType: string;
    errorMessage: string;
    occurredAt: Date;
    resolved: boolean;
    resolvedAt?: Date;
    resolver?: string;
    beforeValue?: any;
    afterValue?: any;
  }>;
  responsiblePerson: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  createdAt: Date;
  updatedAt: Date;
}

const ReleaseReportSchema: Schema = new Schema({
  requestId: { type: String, required: true, unique: true, ref: 'ReleaseRequest' },
  reportId: { type: String, required: true, unique: true },
  generatedBy: { type: String, required: true },
  generatedAt: { type: Date, default: Date.now },
  overallStatus: {
    type: String,
    enum: ['success', 'partial_success', 'failed', 'rolled_back'],
    required: true
  },
  totalServices: { type: Number, default: 0 },
  successfulServices: { type: Number, default: 0 },
  failedServices: { type: Number, default: 0 },
  totalDowntime: { type: Number, default: 0 },
  maxDowntime: { type: Number, default: 0 },
  approvalSummary: {
    approverCount: { type: Number, default: 0 },
    approvedCount: { type: Number, default: 0 },
    rejectedCount: { type: Number, default: 0 }
  },
  grayBatchSummary: [{
    batchName: { type: String, required: true },
    targetPercentage: { type: Number, required: true },
    actualPercentage: { type: Number, required: true },
    status: { type: String, required: true },
    successRate: { type: Number, required: true }
  }],
  rollbackSummary: {
    hasRollback: { type: Boolean, default: false },
    rollbackReason: { type: String },
    rollbackScope: { type: String },
    affectedBatches: { type: Number, default: 0 }
  },
  exceptions: [{
    serviceName: { type: String, required: true },
    errorType: { type: String, required: true },
    errorMessage: { type: String, required: true },
    occurredAt: { type: Date, required: true },
    resolved: { type: Boolean, default: false },
    resolvedAt: { type: Date },
    resolver: { type: String },
    beforeValue: { type: Schema.Types.Mixed },
    afterValue: { type: Schema.Types.Mixed }
  }],
  responsiblePerson: { type: String, required: true },
  startTime: { type: Date, required: true },
  endTime: { type: Date },
  duration: { type: Number }
}, { timestamps: true });

export default mongoose.model<IReleaseReport>('ReleaseReport', ReleaseReportSchema);
