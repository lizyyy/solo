import mongoose from '../config/database';
import { LeadStatus, CustomerLevel, AssignmentReason } from '../types';

const assignmentRecordSchema = new mongoose.Schema({
  id: { type: String, required: true },
  salesId: { type: String, required: true },
  salesName: { type: String, required: true },
  reason: { 
    type: String, 
    enum: Object.values(AssignmentReason),
    required: true 
  },
  details: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  isReassignment: { type: Boolean, default: false },
  previousSalesId: { type: String }
}, { _id: false });

const leadSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  phone: { type: String, required: true, index: true },
  email: { type: String, index: true },
  company: { type: String },
  position: { type: String },
  region: { type: String },
  productInterest: { type: [String], default: [] },
  customerLevel: { 
    type: String, 
    enum: Object.values(CustomerLevel), 
    required: true 
  },
  source: { type: String, required: true },
  status: { 
    type: String, 
    enum: Object.values(LeadStatus), 
    default: LeadStatus.PENDING 
  },
  assignedTo: { type: String },
  assignmentHistory: { type: [assignmentRecordSchema], default: [] },
  duplicateOf: { type: String },
  isDuplicate: { type: Boolean, default: false },
  followUpStatus: { type: String },
  conversionDate: { type: Date },
  assignmentReason: { 
    type: String, 
    enum: Object.values(AssignmentReason)
  },
  assignmentDetails: { type: String },
  notes: { type: String }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

export const LeadModel = mongoose.model('Lead', leadSchema);
