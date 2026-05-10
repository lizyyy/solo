import mongoose from '../config/database';

const statsSchema = new mongoose.Schema({
  pending: { type: Number, default: 0 },
  following: { type: Number, default: 0 },
  converted: { type: Number, default: 0 },
  rejected: { type: Number, default: 0 },
  total: { type: Number, default: 0 }
}, { _id: false });

const salesPersonSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  regions: { type: [String], default: [] },
  productExpertise: { type: [String], default: [] },
  maxLoad: { type: Number, default: 10 },
  currentLoad: { type: Number, default: 0 },
  isOnVacation: { type: Boolean, default: false },
  vacationStart: { type: Date },
  vacationEnd: { type: Date },
  stats: { type: statsSchema, default: () => ({}) }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

export const SalesPersonModel = mongoose.model('SalesPerson', salesPersonSchema);
