const moment = require("moment");
const { Parser } = require("json2csv");
const db = require("../models/database");
const importService = require("./importService");

function maskPhone(phone) {
  if (!phone) return phone;
  return phone.replace(/(\d{3})\d{4}(\d{4})/, "$1****$2");
}

function maskIdCard(idCard) {
  if (!idCard) return idCard;
  return idCard.replace(/(\d{6})\d{8}(\d{4})/, "$1********$2");
}

function maskName(name) {
  if (!name) return name;
  if (name.length <= 1) return name;
  return name[0] + "*".repeat(name.length - 1);
}

class ItemService {
  async addProcessingHistory(itemId, action, reason, operator, oldStatus, newStatus, remark) {
    await db.run(
      "INSERT INTO processing_history (item_id, action, action_reason, operator, old_status, new_status, remark) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [itemId, action, reason, operator, oldStatus, newStatus, remark || ""]
    );
  }

  async listItems(params) {
    const { status, routeNo, shiftNo, driverName, page = 1, pageSize = 20 } = params;
    const offset = (page - 1) * pageSize;
    let sql = "SELECT * FROM lost_items WHERE 1=1";
    let countSql = "SELECT COUNT(*) as count FROM lost_items WHERE 1=1";
    const values = [];
    const countValues = [];

    if (status) {
      sql += " AND status = ?";
      countSql += " AND status = ?";
      values.push(status);
      countValues.push(status);
    }
    if (routeNo) {
      sql += " AND route_no = ?";
      countSql += " AND route_no = ?";
      values.push(routeNo);
      countValues.push(routeNo);
    }
    if (shiftNo) {
      sql += " AND shift_no = ?";
      countSql += " AND shift_no = ?";
      values.push(shiftNo);
      countValues.push(shiftNo);
    }
    if (driverName) {
      sql += " AND driver_name = ?";
      countSql += " AND driver_name = ?";
      values.push(driverName);
      countValues.push(driverName);
    }

    sql += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
    values.push(pageSize, offset);

    const items = await db.all(sql, values);
    const totalResult = await db.get(countSql, countValues);

    return {
      list: items,
      total: totalResult.count,
      page: parseInt(page),
      pageSize: parseInt(pageSize)
    };
  }

  async getItemById(itemId) {
    const item = await db.get("SELECT * FROM lost_items WHERE id = ?", [itemId]);
    if (item) {
      const history = await db.all(
        "SELECT * FROM processing_history WHERE item_id = ? ORDER BY operator_time DESC",
        [itemId]
      );
      item.history = history;
    }
    return item;
  }

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

  async issuePickupVoucher(itemId, issuer, expireDays) {
    const item = await this.getItemById(itemId);
    if (!item) {
      throw new Error("物品不存在");
    }
    if (item.status !== "completed") {
      throw new Error("物品未完成处理，无法开具领取凭证");
    }
    if (item.pickup_voucher_no) {
      throw new Error("该物品已开具领取凭证");
    }

    const voucherNo = "VOUCHER" + moment().format("YYYYMMDDHHmmss") + Math.floor(Math.random() * 1000);
    const expireTime = moment().add(expireDays || 7, "days").format("YYYY-MM-DD HH:mm:ss");

    await db.run(
      "INSERT INTO pickup_vouchers (voucher_no, item_id, item_name, issuer, expire_time) VALUES (?, ?, ?, ?, ?)",
      [voucherNo, itemId, item.item_name, issuer, expireTime]
    );

    await db.run(
      "UPDATE lost_items SET pickup_voucher_no = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [voucherNo, itemId]
    );

    await this.addProcessingHistory(
      itemId,
      "issue_voucher",
      "开具领取凭证",
      issuer,
      item.status,
      item.status,
      "凭证号: " + voucherNo + ", 有效期: " + expireDays + "天"
    );

    return {
      voucherNo,
      itemId,
      itemName: item.item_name,
      issuer,
      expireTime,
      status: "valid"
    };
  }

  async pickupItem(voucherNo, receiverName, receiverPhone, receiverIdCard, operator) {
    const voucher = await db.get(
      "SELECT * FROM pickup_vouchers WHERE voucher_no = ?",
      [voucherNo]
    );
    if (!voucher) {
      throw new Error("凭证不存在");
    }
    if (voucher.status !== "valid") {
      throw new Error("凭证状态无效");
    }
    if (moment(voucher.expire_time).isBefore(moment())) {
      throw new Error("凭证已过期");
    }

    const item = await this.getItemById(voucher.item_id);
    if (!item) {
      throw new Error("物品不存在");
    }

    await db.beginTransaction();
    try {
      await db.run(
        "UPDATE pickup_vouchers SET status = ?, used_time = CURRENT_TIMESTAMP WHERE voucher_no = ?",
        ["used", voucherNo]
      );

      const pickupTime = moment().format("YYYY-MM-DD HH:mm:ss");
      await db.run(
        "UPDATE lost_items SET status = ?, pickup_time = ?, receiver_name = ?, receiver_phone = ?, receiver_id_card = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        ["picked_up", pickupTime, receiverName, receiverPhone, receiverIdCard, item.id]
      );

      await this.addProcessingHistory(
        item.id,
        "pickup",
        "物品已领取",
        operator,
        item.status,
        "picked_up",
        "领取人: " + receiverName + ", 凭证号: " + voucherNo
      );

      await db.commit();

      return {
        success: true,
        voucherNo,
        itemId: item.id,
        itemName: item.item_name,
        pickupTime,
        receiverName
      };
    } catch (error) {
      await db.rollback();
      throw error;
    }
  }

  async getVoucherByNo(voucherNo) {
    const voucher = await db.get(
      "SELECT * FROM pickup_vouchers WHERE voucher_no = ?",
      [voucherNo]
    );
    if (voucher) {
      const item = await db.get(
        "SELECT * FROM lost_items WHERE id = ?",
        [voucher.item_id]
      );
      voucher.item = item;
    }
    return voucher;
  }

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

  async checkOverdueItems(overdueDays, operator) {
    const days = overdueDays || 30;
    const cutoffDate = moment().subtract(days, "days").format("YYYY-MM-DD HH:mm:ss");

    const items = await db.all(
      "SELECT * FROM lost_items WHERE status NOT IN (?, ?) AND found_time < ? AND is_overdue = 0",
      ["picked_up", "completed", cutoffDate]
    );

    const updatedItemIds = [];

    for (const item of items) {
      await db.run(
        "UPDATE lost_items SET is_overdue = 1, overdue_days = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        [days, item.id]
      );

      await this.addProcessingHistory(
        item.id,
        "overdue_check",
        "物品逾期无人领取，已逾期 " + days + " 天",
        operator || "system",
        item.status,
        item.status,
        "入库时间: " + item.found_time + ", 逾期天数: " + days
      );

      updatedItemIds.push(item.id);
    }

    return {
      totalOverdue: items.length,
      overdueDays: days,
      updatedItemIds,
      items: items.map(i => ({ id: i.id, itemNo: i.item_no, itemName: i.item_name, foundTime: i.found_time }))
    };
  }

  async getItemsByRoute(routeNo, shiftNo) {
    let sql = "SELECT * FROM lost_items WHERE route_no = ?";
    const values = [routeNo];

    if (shiftNo) {
      sql += " AND shift_no = ?";
      values.push(shiftNo);
    }

    sql += " ORDER BY found_time DESC";

    const items = await db.all(sql, values);

    const schedule = await db.get(
      "SELECT * FROM route_schedules WHERE route_no = ? AND shift_no = ? LIMIT 1",
      [routeNo, shiftNo || ""]
    );

    return {
      routeNo,
      shiftNo,
      schedule: schedule || null,
      total: items.length,
      items
    };
  }

  async getItemsByDriver(driverName) {
    const items = await db.all(
      "SELECT * FROM lost_items WHERE driver_name = ? ORDER BY found_time DESC",
      [driverName]
    );

    const schedules = await db.all(
      "SELECT DISTINCT route_no, shift_no, vehicle_no FROM route_schedules WHERE driver_name = ?",
      [driverName]
    );

    return {
      driverName,
      total: items.length,
      schedules,
      items
    };
  }

  async exportItems(params) {
    const { status, routeNo, shiftNo, driverName, maskSensitive = true } = params;
    let sql = "SELECT * FROM lost_items WHERE 1=1";
    const values = [];

    if (status) {
      sql += " AND status = ?";
      values.push(status);
    }
    if (routeNo) {
      sql += " AND route_no = ?";
      values.push(routeNo);
    }
    if (shiftNo) {
      sql += " AND shift_no = ?";
      values.push(shiftNo);
    }
    if (driverName) {
      sql += " AND driver_name = ?";
      values.push(driverName);
    }

    sql += " ORDER BY created_at DESC";

    const items = await db.all(sql, values);

    const processedItems = items.map(item => {
      const processed = { ...item };
      if (maskSensitive || item.sensitive_info_masked) {
        if (processed.driver_phone) processed.driver_phone = maskPhone(processed.driver_phone);
        if (processed.finder_phone) processed.finder_phone = maskPhone(processed.finder_phone);
        if (processed.receiver_phone) processed.receiver_phone = maskPhone(processed.receiver_phone);
        if (processed.receiver_id_card) processed.receiver_id_card = maskIdCard(processed.receiver_id_card);
        if (processed.driver_name) processed.driver_name = maskName(processed.driver_name);
        if (processed.finder_name) processed.finder_name = maskName(processed.finder_name);
        if (processed.receiver_name) processed.receiver_name = maskName(processed.receiver_name);
      }
      return processed;
    });

    const fields = [
      "id", "item_no", "item_name", "item_description", "item_category",
      "found_time", "found_location", "route_no", "shift_no",
      "driver_name", "driver_phone", "finder_name", "finder_phone",
      "status", "pickup_voucher_no", "pickup_time",
      "receiver_name", "receiver_phone", "receiver_id_card",
      "is_overdue", "overdue_days", "has_same_name", "sensitive_info_masked",
      "created_at", "updated_at"
    ];

    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(processedItems);

    return csv;
  }
}

module.exports = new ItemService();
