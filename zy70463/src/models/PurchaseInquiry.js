const mongoose = require('mongoose');

const inquiryItemSchema = new mongoose.Schema({
  lineNumber: { type: Number, required: true },
  itemName: { type: String, required: true },
  specification: { type: String },
  quantity: { type: Number, required: true },
  unit: { type: String, required: true },
  estimatedPrice: { type: Number },
  manualRemark: { type: String },
  reservationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Reservation' }
});

const purchaseInquirySchema = new mongoose.Schema({
  inquiryNo: { type: String, unique: true, required: true },
  title: { type: String, required: true },
  applicant: { type: String, required: true },
  applicantDepartment: { type: String, required: true },
  items: [inquiryItemSchema],
  overallRemark: { type: String },
  status: {
    type: String,
    enum: ['draft', 'submitted', 'approved', 'rejected'],
    default: 'draft'
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

purchaseInquirySchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

purchaseInquirySchema.index({ inquiryNo: 1 });
purchaseInquirySchema.index({ 'items.lineNumber': 1 });

module.exports = mongoose.model('PurchaseInquiry', purchaseInquirySchema);
