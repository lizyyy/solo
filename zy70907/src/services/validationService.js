const moment = require("moment");
const db = require("../database");

const REQUIRED_FIELDS = ["member_phone", "transaction_no", "transaction_time", "points"];
const BLOCKED_CATEGORIES = ["奶粉", "纸尿裤", "婴儿车", "安全座椅"];
const MAX_POINTS_PER_TRANSACTION = 5000;

class ValidationService {
  static validatePointData(data) {
    const result = {
      status: "normal",
      reasons: [],
      nextAction: "auto_write_back",
      missingFields: [],
      hasError: false
    };
    for (const field of REQUIRED_FIELDS) {
      if (!data[field] || String(data[field]).trim() === "") {
        result.missingFields.push(field);
        result.hasError = true;
      }
    }
    if (result.missingFields.length > 0) {
      result.status = "pending";
      result.reasons.push("缺少必填字段: " + result.missingFields.join(", "));
      result.nextAction = "supplement_info";
    }
    if (data.transaction_time) {
      const transTime = moment(data.transaction_time);
      if (!transTime.isValid()) {
        result.status = "blocked";
        result.reasons.push("交易时间格式无效");
        result.nextAction = "manual_review";
        result.hasError = true;
      } else if (transTime.isAfter(moment())) {
        result.status = "blocked";
        result.reasons.push("交易时间晚于当前时间");
        result.nextAction = "manual_review";
        result.hasError = true;
      }
    }
    if (data.points) {
      const points = parseInt(data.points);
      if (isNaN(points) || points < 0) {
        result.status = "blocked";
        result.reasons.push("积分数值无效");
        result.nextAction = "manual_review";
        result.hasError = true;
      } else if (points > MAX_POINTS_PER_TRANSACTION) {
        result.status = "pending";
        result.reasons.push("积分超过单笔上限，需主管审批");
        result.nextAction = "supervisor_approval";
        result.hasError = true;
      }
    }
    if (data.product_category) {
      const category = String(data.product_category).trim();
      if (BLOCKED_CATEGORIES.includes(category)) {
        result.status = "pending";
        result.reasons.push("商品分类" + category + "需人工审核");
        result.nextAction = "category_review";
        result.hasError = true;
      }
    }
    if (result.reasons.length === 0) {
      result.reasons.push("数据验证通过");
    }
    return result;
  }

  static async checkDuplicateTransaction(transactionNo, batchId) {
    return new Promise((resolve, reject) => {
      db.get(
        "SELECT COUNT(*) as count FROM point_details WHERE transaction_no = ? AND batch_id != ? AND status != \"blocked\"",
        [transactionNo, batchId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row.count > 0);
        }
      );
    });
  }

  static getNextActionDescription(action) {
    const actions = {
      "auto_write_back": "自动回写会员积分系统",
      "supplement_info": "补充缺失字段信息",
      "manual_review": "提交人工审核",
      "supervisor_approval": "主管审批",
      "category_review": "特殊商品分类审核"
    };
    return actions[action] || action;
  }
}

module.exports = ValidationService;
