import mongoose from '../config/database';
import { CustomerLevel } from '../types';

const conditionsSchema = new mongoose.Schema({
  regions: { type: [String], default: [] },
  products: { type: [String], default: [] },
  customerLevels: { 
    type: [String], 
    enum: Object.values(CustomerLevel),
    default: [] 
  }
}, { _id: false });

const actionsSchema = new mongoose.Schema({
  assignTo: { type: [String], default: [] },
  autoAssign: { type: Boolean, default: true },
  needsReview: { type: Boolean, default: false }
}, { _id: false });

const assignmentRuleSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  description: { type: String },
  enabled: { type: Boolean, default: true },
  priority: { type: Number, default: 0 },
  conditions: { type: conditionsSchema, default: () => ({}) },
  actions: { type: actionsSchema, default: () => ({}) }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

export const AssignmentRuleModel = mongoose.model('AssignmentRule', assignmentRuleSchema);
