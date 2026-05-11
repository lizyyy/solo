const REQUIRED_FIELDS = [
  'id',
  'toiletId',
  'complaintTime',
  'complaintType',
  'description',
  'status'
];

const VALID_TYPES = ['异味', '卫生差', '设备故障', '无纸', '缺水', '其他'];
const VALID_STATUSES = ['待处理', '处理中', '已解决', '已关闭'];

class Complaint {
  constructor(data, source = 'unknown') {
    this.data = data;
    this.source = source;
    this.errors = [];
    this.warnings = [];
    this.isValid = true;
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

    if (this.data.toiletId !== undefined) {
      const idStr = String(this.data.toiletId).trim();
      if (!idStr.match(/^T\d{6}$/)) {
        this.errors.push({
          type: 'invalid_toilet_id',
          message: `关联公厕编号格式错误，应为 T+6位数字 (如 T000001)，实际为: ${this.data.toiletId}`,
          field: 'toiletId',
          value: this.data.toiletId
        });
      }
    }

    if (this.data.complaintType !== undefined && this.data.complaintType !== null && this.data.complaintType !== '') {
      if (!VALID_TYPES.includes(this.data.complaintType)) {
        this.errors.push({
          type: 'invalid_complaint_type',
          message: `投诉类型无效，应为: ${VALID_TYPES.join(' / ')}，实际为: ${this.data.complaintType}`,
          field: 'complaintType',
          value: this.data.complaintType
        });
      }
    }

    if (this.data.status !== undefined && this.data.status !== null && this.data.status !== '') {
      if (!VALID_STATUSES.includes(this.data.status)) {
        this.errors.push({
          type: 'invalid_status',
          message: `状态无效，应为: ${VALID_STATUSES.join(' / ')}，实际为: ${this.data.status}`,
          field: 'status',
          value: this.data.status
        });
      }
    }

    if (this.data.complaintTime !== undefined && this.data.complaintTime !== null && this.data.complaintTime !== '') {
      const time = new Date(this.data.complaintTime);
      if (isNaN(time.getTime())) {
        this.errors.push({
          type: 'invalid_date',
          message: `投诉时间格式错误，应为 YYYY-MM-DD HH:mm:ss 或 ISO 格式，实际为: ${this.data.complaintTime}`,
          field: 'complaintTime',
          value: this.data.complaintTime
        });
      }
    }

    this.isValid = this.errors.length === 0;
    return this.isValid;
  }

  getSummary() {
    return {
      id: this.data.id,
      toiletId: this.data.toiletId,
      complaintTime: this.data.complaintTime,
      complaintType: this.data.complaintType,
      description: this.data.description,
      status: this.data.status,
      errors: this.errors,
      warnings: this.warnings,
      isValid: this.isValid,
      source: this.source
    };
  }
}

module.exports = {
  Complaint,
  REQUIRED_FIELDS,
  VALID_TYPES,
  VALID_STATUSES
};
