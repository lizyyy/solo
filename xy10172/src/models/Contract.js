const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const SIGN_STATUSES = {
  DRAFT: 'draft',
  INITIATED: 'initiated',
  IN_SIGNING: 'in_signing',
  PARTIALLY_SIGNED: 'partially_signed',
  WITHDRAWN: 'withdrawn',
  REJECTED: 'rejected',
  COMPLETED: 'completed',
  REINITIATED: 'reinitiated'
};

const PARTY_STATUS = {
  PENDING: 'pending',
  SIGNED: 'signed',
  REJECTED: 'rejected'
};

const contractSchema = new mongoose.Schema({
  _id: {
    type: String,
    default: () => `CTR-${uuidv4().slice(0, 8).toUpperCase()}`
  },
  contractNo: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  title: {
    type: String,
    required: true
  },
  description: {
    type: String
  },
  currentVersion: {
    type: Number,
    default: 1
  },
  status: {
    type: String,
    enum: Object.values(SIGN_STATUSES),
    default: SIGN_STATUSES.DRAFT,
    index: true
  },
  previousStatus: {
    type: String,
    enum: Object.values(SIGN_STATUSES)
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
  versionHistory: [{
    _id: false,
    version: Number,
    status: String,
    changedAt: Date,
    changedBy: String,
    reason: String
  }],
  lastOperationId: String,
  isDeleted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true,
  versionKey: 'docVersion'
});

contractSchema.index({ contractNo: 1, status: 1 });
contractSchema.index({ createdAt: -1 });
contractSchema.index({ 'parties.email': 1 });
contractSchema.index({ 'initiator.id': 1 });

contractSchema.statics.getStatuses = () => SIGN_STATUSES;
contractSchema.statics.getPartyStatuses = () => PARTY_STATUS;

module.exports = mongoose.model('Contract', contractSchema);
