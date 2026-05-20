const mongoose = require('mongoose');

const userPermissionSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  username: {
    type: String,
    required: true
  },
  department: String,
  position: String,
  maxSecurityLevel: {
    type: String,
    enum: ['公开', '内部', '秘密', '机密', '绝密'],
    default: '内部'
  },
  canBorrow: {
    type: Boolean,
    default: true
  },
  canApprove: {
    type: Boolean,
    default: false
  },
  maxBorrowCount: {
    type: Number,
    default: 10
  },
  currentBorrowCount: {
    type: Number,
    default: 0
  },
  permissions: [String],
  status: {
    type: String,
    enum: ['正常', '禁用', '注销'],
    default: '正常'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

userPermissionSchema.index({ department: 1 });
userPermissionSchema.index({ status: 1 });

module.exports = mongoose.model('UserPermission', userPermissionSchema);
