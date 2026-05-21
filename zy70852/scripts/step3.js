const fs = require("fs");
const path = require("path");

const importPath = path.join(__dirname, "../src/services/importService.js");
let content = fs.readFileSync(importPath, "utf-8");

const idx = content.lastIndexOf("}");
const before = content.substring(0, idx);
const after = content.substring(idx);

const newCode = `
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
`;

content = before + newCode + after;
fs.writeFileSync(importPath, content);
console.log("添加了 importLostItemsFromCSV 方法");
