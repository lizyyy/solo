const storage = require('./storage');
const errorHandler = require('./errorHandler');

class Reviewer {
  review() {
    const applications = storage.getApplications();
    const inventory = storage.getInventory();
    const hazardRules = storage.getHazardRules();

    const results = [];
    const issues = [];

    applications.forEach((app, index) => {
      const result = {
        application: app,
        inventoryCheck: null,
        hazardCheck: null,
        approvalCheck: null,
        status: 'pending',
        issues: []
      };

      const inventoryItem = inventory.find(
        item => item.reagentName === app.reagentName
      );

      if (inventoryItem) {
        const sufficient = inventoryItem.quantity >= app.quantity;
        result.inventoryCheck = {
          found: true,
          currentStock: inventoryItem.quantity,
          requested: app.quantity,
          sufficient
        };
        if (!sufficient) {
          result.issues.push({
            type: 'inventory_insufficient',
            message: `库存不足：当前库存 ${inventoryItem.quantity}，申请 ${app.quantity}`,
            suggestion: '请减少申请数量或补充库存'
          });
        }
      } else {
        result.inventoryCheck = { found: false };
        result.issues.push({
          type: 'inventory_not_found',
          message: `试剂 "${app.reagentName}" 在库存中未找到`,
          suggestion: '请检查试剂名称是否正确，或先导入该试剂的库存信息'
        });
      }

      const hazardRule = hazardRules.find(
        rule => rule.reagentName === app.reagentName
      );

      if (hazardRule) {
        result.hazardCheck = {
          found: true,
          hazardLevel: hazardRule.hazardLevel,
          requiresApproval: hazardRule.requiresApproval,
          maxQuantity: hazardRule.maxQuantity
        };

        if (hazardRule.requiresApproval && !app.approved) {
          result.issues.push({
            type: 'approval_missing',
            message: `该试剂(${hazardRule.hazardLevel}危)需要审批，但申请单未标记审批`,
            suggestion: '请联系管理员进行审批，或在申请单中标记 approved=true'
          });
        }

        if (app.quantity > hazardRule.maxQuantity) {
          result.issues.push({
            type: 'quantity_exceeds_max',
            message: `申请数量(${app.quantity})超过该危化品最大申领限额(${hazardRule.maxQuantity})`,
            suggestion: `请将申请数量减少到 ${hazardRule.maxQuantity} 以下`
          });
        }
      } else {
        result.hazardCheck = { found: false };
        result.issues.push({
          type: 'hazard_rule_not_found',
          message: `试剂 "${app.reagentName}" 未找到危化品规则`,
          suggestion: '请导入该试剂的危化品规则信息，或确认试剂名称'
        });
      }

      result.approvalCheck = {
        approved: app.approved,
        approver: app.approver || '未指定'
      };

      if (result.issues.length === 0) {
        result.status = 'passed';
      } else if (result.issues.some(i => 
        ['inventory_not_found', 'hazard_rule_not_found', 'inventory_insufficient'].includes(i.type)
      )) {
        result.status = 'failed';
      } else {
        result.status = 'warning';
      }

      results.push(result);

      result.issues.forEach(issue => {
        errorHandler.recordError({
          source: 'review',
          rowNumber: index + 1,
          originalData: app,
          errorType: issue.type,
          errorMessage: issue.message,
          suggestion: issue.suggestion
        });
      });
    });

    const reviewResult = {
      totalApplications: applications.length,
      passed: results.filter(r => r.status === 'passed').length,
      warning: results.filter(r => r.status === 'warning').length,
      failed: results.filter(r => r.status === 'failed').length,
      details: results
    };

    storage.addReviewResult(reviewResult);
    return reviewResult;
  }

  getReviewHistory() {
    return storage.getReviewResults();
  }
}

module.exports = new Reviewer();
