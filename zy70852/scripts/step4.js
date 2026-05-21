const fs = require("fs");
const path = require("path");

const importPath = path.join(__dirname, "../src/services/importService.js");
let content = fs.readFileSync(importPath, "utf-8");

const idx = content.lastIndexOf("}");
const before = content.substring(0, idx);
const after = content.substring(idx);

const newCode = `
  async importRouteSchedulesFromJSON(filePath, batchId, operator) {
    const content = fs.readFileSync(filePath, "utf-8");
    const schedules = JSON.parse(content);
    let successCount = 0;
    let failCount = 0;
    const warnings = [];

    await db.beginTransaction();
    try {
      for (const schedule of schedules) {
        try {
          const routeNo = schedule.route_no || schedule.routeNo || schedule.route;
          const shiftNo = schedule.shift_no || schedule.shiftNo || schedule.shift;
          const driverName = schedule.driver_name || schedule.driverName || schedule.driver || "";
          const driverPhone = schedule.driver_phone || schedule.driverPhone || "";
          const vehicleNo = schedule.vehicle_no || schedule.vehicleNo || schedule.vehicle || "";
          const departureTime = schedule.departure_time || schedule.departureTime || schedule.departure || null;
          const arrivalTime = schedule.arrival_time || schedule.arrivalTime || schedule.arrival || null;
          const startStation = schedule.start_station || schedule.startStation || schedule.start || "";
          const endStation = schedule.end_station || schedule.endStation || schedule.end || "";

          await db.run(
            "INSERT OR REPLACE INTO route_schedules (route_no, shift_no, driver_name, driver_phone, vehicle_no, departure_time, arrival_time, start_station, end_station, batch_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [routeNo, shiftNo, driverName, driverPhone, vehicleNo, departureTime, arrivalTime, startStation, endStation, batchId]
          );
          successCount++;
        } catch (rowError) {
          failCount++;
          warnings.push("导入班次失败: " + JSON.stringify(schedule).substring(0, 100) + " - " + rowError.message);
        }
      }
      await this.updateBatchCount(batchId, successCount);
      await db.commit();
      return {
        success: true,
        total: schedules.length,
        successCount,
        failCount,
        warnings,
        batchId
      };
    } catch (error) {
      await db.rollback();
      throw error;
    }
  }

  async importImageIndex(imageDataList, batchNo, uploadedBy) {
    let successCount = 0;
    let failCount = 0;
    const warnings = [];

    await db.beginTransaction();
    try {
      for (const imageData of imageDataList) {
        try {
          const imageCode = imageData.image_code || imageData.imageCode || "";
          const filePath = imageData.file_path || imageData.filePath || "";
          const itemId = imageData.item_id || imageData.itemId || null;

          await db.run(
            "INSERT OR REPLACE INTO image_index (image_code, file_path, item_id, upload_batch_no, uploaded_by) VALUES (?, ?, ?, ?, ?)",
            [imageCode, filePath, itemId, batchNo, uploadedBy]
          );
          successCount++;
        } catch (rowError) {
          failCount++;
          warnings.push("导入图片索引失败: " + (imageData.image_code || "unknown") + " - " + rowError.message);
        }
      }
      await db.commit();
      return {
        success: true,
        total: imageDataList.length,
        successCount,
        failCount,
        warnings
      };
    } catch (error) {
      await db.rollback();
      throw error;
    }
  }
`;

content = before + newCode + after;
fs.writeFileSync(importPath, content);
console.log("添加了 importRouteSchedulesFromJSON 和 importImageIndex 方法");
