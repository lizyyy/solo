const { Sequelize, DataTypes, Op } = require('sequelize');
const path = require('path');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, '../../database/database.sqlite'),
  logging: false
});

const Stall = sequelize.define('Stall', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  code: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  ownerName: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  phone: {
    type: DataTypes.STRING(20)
  },
  area: {
    type: DataTypes.STRING(50)
  },
  baseDiscountRate: {
    type: DataTypes.FLOAT,
    defaultValue: 1.0,
    comment: '基础优惠率，1.0表示无优惠，0.9表示9折'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
});

const Inspection = sequelize.define('Inspection', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  inspectionNo: {
    type: DataTypes.STRING(50),
    unique: true,
    allowNull: false
  },
  stallId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  inspector: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  inspectionDate: {
    type: DataTypes.DATE,
    allowNull: false
  },
  month: {
    type: DataTypes.STRING(7),
    allowNull: false,
    comment: 'YYYY-MM格式，用于月份统计'
  },
  status: {
    type: DataTypes.ENUM('pending', 'deducted', 'complained', 'rectified', 'reviewed', 'closed'),
    defaultValue: 'pending'
  },
  isLocked: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: '历史月份数据锁定，防止篡改'
  },
  remark: {
    type: DataTypes.TEXT
  }
});

const Deduction = sequelize.define('Deduction', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  deductionNo: {
    type: DataTypes.STRING(50),
    unique: true,
    allowNull: false
  },
  inspectionId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  stallId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  reason: {
    type: DataTypes.STRING(200),
    allowNull: false
  },
  points: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 1,
      max: 100
    }
  },
  category: {
    type: DataTypes.STRING(50),
    comment: '扣分类别：卫生、秩序、安全等'
  },
  month: {
    type: DataTypes.STRING(7),
    allowNull: false
  },
  isReversed: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: '是否被撤销（投诉成功）'
  },
  reversedReason: {
    type: DataTypes.STRING(200)
  },
  reversedAt: {
    type: DataTypes.DATE
  }
});

const Complaint = sequelize.define('Complaint', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  complaintNo: {
    type: DataTypes.STRING(50),
    unique: true,
    allowNull: false
  },
  inspectionId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  stallId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  complainant: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  reason: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('pending', 'processing', 'upheld', 'rejected'),
    defaultValue: 'pending'
  },
  handler: {
    type: DataTypes.STRING(50)
  },
  handleResult: {
    type: DataTypes.TEXT
  },
  handledAt: {
    type: DataTypes.DATE
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: Sequelize.NOW
  }
});

const Rectification = sequelize.define('Rectification', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  rectificationNo: {
    type: DataTypes.STRING(50),
    unique: true,
    allowNull: false
  },
  inspectionId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  stallId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  requirement: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  deadline: {
    type: DataTypes.DATE,
    allowNull: false
  },
  submittedAt: {
    type: DataTypes.DATE
  },
  submitDescription: {
    type: DataTypes.TEXT
  },
  status: {
    type: DataTypes.ENUM('pending', 'submitted', 'reviewed'),
    defaultValue: 'pending'
  }
});

const Review = sequelize.define('Review', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  reviewNo: {
    type: DataTypes.STRING(50),
    unique: true,
    allowNull: false
  },
  rectificationId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  inspectionId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  stallId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  reviewer: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  result: {
    type: DataTypes.ENUM('pass', 'fail'),
    allowNull: false
  },
  remark: {
    type: DataTypes.TEXT
  },
  pointsReturned: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '复核通过返还的分数'
  },
  reviewedAt: {
    type: DataTypes.DATE,
    defaultValue: Sequelize.NOW
  }
});

const DiscountAdjustment = sequelize.define('DiscountAdjustment', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  adjustmentNo: {
    type: DataTypes.STRING(50),
    unique: true,
    allowNull: false
  },
  stallId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  month: {
    type: DataTypes.STRING(7),
    allowNull: false
  },
  sourceType: {
    type: DataTypes.ENUM('deduction', 'complaint_reversal', 'review_pass', 'manual', 'recalculation'),
    allowNull: false,
    comment: '调整来源类型'
  },
  sourceId: {
    type: DataTypes.STRING(50),
    comment: '关联的来源ID（扣分ID、投诉ID等）'
  },
  sourceDescription: {
    type: DataTypes.STRING(200),
    allowNull: false,
    comment: '调整来源描述'
  },
  beforeRate: {
    type: DataTypes.FLOAT,
    allowNull: false
  },
  afterRate: {
    type: DataTypes.FLOAT,
    allowNull: false
  },
  pointsChange: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  totalPoints: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '当前累计扣分'
  },
  operator: {
    type: DataTypes.STRING(50)
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: Sequelize.NOW
  }
});

const MonthlyDiscount = sequelize.define('MonthlyDiscount', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  stallId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  month: {
    type: DataTypes.STRING(7),
    allowNull: false
  },
  totalPoints: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  discountRate: {
    type: DataTypes.FLOAT,
    allowNull: false
  },
  isEligible: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: '是否有资格享受优惠'
  },
  maxPointsLimit: {
    type: DataTypes.INTEGER,
    defaultValue: 20,
    comment: '扣分上限，超过则取消优惠'
  },
  isCalculated: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  calculatedAt: {
    type: DataTypes.DATE
  },
  isLocked: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: '历史月份数据锁定'
  }
}, {
  indexes: [
    {
      unique: true,
      fields: ['stallId', 'month']
    }
  ]
});

Stall.hasMany(Inspection, { foreignKey: 'stallId' });
Inspection.belongsTo(Stall, { foreignKey: 'stallId' });

Stall.hasMany(Deduction, { foreignKey: 'stallId' });
Deduction.belongsTo(Stall, { foreignKey: 'stallId' });
Inspection.hasMany(Deduction, { foreignKey: 'inspectionId' });
Deduction.belongsTo(Inspection, { foreignKey: 'inspectionId' });

Stall.hasMany(Complaint, { foreignKey: 'stallId' });
Complaint.belongsTo(Stall, { foreignKey: 'stallId' });
Inspection.hasMany(Complaint, { foreignKey: 'inspectionId' });
Complaint.belongsTo(Inspection, { foreignKey: 'inspectionId' });

Stall.hasMany(Rectification, { foreignKey: 'stallId' });
Rectification.belongsTo(Stall, { foreignKey: 'stallId' });
Inspection.hasMany(Rectification, { foreignKey: 'inspectionId' });
Rectification.belongsTo(Inspection, { foreignKey: 'inspectionId' });

Stall.hasMany(Review, { foreignKey: 'stallId' });
Review.belongsTo(Stall, { foreignKey: 'stallId' });
Rectification.hasOne(Review, { foreignKey: 'rectificationId' });
Review.belongsTo(Rectification, { foreignKey: 'rectificationId' });
Inspection.hasMany(Review, { foreignKey: 'inspectionId' });
Review.belongsTo(Inspection, { foreignKey: 'inspectionId' });

Stall.hasMany(DiscountAdjustment, { foreignKey: 'stallId' });
DiscountAdjustment.belongsTo(Stall, { foreignKey: 'stallId' });

Stall.hasMany(MonthlyDiscount, { foreignKey: 'stallId' });
MonthlyDiscount.belongsTo(Stall, { foreignKey: 'stallId' });

module.exports = {
  sequelize,
  Sequelize,
  Op,
  Stall,
  Inspection,
  Deduction,
  Complaint,
  Rectification,
  Review,
  DiscountAdjustment,
  MonthlyDiscount
};
