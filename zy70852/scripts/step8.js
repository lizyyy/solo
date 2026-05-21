const fs = require("fs");
const path = require("path");

const itemPath = path.join(__dirname, "../src/services/itemService.js");
let content = fs.readFileSync(itemPath, "utf-8");

const idx = content.lastIndexOf("}");
const before = content.substring(0, idx);
const after = content.substring(idx);

const newCode = `
  async traceVoucherSource(voucherNo) {
    const voucher = await this.getVoucherByNo(voucherNo);
    if (!voucher) {
      return null;
    }

    const itemId = voucher.item_id;
    const item = await this.getItemById(itemId);

    let batch = null;
    if (item && item.batch_id) {
      batch = await db.get(
        "SELECT * FROM batches WHERE id = ?",
        [item.batch_id]
      );
    }

    const images = await db.all(
      "SELECT * FROM image_index WHERE item_id = ?",
      [itemId]
    );

    const processingHistory = await db.all(
      "SELECT * FROM processing_history WHERE item_id = ? ORDER BY operator_time ASC",
      [itemId]
    );

    return {
      voucher: {
        voucherNo: voucher.voucher_no,
        issuer: voucher.issuer,
        issueTime: voucher.issue_time,
        expireTime: voucher.expire_time,
        status: voucher.status,
        usedTime: voucher.used_time
      },
      item: {
        id: item.id,
        itemNo: item.item_no,
        itemName: item.item_name,
        itemDescription: item.item_description,
        itemCategory: item.item_category,
        foundTime: item.found_time,
        foundLocation: item.found_location,
        routeNo: item.route_no,
        shiftNo: item.shift_no,
        driverName: item.driver_name,
        status: item.status,
        pickupTime: item.pickup_time,
        receiverName: item.receiver_name,
        hasSameName: item.has_same_name,
        sensitiveInfoMasked: item.sensitive_info_masked,
        isOverdue: item.is_overdue
      },
      batch: batch ? {
        batchNo: batch.batch_no,
        batchType: batch.batch_type,
        sourceFile: batch.source_file,
        createdBy: batch.created_by,
        createdAt: batch.created_at
      } : null,
      images: images.map(img => ({
        imageCode: img.image_code,
        filePath: img.file_path
      })),
      processingHistory: processingHistory.map(h => ({
        action: h.action,
        actionReason: h.action_reason,
        operator: h.operator,
        operatorTime: h.operator_time,
        oldStatus: h.old_status,
        newStatus: h.new_status,
        remark: h.remark
      })),
      traceSummary: {
        source: batch ? "批次导入: " + batch.batch_no : "手工录入",
        processingSteps: processingHistory.length,
        currentStatus: item.status,
        finalAction: processingHistory.length > 0 ? processingHistory[processingHistory.length - 1].action : "无处理记录"
      }
    };
  }

  async checkSameNameItems(operator) {
    const items = await db.all(
      "SELECT * FROM lost_items WHERE status NOT IN (?, ?)",
      ["picked_up", "completed"]
    );

    const nameMap = {};
    items.forEach(item => {
      const key = item.item_name.trim().toLowerCase();
      if (!nameMap[key]) {
        nameMap[key] = [];
      }
      nameMap[key].push(item);
    });

    const sameNameGroups = [];
    const updatedItemIds = [];

    for (const [name, group] of Object.entries(nameMap)) {
      if (group.length > 1) {
        sameNameGroups.push({
          itemName: name,
          count: group.length,
          items: group.map(i => ({ id: i.id, itemNo: i.item_no }))
        });

        for (const item of group) {
          if (!item.has_same_name) {
            await db.run(
              "UPDATE lost_items SET has_same_name = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
              [item.id]
            );

            await this.addProcessingHistory(
              item.id,
              "same_name_check",
              "检测到同名物品，共 " + group.length + " 件",
              operator || "system",
              item.status,
              item.status,
              "同名物品包括: " + group.map(i => i.item_no).join(", ")
            );

            updatedItemIds.push(item.id);
          }
        }
      }
    }

    return {
      sameNameGroups,
      totalGroups: sameNameGroups.length,
      totalItemsAffected: updatedItemIds.length,
      updatedItemIds
    };
  }

  async maskSensitiveInfo(itemId, operator, fieldsToMask) {
    const item = await this.getItemById(itemId);
    if (!item) {
      throw new Error("物品不存在");
    }

    const fields = fieldsToMask || ["driver_phone", "finder_phone", "receiver_phone", "receiver_id_card", "driver_name", "finder_name", "receiver_name"];
    const updates = {};
    const maskedFields = [];

    for (const field of fields) {
      if (item[field]) {
        if (field.includes("phone")) {
          updates[field] = maskPhone(item[field]);
          maskedFields.push(field);
        } else if (field.includes("id_card")) {
          updates[field] = maskIdCard(item[field]);
          maskedFields.push(field);
        } else if (field.includes("name")) {
          updates[field] = maskName(item[field]);
          maskedFields.push(field);
        }
      }
    }

    if (maskedFields.length === 0) {
      return {
        success: true,
        message: "没有需要脱敏的字段",
        itemId,
        maskedFields: []
      };
    }

    const setClauses = Object.keys(updates).map(key => key + " = ?").join(", ");
    const values = [...Object.values(updates), itemId];

    await db.run(
      "UPDATE lost_items SET " + setClauses + ", sensitive_info_masked = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      values
    );

    await this.addProcessingHistory(
      itemId,
      "mask_sensitive_info",
      "敏感信息脱敏处理",
      operator || "system",
      item.status,
      item.status,
      "脱敏字段: " + maskedFields.join(", ")
    );

    return {
      success: true,
      itemId,
      maskedFields,
      message: "已完成敏感信息脱敏"
    };
  }

  async batchMaskSensitiveInfo(itemIds, operator, fieldsToMask) {
    const results = [];
    for (const itemId of itemIds) {
      try {
        const result = await this.maskSensitiveInfo(itemId, operator, fieldsToMask);
        results.push(result);
      } catch (error) {
        results.push({ itemId, success: false, error: error.message });
      }
    }

    return {
      total: itemIds.length,
      successCount: results.filter(r => r.success).length,
      failCount: results.filter(r => !r.success).length,
      results
    };
  }
`;

content = before + newCode + after;
fs.writeFileSync(itemPath, content);
console.log("添加了溯源、同名物品检查、敏感信息脱敏方法");
