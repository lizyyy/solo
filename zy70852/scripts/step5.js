const fs = require("fs");
const path = require("path");

const itemPath = path.join(__dirname, "../src/services/itemService.js");
let content = fs.readFileSync(itemPath, "utf-8");

const idx = content.lastIndexOf("}");
const before = content.substring(0, idx);
const after = content.substring(idx);

const newCode = `
  async listItems(params) {
    const { status, routeNo, shiftNo, driverName, page = 1, pageSize = 20 } = params;
    const offset = (page - 1) * pageSize;
    let sql = "SELECT * FROM lost_items WHERE 1=1";
    const countSql = "SELECT COUNT(*) as count FROM lost_items WHERE 1=1";
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
`;

content = before + newCode + after;
fs.writeFileSync(itemPath, content);
console.log("添加了 listItems 和 getItemById 方法");
