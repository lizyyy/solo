const chalk = require('chalk');

const REQUIRED_FIELDS = [
  'id',
  'name',
  'address',
  'district',
  'flowWeight',
  'lastCleanTime',
  'supplyStock',
  'complaintCount'
];

const FLOW_WEIGHT_THRESHOLDS = {
  MIN: 0,
  MAX: 10,
  HIGH_RISK: 7,
  MEDIUM_RISK: 4
};

const MIN_SUPPLY_STOCK = 10;
const MAX_COMPLAINT_THRESHOLD = 3;

class Toilet {
  constructor(data, source = 'unknown') {
    this.data = data;
    this.source = source;
    this.errors = [];
    this.warnings = [];
    this.isValid = true;
    this.status = 'pending';
  }

  validate() {
    this.errors = [];
    this.warnings = [];

    const missingFields = REQUIRED_FIELDS.filter(field => 
      this.data[field] === undefined || this.data[field] === null || this.data[field] === ''
    );

    if (missingFields.length > 0) {
      this.errors.push({
        type: 'missing_field',
        message: `缺少必填字段: ${missingFields.join(', ')}`,
        fields: missingFields
      });
    }

    if (this.data.id !== undefined) {
      const idStr = String(this.data.id).trim();
      if (!idStr.match(/^T\d{6}$/)) {
        this.errors.push({
          type: 'invalid_id',
          message: `公厕编号格式错误，应为 T+6位数字 (如 T000001)，实际为: ${this.data.id}`,
          field: 'id',
          value: this.data.id
        });
      }
    }

    if (this.data.flowWeight !== undefined && this.data.flowWeight !== null && this.data.flowWeight !== '') {
      const fw = Number(this.data.flowWeight);
      if (isNaN(fw)) {
        this.errors.push({
          type: 'invalid_flow_weight',
          message: `人流权重必须为数字，实际为: ${this.data.flowWeight}`,
          field: 'flowWeight',
          value: this.data.flowWeight
        });
      } else if (fw < FLOW_WEIGHT_THRESHOLDS.MIN || fw > FLOW_WEIGHT_THRESHOLDS.MAX) {
        this.errors.push({
          type: 'flow_weight_out_of_range',
          message: `人流权重超出范围 [0-10]，实际为: ${fw}`,
          field: 'flowWeight',
          value: fw
        });
      }
    }

    if (this.data.lastCleanTime !== undefined && this.data.lastCleanTime !== null && this.data.lastCleanTime !== '') {
      const cleanTime = new Date(this.data.lastCleanTime);
      if (isNaN(cleanTime.getTime())) {
        this.errors.push({
          type: 'invalid_date',
          message: `上次清洁时间格式错误，应为 YYYY-MM-DD HH:mm:ss 或 ISO 格式，实际为: ${this.data.lastCleanTime}`,
          field: 'lastCleanTime',
          value: this.data.lastCleanTime
        });
      } else {
        const now = new Date();
        const hoursSinceClean = (now - cleanTime) / (1000 * 60 * 60);
        if (hoursSinceClean > 24) {
          this.warnings.push({
            type: 'clean_overdue',
            message: `超过 24 小时未清洁 (已 ${hoursSinceClean.toFixed(1)} 小时)`,
            field: 'lastCleanTime',
            value: hoursSinceClean
          });
        }
      }
    }

    if (this.data.supplyStock !== undefined && this.data.supplyStock !== null && this.data.supplyStock !== '') {
      const stock = Number(this.data.supplyStock);
      if (isNaN(stock)) {
        this.errors.push({
          type: 'invalid_supply',
          message: `补给库存必须为数字，实际为: ${this.data.supplyStock}`,
          field: 'supplyStock',
          value: this.data.supplyStock
        });
      } else if (stock < 0) {
        this.errors.push({
          type: 'negative_supply',
          message: `补给库存不能为负数，实际为: ${stock}`,
          field: 'supplyStock',
          value: stock
        });
      } else if (stock < MIN_SUPPLY_STOCK) {
        this.warnings.push({
          type: 'low_supply',
          message: `补给库存偏低 (${stock} 份，建议最小值 ${MIN_SUPPLY_STOCK} 份)`,
          field: 'supplyStock',
          value: stock
        });
      }
    }

    if (this.data.complaintCount !== undefined && this.data.complaintCount !== null && this.data.complaintCount !== '') {
      const complaints = Number(this.data.complaintCount);
      if (isNaN(complaints)) {
        this.errors.push({
          type: 'invalid_complaint',
          message: `投诉数量必须为数字，实际为: ${this.data.complaintCount}`,
          field: 'complaintCount',
          value: this.data.complaintCount
        });
      } else if (complaints < 0) {
        this.errors.push({
          type: 'negative_complaint',
          message: `投诉数量不能为负数，实际为: ${complaints}`,
          field: 'complaintCount',
          value: complaints
        });
      } else if (complaints >= MAX_COMPLAINT_THRESHOLD) {
        this.warnings.push({
          type: 'high_complaint',
          message: `投诉数量偏高 (${complaints} 次，已达到处理阈值)`,
          field: 'complaintCount',
          value: complaints
        });
      }
    }

    this.isValid = this.errors.length === 0;
    this.calculatePriority();

    return this.isValid;
  }

  calculatePriority() {
    if (!this.isValid) {
      this.priorityScore = -1;
      this.priorityLevel = 'invalid';
      return;
    }

    const fw = Number(this.data.flowWeight) || 0;
    const complaints = Number(this.data.complaintCount) || 0;
    const stock = Number(this.data.supplyStock) || 0;
    const cleanTime = this.data.lastCleanTime ? new Date(this.data.lastCleanTime) : null;
    const now = new Date();
    const hoursSinceClean = cleanTime ? (now - cleanTime) / (1000 * 60 * 60) : 24;

    let score = 0;
    score += fw * 10;
    score += complaints * 8;
    score += Math.max(0, 50 - stock * 2);
    score += Math.min(hoursSinceClean, 48) * 0.5;

    this.priorityScore = Math.round(score);

    if (fw >= FLOW_WEIGHT_THRESHOLDS.HIGH_RISK || complaints >= MAX_COMPLAINT_THRESHOLD) {
      this.priorityLevel = 'critical';
    } else if (fw >= FLOW_WEIGHT_THRESHOLDS.MEDIUM_RISK || hoursSinceClean > 12 || stock < MIN_SUPPLY_STOCK) {
      this.priorityLevel = 'high';
    } else {
      this.priorityLevel = 'normal';
    }
  }

  getSummary() {
    return {
      id: this.data.id,
      name: this.data.name,
      district: this.data.district,
      flowWeight: Number(this.data.flowWeight),
      complaintCount: Number(this.data.complaintCount),
      supplyStock: Number(this.data.supplyStock),
      lastCleanTime: this.data.lastCleanTime,
      priorityScore: this.priorityScore,
      priorityLevel: this.priorityLevel,
      errors: this.errors,
      warnings: this.warnings,
      isValid: this.isValid,
      source: this.source
    };
  }
}

module.exports = {
  Toilet,
  REQUIRED_FIELDS,
  FLOW_WEIGHT_THRESHOLDS,
  MIN_SUPPLY_STOCK,
  MAX_COMPLAINT_THRESHOLD
};
