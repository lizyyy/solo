import os

content = '''const fs = require("fs");
const csv = require("csv-parser");
const moment = require("moment");
const db = require("../models/database");

class ImportService {
  async createBatch(batchType, sourceFile, createdBy, remark) {
    const batchNo = "BATCH" + moment().format("YYYYMMDDHHmmss") + Math.floor(Math.random() * 1000);
    const result = await db.run(
      "INSERT INTO batches (batch_no, batch_type, source_file, created_by, remark) VALUES (?, ?, ?, ?, ?)",
      [batchNo, batchType, sourceFile, createdBy, remark || ""]
    );
    return { batchId: result.lastID, batchNo };
  }

  async updateBatchCount(batchId, count) {
    await db.run(
      "UPDATE batches SET total_count = ?, status = ? WHERE id = ?",
      [count, "completed", batchId]
    );
  }

  async addProcessingHistory(itemId, action, reason, operator, oldStatus, newStatus, remark) {
    await db.run(
      "INSERT INTO processing_history (item_id, action, action_reason, operator, old_status, new_status, remark) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [itemId, action, reason, operator, oldStatus, newStatus, remark || ""]
    );
  }

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

  async importLostItemsFromCSV(filePath, batchId, operator, validateRoute) {
    if (validateRoute === undefined) validateRoute = true;
    const items = [];
    const warnings = [];
    let successCount = 0;
    let failCount = 0;

    return new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on("data", (row) => {
          items.push(row);
        })
        .on("end", async () => {
          try {
            await db.beginTransaction();
            for (const row of items) {
              try {
                const itemNo = row.item_no || row.itemNo || "ITEM" + moment().format("YYYYMMDDHHmmss") + Math.floor(Math.random() * 10000);
                const itemName = row.item_name || row.itemName || row.name || "未知物品";
                const itemDescription = row.item_description || row.itemDescription || row.description || row.desc || "";
                const itemCategory = row.item_category || row.itemCategory || row.category || "";
                const foundTime = row.found_time || row.foundTime || row.time || moment().format("YYYY-MM-DD HH:mm:ss");
                const foundLocation = row.found_location || row.foundLocation || row.location || "";
                const routeNo = row.route_no || row.routeNo || row.route || "";
                const shiftNo = row.shift_no || row.shiftNo || row.shift || "";
                const driverName = row.driver_name || row.driverName || row.driver || "";
                const driverPhone = row.driver_phone || row.driverPhone || "";
                const finderName = row.finder_name || row.finderName || row.finder || "";
                const finderPhone = row.finder_phone || row.finderPhone || "";
                const imageIds = row.image_ids || row.imageIds || row.images || "";

                if (validateRoute && routeNo && shiftNo) {
                  const validation = await this.validateRouteSchedule(routeNo, shiftNo);
                  if (!validation.valid) {
                    warnings.push("物品 " + itemName + " (" + itemNo + "): " + validation.warning);
                  }
                }

                const result = await db.run(
                  "INSERT INTO lost_items (item_no, item_name, item_description, item_category, found_time, found_location, route_no, shift_no, driver_name, driver_phone, finder_name, finder_phone, image_ids, batch_id, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                  [itemNo, itemName, itemDescription, itemCategory, foundTime, foundLocation, routeNo, shiftNo, driverName, driverPhone, finderName, finderPhone, imageIds, batchId, "pending"]
                );

                await this.addProcessingHistory(
                  result.lastID,
                  "import",
                  "批次导入失物记录",
                  operator,
                  null,
                  "pending",
                  "批次ID: " + batchId
                );

                successCount++;
              } catch (rowError) {
                failCount++;
                warnings.push("导入行失败: " + JSON.stringify(row).substring(0, 100) + " - " + rowError.message);
              }
            }
            await this.updateBatchCount(batchId, successCount);
            await db.commit();
            resolve({
              success: true,
              total: items.length,
              successCount,
              failCount,
              warnings,
              batchId
            });
          } catch (error) {
            await db.rollback();
            reject(error);
          }
        })
        .on("error", reject);
    });
  }

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
}

module.exports = new ImportService();
'''

with open('src/services/importService.js', 'w') as f:
    f.write(content)

print('importService.js 已生成')
