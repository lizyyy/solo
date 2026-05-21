const fs = require("fs");
const path = require("path");

const importPath = path.join(__dirname, "../src/services/importService.js");
let content = fs.readFileSync(importPath, "utf-8");

const idx = content.lastIndexOf("}");
const before = content.substring(0, idx);
const after = content.substring(idx);

const newCode = `
  async listBatches(page, pageSize) {
    const offset = (page - 1) * pageSize;
    const batches = await db.all(
      "SELECT * FROM batches ORDER BY created_at DESC LIMIT ? OFFSET ?",
      [pageSize, offset]
    );
    const totalResult = await db.get("SELECT COUNT(*) as count FROM batches");
    return {
      list: batches,
      total: totalResult.count,
      page,
      pageSize
    };
  }

  async validateRouteSchedule(routeNo, shiftNo) {
    if (!routeNo || !shiftNo) {
      return { valid: true, warning: "未提供线路号或班次号，跳过校验" };
    }
    const schedule = await db.get(
      "SELECT * FROM route_schedules WHERE route_no = ? AND shift_no = ? LIMIT 1",
      [routeNo, shiftNo]
    );
    if (!schedule) {
      return {
        valid: false,
        warning: "线路 " + routeNo + " 班次 " + shiftNo + " 未在系统中登记"
      };
    }
    return { valid: true, schedule };
  }
`;

content = before + newCode + after;
fs.writeFileSync(importPath, content);
console.log("添加了 listBatches 和 validateRouteSchedule 方法");
