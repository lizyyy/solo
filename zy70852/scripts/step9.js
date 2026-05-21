const fs = require("fs");
const path = require("path");

const itemPath = path.join(__dirname, "../src/services/itemService.js");
let content = fs.readFileSync(itemPath, "utf-8");

const idx = content.lastIndexOf("}");
const before = content.substring(0, idx);
const after = content.substring(idx);

const newCode = `
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
`;

content = before + newCode + after;
fs.writeFileSync(itemPath, content);
console.log("添加了逾期检查、查询接口和导出方法");
