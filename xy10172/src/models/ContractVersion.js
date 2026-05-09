const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const PARTY_STATUS = {
  PENDING: 'pending',
  SIGNED: 'signed',
  REJECTED: 'rejected'
};

const contractVersionSchema = new mongoose.Schema({
  _id: {
    type: String,
    default: () => `VER-${uuidv4().slice(0, 8).toUpperCase()}`
  },
  contractId: {
    type: String,
    required: true,
    index: true,
    ref: 'Contract'
  },
  version: {
    type: Number,
    required: true,
    index: true
  },
  contractNo: {
    type: String,
    required: true,
    index: true
  },
  title: {
    type: String,
    required: true
  },
  description: {
    type: String
  },
  status: {
    type: String,
    required: true
  },
  parties: [{
    _id: false,
    id: String,
    name: String,
    email: String,
    phone: String,
    status: {
      type: String,
      enum: Object.values(PARTY_STATUS),
      default: PARTY_STATUS.PENDING
    },
    signedAt: Date,
    signature: String,
    ip: String,
    userAgent: String
  }],
  pdfMetadata: {
    fileId: String,
    fileName: String,
    fileSize: Number,
    md5Hash: String,
    sha256Hash: String,
    pageCount: Number,
    pdfVersion: String,
    creationDate: Date,
    modificationDate: Date,
    author: String,
    producer: String,
    subject: String,
    keywords: [String],
    hasAttachments: Boolean,
    encrypted: Boolean
  },
  callbackUrl: String,
  initiator: {
    id: String,
    name: String,
    email: String
  },
  effectiveDate: Date,
  expirationDate: Date,
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  },
  isFrozen: {
    type: Boolean,
    default: false
  },
  frozenAt: Date,
  frozenBy: String,
  freezeReason: String,
  createdBy: String
}, {
  timestamps: true,
  versionKey: 'docVersion'
});

contractVersionSchema.index({ contractId: 1, version: 1 }, { unique: true });
contractVersionSchema.index({ contractNo: 1, version: 1 });
contractVersionSchema.index({ createdAt: -1 });
contractVersionSchema.index({ isFrozen: 1, createdAt: -1 });

contractVersionSchema.pre('save', function(next) {
  if (this.isFrozen && this.isModified('isFrozen')) {
    this.frozenAt = new Date();
  }
  next();
});

contractVersionSchema.methods.freeze = function(reason, userId) {
  if (this.isFrozen) {
    throw new Error('版本已冻结，无法重复冻结');
  }
  this.isFrozen = true;
  this.frozenAt = new Date();
  this.frozenBy = userId;
  this.freezeReason = reason;
  return this.save();
};

module.exports = mongoose.model('ContractVersion', contractVersionSchema);
