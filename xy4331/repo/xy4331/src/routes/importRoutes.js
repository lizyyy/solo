const express = require('express');
const router = express.Router();
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const JsonParser = require('../parsers/JsonParser');
const CsvParser = require('../parsers/CsvParser');
const Animal = require('../models/Animal');
const Cage = require('../models/Cage');
const SensorAlert = require('../models/SensorAlert');
const VeterinaryOrder = require('../models/VeterinaryOrder');
const CareInspection = require('../models/CareInspection');
const TransferRecord = require('../models/TransferRecord');
const RuleEngine = require('../rules/RuleEngine');
const { runAsync } = require('../config/database');

const upload = multer({ 
  limits: { fileSize: 50 * 1024 * 1024 },
  storage: multer.memoryStorage()
});

router.post('/sensor-alerts', upload.single('file'), async (req, res) => {
  try {
    let jsonData;
    const importedBy = req.user?.username || 'api_user';

    if (req.file) {
      jsonData = req.file.buffer.toString('utf8');
    } else if (req.body) {
      jsonData = req.body;
    } else {
      return res.status(400).json({ 
        success: false, 
        error: '请提供 JSON 数据或上传文件' 
      });
    }

    const parseResult = JsonParser.parseSensorAlerts(jsonData);
    
    if (parseResult.errors.length > 0 && parseResult.success.length === 0) {
      return res.status(400).json({
        success: false,
        error: '所有数据解析失败',
        parse_errors: parseResult.errors
      });
    }

    const imported = [];
    const importErrors = [];

    for (const alertData of parseResult.success) {
      try {
        const alert = await SensorAlert.create(alertData);
        imported.push(alert);
      } catch (error) {
        importErrors.push({
          data: alertData,
          error: error.message
        });
      }
    }

    const sessionId = uuidv4();
    await runAsync(
      `INSERT INTO import_sessions 
       (id, session_id, import_type, file_name, record_count, success_count, error_count, errors, imported_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [uuidv4(), sessionId, 'sensor_alerts', 
       req.file?.originalname || 'inline_json',
       parseResult.success.length + parseResult.errors.length,
       imported.length,
       parseResult.errors.length + importErrors.length,
       JSON.stringify({ parse_errors: parseResult.errors, import_errors: importErrors }),
       importedBy]
    );

    res.json({
      success: true,
      session_id: sessionId,
      statistics: {
        total: parseResult.success.length + parseResult.errors.length,
        imported: imported.length,
        parse_failed: parseResult.errors.length,
        import_failed: importErrors.length
      },
      imported_count: imported.length,
      parse_errors: parseResult.errors,
      import_errors: importErrors,
      warnings: parseResult.warnings
    });

  } catch (error) {
    console.error('导入传感器告警失败:', error);
    res.status(500).json({ 
      success: false, 
      error: '导入失败: ' + error.message 
    });
  }
});

router.post('/transfer-records', upload.single('file'), async (req, res) => {
  try {
    let csvData;
    const importedBy = req.user?.username || 'api_user';

    if (req.file) {
      csvData = req.file.buffer;
    } else if (req.body && Array.isArray(req.body)) {
      csvData = JSON.stringify(req.body);
    } else {
      return res.status(400).json({ 
        success: false, 
        error: '请提供 CSV 文件或 JSON 数组' 
      });
    }

    const result = await CsvParser.importTransferRecords(csvData, importedBy);

    const validationIssues = [];
    for (const transfer of result.imported_records) {
      const issues = await RuleEngine.validateTransfer(transfer);
      if (issues.length > 0) {
        validationIssues.push({
          transfer_id: transfer.transfer_id,
          animal_id: transfer.animal_id,
          issues: issues
        });
      }
    }

    const sessionId = uuidv4();
    await runAsync(
      `INSERT INTO import_sessions 
       (id, session_id, import_type, file_name, record_count, success_count, error_count, errors, imported_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [uuidv4(), sessionId, 'transfer_records',
       req.file?.originalname || 'inline_data',
       result.total,
       result.imported,
       result.failed,
       JSON.stringify({ parse_errors: result.parse_errors, import_errors: result.import_errors }),
       importedBy]
    );

    res.json({
      success: true,
      session_id: sessionId,
      statistics: {
        total: result.total,
        imported: result.imported,
        failed: result.failed
      },
      validation_issues: validationIssues,
      parse_errors: result.parse_errors,
      import_errors: result.import_errors
    });

  } catch (error) {
    console.error('导入转笼记录失败:', error);
    res.status(500).json({ 
      success: false, 
      error: '导入失败: ' + error.message 
    });
  }
});

router.post('/veterinary-orders', upload.single('file'), async (req, res) => {
  try {
    let jsonData;
    const importedBy = req.user?.username || 'api_user';

    if (req.file) {
      jsonData = req.file.buffer.toString('utf8');
    } else if (req.body) {
      jsonData = req.body;
    } else {
      return res.status(400).json({ 
        success: false, 
        error: '请提供 JSON 数据或上传文件' 
      });
    }

    const parseResult = JsonParser.parseVeterinaryOrders(jsonData);

    if (parseResult.errors.length > 0 && parseResult.success.length === 0) {
      return res.status(400).json({
        success: false,
        error: '所有数据解析失败',
        parse_errors: parseResult.errors
      });
    }

    const imported = [];
    const importErrors = [];

    for (const orderData of parseResult.success) {
      try {
        const animal = await Animal.findByAnimalId(orderData.animal_id);
        if (!animal) {
          await Animal.create({
            animal_id: orderData.animal_id,
            species: 'Unknown',
            status: 'active'
          });
        }

        const order = await VeterinaryOrder.create(orderData);
        imported.push(order);
      } catch (error) {
        importErrors.push({
          data: orderData,
          error: error.message
        });
      }
    }

    const unsignedCount = imported.filter(o => !o.veterinarian_signature).length;

    const sessionId = uuidv4();
    await runAsync(
      `INSERT INTO import_sessions 
       (id, session_id, import_type, file_name, record_count, success_count, error_count, errors, imported_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [uuidv4(), sessionId, 'veterinary_orders',
       req.file?.originalname || 'inline_json',
       parseResult.success.length + parseResult.errors.length,
       imported.length,
       parseResult.errors.length + importErrors.length,
       JSON.stringify({ parse_errors: parseResult.errors, import_errors: importErrors }),
       importedBy]
    );

    res.json({
      success: true,
      session_id: sessionId,
      statistics: {
        total: parseResult.success.length + parseResult.errors.length,
        imported: imported.length,
        unsigned: unsignedCount
      },
      warnings: unsignedCount > 0 
        ? [`有 ${unsignedCount} 份处置单需要兽医签署`] 
        : [],
      parse_errors: parseResult.errors,
      import_errors: importErrors
    });

  } catch (error) {
    console.error('导入兽医处置单失败:', error);
    res.status(500).json({ 
      success: false, 
      error: '导入失败: ' + error.message 
    });
  }
});

router.post('/care-inspections', upload.single('file'), async (req, res) => {
  try {
    let jsonData;
    const importedBy = req.user?.username || 'api_user';

    if (req.file) {
      jsonData = req.file.buffer.toString('utf8');
    } else if (req.body) {
      jsonData = req.body;
    } else {
      return res.status(400).json({ 
        success: false, 
        error: '请提供 JSON 数据或上传文件' 
      });
    }

    const parseResult = JsonParser.parseCareInspections(jsonData);

    if (parseResult.errors.length > 0 && parseResult.success.length === 0) {
      return res.status(400).json({
        success: false,
        error: '所有数据解析失败',
        parse_errors: parseResult.errors
      });
    }

    const imported = [];
    const importErrors = [];

    for (const inspectionData of parseResult.success) {
      try {
        const cage = await Cage.findByCageId(inspectionData.cage_id);
        if (!cage) {
          await Cage.create({
            cage_id: inspectionData.cage_id,
            rack_id: 'UNKNOWN',
            status: 'available'
          });
        }

        const inspection = await CareInspection.create(inspectionData);
        imported.push(inspection);
      } catch (error) {
        importErrors.push({
          data: inspectionData,
          error: error.message
        });
      }
    }

    const abnormalCount = imported.filter(i => i.abnormal_signs && i.abnormal_signs.trim() !== '').length;

    const sessionId = uuidv4();
    await runAsync(
      `INSERT INTO import_sessions 
       (id, session_id, import_type, file_name, record_count, success_count, error_count, errors, imported_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [uuidv4(), sessionId, 'care_inspections',
       req.file?.originalname || 'inline_json',
       parseResult.success.length + parseResult.errors.length,
       imported.length,
       parseResult.errors.length + importErrors.length,
       JSON.stringify({ parse_errors: parseResult.errors, import_errors: importErrors }),
       importedBy]
    );

    res.json({
      success: true,
      session_id: sessionId,
      statistics: {
        total: parseResult.success.length + parseResult.errors.length,
        imported: imported.length,
        with_abnormalities: abnormalCount
      },
      warnings: abnormalCount > 0 
        ? [`有 ${abnormalCount} 份巡检记录发现异常，需要关注`] 
        : [],
      parse_errors: parseResult.errors,
      import_errors: importErrors
    });

  } catch (error) {
    console.error('导入巡检记录失败:', error);
    res.status(500).json({ 
      success: false, 
      error: '导入失败: ' + error.message 
    });
  }
});

router.post('/animals', upload.single('file'), async (req, res) => {
  try {
    let csvData;
    const importedBy = req.user?.username || 'api_user';

    if (req.file) {
      csvData = req.file.buffer;
    } else {
      return res.status(400).json({ 
        success: false, 
        error: '请提供 CSV 文件' 
      });
    }

    const parseResult = await CsvParser.parseAnimals(csvData);

    if (parseResult.errors.length > 0 && parseResult.success.length === 0) {
      return res.status(400).json({
        success: false,
        error: '所有数据解析失败',
        parse_errors: parseResult.errors
      });
    }

    const imported = [];
    const importErrors = [];

    for (const animalData of parseResult.success) {
      try {
        const animal = await Animal.create(animalData);
        
        if (animalData.cage_id) {
          const cage = await Cage.findByCageId(animalData.cage_id);
          if (cage) {
            await Cage.addOccupancy(
              animalData.cage_id,
              animalData.animal_id,
              animalData.arrival_date || new Date().toISOString(),
              '初始入笼',
              importedBy
            );
          }
        }

        imported.push(animal);
      } catch (error) {
        importErrors.push({
          data: animalData,
          error: error.message
        });
      }
    }

    const sessionId = uuidv4();
    await runAsync(
      `INSERT INTO import_sessions 
       (id, session_id, import_type, file_name, record_count, success_count, error_count, errors, imported_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [uuidv4(), sessionId, 'animals',
       req.file?.originalname || 'inline_csv',
       parseResult.success.length + parseResult.errors.length,
       imported.length,
       parseResult.errors.length + importErrors.length,
       JSON.stringify({ parse_errors: parseResult.errors, import_errors: importErrors }),
       importedBy]
    );

    res.json({
      success: true,
      session_id: sessionId,
      statistics: {
        total: parseResult.success.length + parseResult.errors.length,
        imported: imported.length
      },
      parse_errors: parseResult.errors,
      import_errors: importErrors
    });

  } catch (error) {
    console.error('导入动物数据失败:', error);
    res.status(500).json({ 
      success: false, 
      error: '导入失败: ' + error.message 
    });
  }
});

router.post('/cages', upload.single('file'), async (req, res) => {
  try {
    let csvData;
    const importedBy = req.user?.username || 'api_user';

    if (req.file) {
      csvData = req.file.buffer;
    } else {
      return res.status(400).json({ 
        success: false, 
        error: '请提供 CSV 文件' 
      });
    }

    const parseResult = await CsvParser.parseCages(csvData);

    if (parseResult.errors.length > 0 && parseResult.success.length === 0) {
      return res.status(400).json({
        success: false,
        error: '所有数据解析失败',
        parse_errors: parseResult.errors
      });
    }

    const imported = [];
    const importErrors = [];

    for (const cageData of parseResult.success) {
      try {
        const cage = await Cage.create(cageData);
        imported.push(cage);
      } catch (error) {
        importErrors.push({
          data: cageData,
          error: error.message
        });
      }
    }

    const sessionId = uuidv4();
    await runAsync(
      `INSERT INTO import_sessions 
       (id, session_id, import_type, file_name, record_count, success_count, error_count, errors, imported_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [uuidv4(), sessionId, 'cages',
       req.file?.originalname || 'inline_csv',
       parseResult.success.length + parseResult.errors.length,
       imported.length,
       parseResult.errors.length + importErrors.length,
       JSON.stringify({ parse_errors: parseResult.errors, import_errors: importErrors }),
       importedBy]
    );

    res.json({
      success: true,
      session_id: sessionId,
      statistics: {
        total: parseResult.success.length + parseResult.errors.length,
        imported: imported.length
      },
      parse_errors: parseResult.errors,
      import_errors: importErrors
    });

  } catch (error) {
    console.error('导入笼位数据失败:', error);
    res.status(500).json({ 
      success: false, 
      error: '导入失败: ' + error.message 
    });
  }
});

module.exports = router;
