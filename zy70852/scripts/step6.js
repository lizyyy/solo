const fs = require("fs");
const path = require("path");

const itemPath = path.join(__dirname, "../src/services/itemService.js");
let content = fs.readFileSync(itemPath, "utf-8");

const idx = content.lastIndexOf("}");
const before = content.substring(0, idx);
const after = content.substring(idx);

const newCode = `
  async processItem(itemId, action, reason, operator, remark) {
    const item = await this.getItemById(itemId);
    if (!item) {
      throw new Error("物品不存在");
    }

    const oldStatus = item.status;
    let newStatus = oldStatus;

    if (action === "process") {
      newStatus = "processing";
    } else if (action === "complete") {
      newStatus = "completed";
    } else if (action === "return") {
      newStatus = "pending";
    } else if (action === "pickup") {
      newStatus = "picked_up";
    }

    await db.run(
      "UPDATE lost_items SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [newStatus, itemId]
    );

    await this.addProcessingHistory(
      itemId,
      action,
      reason,
      operator,
      oldStatus,
      newStatus,
      remark
    );

    return { success: true, itemId, oldStatus, newStatus };
  }

  async returnForModification(itemId, reason, operator) {
    return this.processItem(itemId, "return", reason, operator, "退回修改，需要补充材料");
  }

  async markProcessed(itemId, reason, operator) {
    return this.processItem(itemId, "process", reason, operator, "标记处理中");
  }

  async markCompleted(itemId, reason, operator) {
    return this.processItem(itemId, "complete", reason, operator, "处理完成，记录已放行");
  }
`;

content = before + newCode + after;
fs.writeFileSync(itemPath, content);
console.log("添加了物品处理相关方法");
