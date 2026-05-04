const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { getDatabase } = require('./database');

const RESULTS = {
  repairOrders: [],
  shutterTests: [],
  accessories: [],
  repairPhotos: [],
  errors: []
};

function parseCSV(filePath, parser) {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => {
        try {
          const parsed = results.map(parser);
          resolve(parsed);
        } catch (err) {
          reject(err);
        }
      })
      .on('error', reject);
  });
}

function parseRepairOrder(row) {
  return {
    order_no: row.order_no || row['订单号'] || row.orderNo,
    body_serial: row.body_serial || row['机身编号'] || row.bodySerial,
    customer_name: row.customer_name || row['客户姓名'] || row.customerName,
    customer_phone: row.customer_phone || row['客户电话'] || row.customerPhone,
    camera_model: row.camera_model || row['相机型号'] || row.cameraModel,
    problem_description: row.problem_description || row['问题描述'] || row.problemDescription,
    receive_date: row.receive_date || row['接收日期'] || row.receiveDate,
    estimated_cost: row.estimated_cost ? parseFloat(row.estimated_cost) : null,
    status: row.status || 'pending',
    notified: row.notified ? parseInt(row.notified) : 0
  };
}

function parseShutterTest(row) {
  return {
    test_id: row.test_id || row['测试编号'] || row.testId,
    body_serial: row.body_serial || row['机身编号'] || row.bodySerial,
    test_date: row.test_date || row['测试日期'] || row.testDate,
    shutter_count: row.shutter_count ? parseInt(row.shutter_count) : null,
    shutter_speed: row.shutter_speed || row['快门速度'] || row.shutterSpeed,
    accuracy_result: row.accuracy_result || row['准确性结果'] || row.accuracyResult,
    notes: row.notes || row['备注']
  };
}

function parseAccessory(part) {
  return {
    part_id: part.part_id || part['配件编号'] || part.partId,
    body_serial: part.body_serial || part['机身编号'] || part.bodySerial,
    part_name: part.part_name || part['配件名称'] || part.partName,
    part_number: part.part_number || part['配件型号'] || part.partNumber,
    ordered_date: part.ordered_date || part['订购日期'] || part.orderedDate,
    arrived_date: part.arrived_date || part['到货日期'] || part.arrivedDate,
    quantity: part.quantity ? parseInt(part.quantity) : 1,
    cost: part.cost ? parseFloat(part.cost) : null,
    status: part.status || (part.arrived_date ? 'arrived' : 'ordered')
  };
}

async function scanRepairOrders(filePath) {
  try {
    const orders = await parseCSV(filePath, parseRepairOrder);
    const db = getDatabase();
    const insertStmt = db.prepare(`
      INSERT OR REPLACE INTO repair_orders 
      (order_no, body_serial, customer_name, customer_phone, camera_model, 
       problem_description, receive_date, estimated_cost, status, notified, updated_at)
      VALUES (@order_no, @body_serial, @customer_name, @customer_phone, @camera_model,
              @problem_description, @receive_date, @estimated_cost, @status, @notified, CURRENT_TIMESTAMP)
    `);
    
    const transaction = db.transaction((items) => {
      for (const item of items) {
        insertStmt.run(item);
      }
    });
    
    transaction(orders);
    RESULTS.repairOrders = orders;
    return { success: true, count: orders.length };
  } catch (error) {
    RESULTS.errors.push({ file: filePath, error: error.message });
    return { success: false, error: error.message };
  }
}

async function scanShutterTests(filePath) {
  try {
    const tests = await parseCSV(filePath, parseShutterTest);
    const db = getDatabase();
    const insertStmt = db.prepare(`
      INSERT OR REPLACE INTO shutter_tests 
      (test_id, body_serial, test_date, shutter_count, shutter_speed, accuracy_result, notes)
      VALUES (@test_id, @body_serial, @test_date, @shutter_count, @shutter_speed, @accuracy_result, @notes)
    `);
    
    const transaction = db.transaction((items) => {
      for (const item of items) {
        insertStmt.run(item);
      }
    });
    
    transaction(tests);
    RESULTS.shutterTests = tests;
    return { success: true, count: tests.length };
  } catch (error) {
    RESULTS.errors.push({ file: filePath, error: error.message });
    return { success: false, error: error.message };
  }
}

function scanAccessories(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);
    const parts = Array.isArray(data) ? data : (data.parts || data.accessories || [data]);
    const parsedParts = parts.map(parseAccessory);
    
    const db = getDatabase();
    const insertStmt = db.prepare(`
      INSERT OR REPLACE INTO accessories 
      (part_id, body_serial, part_name, part_number, ordered_date, arrived_date, quantity, cost, status, updated_at)
      VALUES (@part_id, @body_serial, @part_name, @part_number, @ordered_date, @arrived_date, @quantity, @cost, @status, CURRENT_TIMESTAMP)
    `);
    
    const transaction = db.transaction((items) => {
      for (const item of items) {
        insertStmt.run(item);
      }
    });
    
    transaction(parsedParts);
    RESULTS.accessories = parsedParts;
    return { success: true, count: parsedParts.length };
  } catch (error) {
    RESULTS.errors.push({ file: filePath, error: error.message });
    return { success: false, error: error.message };
  }
}

function scanPhotosDirectory(dirPath) {
  try {
    if (!fs.existsSync(dirPath)) {
      return { success: false, error: '目录不存在' };
    }
    
    const photos = [];
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.heic', '.raw'];
    
    function scanDir(currentDir) {
      const items = fs.readdirSync(currentDir);
      
      for (const item of items) {
        const fullPath = path.join(currentDir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          scanDir(fullPath);
        } else {
          const ext = path.extname(item).toLowerCase();
          if (imageExtensions.includes(ext)) {
            const fileName = path.basename(item);
            const baseName = path.basename(fileName, ext);
            
            let bodySerial = null;
            let photoType = 'unknown';
            
            const serialMatch = baseName.match(/([A-Z0-9]{6,})/i);
            if (serialMatch) {
              bodySerial = serialMatch[1].toUpperCase();
            }
            
            if (fileName.toLowerCase().includes('before')) {
              photoType = 'before_repair';
            } else if (fileName.toLowerCase().includes('after')) {
              photoType = 'after_repair';
            } else if (fileName.toLowerCase().includes('test')) {
              photoType = 'test';
            } else if (fileName.toLowerCase().includes('damage')) {
              photoType = 'damage';
            }
            
            photos.push({
              photo_id: `PHOTO_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              body_serial: bodySerial,
              file_path: fullPath,
              file_name: fileName,
              photo_type: photoType,
              taken_date: null
            });
          }
        }
      }
    }
    
    scanDir(dirPath);
    
    const db = getDatabase();
    const insertStmt = db.prepare(`
      INSERT OR REPLACE INTO repair_photos 
      (photo_id, body_serial, file_path, file_name, photo_type, taken_date)
      VALUES (@photo_id, @body_serial, @file_path, @file_name, @photo_type, @taken_date)
    `);
    
    const transaction = db.transaction((items) => {
      for (const item of items) {
        insertStmt.run(item);
      }
    });
    
    transaction(photos);
    RESULTS.repairPhotos = photos;
    return { success: true, count: photos.length };
  } catch (error) {
    RESULTS.errors.push({ directory: dirPath, error: error.message });
    return { success: false, error: error.message };
  }
}

function getScanResults() {
  return { ...RESULTS };
}

function clearScanResults() {
  RESULTS.repairOrders = [];
  RESULTS.shutterTests = [];
  RESULTS.accessories = [];
  RESULTS.repairPhotos = [];
  RESULTS.errors = [];
}

module.exports = {
  scanRepairOrders,
  scanShutterTests,
  scanAccessories,
  scanPhotosDirectory,
  getScanResults,
  clearScanResults
};
