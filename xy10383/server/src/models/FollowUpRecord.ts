import mongoose from '../config/database';

const followUpRecordSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  leadId: { type: String, required: true, index: true },
  salesId: { type: String, required: true },
  salesName: { type: String, required: true },
  status: { type: String, required: true },
  notes: { type: String },
  followUpDate: { type: Date, default: Date.now },
  nextFollowUpDate: { type: Date }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

export const FollowUpRecordModel = mongoose.model('FollowUpRecord', followUpRecordSchema);
