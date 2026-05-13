import mongoose, { Document, Schema } from 'mongoose';

export interface IApprovalOpinion extends Document {
  requestId: string;
  approver: string;
  approverRole: string;
  opinion: 'approved' | 'rejected' | 'need_modification';
  comments: string;
  approvalTime: Date;
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

const ApprovalOpinionSchema: Schema = new Schema({
  requestId: { type: String, required: true, ref: 'ReleaseRequest' },
  approver: { type: String, required: true },
  approverRole: { type: String, required: true },
  opinion: {
    type: String,
    enum: ['approved', 'rejected', 'need_modification'],
    required: true
  },
  comments: { type: String, required: true },
  approvalTime: { type: Date, default: Date.now },
  changeHistory: [{
    field: { type: String, required: true },
    oldValue: { type: Schema.Types.Mixed },
    newValue: { type: Schema.Types.Mixed },
    modifiedBy: { type: String, required: true },
    modifiedAt: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

export default mongoose.model<IApprovalOpinion>('ApprovalOpinion', ApprovalOpinionSchema);
