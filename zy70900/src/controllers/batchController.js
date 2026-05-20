const importService = require('../services/importService');
const path = require('path');

async function createBatch(req, res) {
  try {
    const { batchType, createdBy, remark } = req.body;
    const sourceFile = req.file ? req.file.originalname : null;

    if (!batchType || !createdBy) {
      return res.status(400).json({
        success: false,
        message: '批次类型和创建人不能为空'
      });
    }

    const batch = await importService.createBatch(
      batchType,
      sourceFile,
      createdBy,
      0,
      remark
    );

    res.json({
      success: true,
      data: batch,
      message: '批次创建成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '创建批次失败: ' + error.message
    });
  }
}

async function importInspectionCSV(req, res) {
  try {
    const { createdBy, remark } = req.body;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: '请上传CSV文件'
      });
    }

    if (!createdBy) {
      return res.status(400).json({
        success: false,
        message: '创建人不能为空'
      });
    }

    const filePath = req.file.path;
    const fileName = req.file.originalname;

    const records = await importService.parseInspectionCSV(filePath, null);
    
    if (records.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'CSV文件中没有有效数据'
      });
    }

    const batch = await importService.createBatch(
      'inspection',
      fileName,
      createdBy,
      records.length,
      remark
    );

    records.forEach(r => r.batchId = batch.id);
    await importService.insertInspectionRecords(records);

    res.json({
      success: true,
      data: {
        batchId: batch.id,
        batchNo: batch.batchNo,
        count: records.length
      },
      message: `成功导入 ${records.length} 条检修记录`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '导入失败: ' + error.message
    });
  }
}

async function importSensorJSON(req, res) {
  try {
    const { createdBy, remark } = req.body;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: '请上传JSON文件'
      });
    }

    if (!createdBy) {
      return res.status(400).json({
        success: false,
        message: '创建人不能为空'
      });
    }

    const filePath = req.file.path;
    const fileName = req.file.originalname;

    const records = await importService.parseSensorJSON(filePath, null);
    
    if (records.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'JSON文件中没有有效数据'
      });
    }

    const batch = await importService.createBatch(
      'sensor',
      fileName,
      createdBy,
      records.length,
      remark
    );

    records.forEach(r => r.batchId = batch.id);
    await importService.insertSensorData(records);

    res.json({
      success: true,
      data: {
        batchId: batch.id,
        batchNo: batch.batchNo,
        count: records.length
      },
      message: `成功导入 ${records.length} 条传感器数据`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '导入失败: ' + error.message
    });
  }
}

async function importApprovalCSV(req, res) {
  try {
    const { createdBy, remark } = req.body;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: '请上传CSV文件'
      });
    }

    if (!createdBy) {
      return res.status(400).json({
        success: false,
        message: '创建人不能为空'
      });
    }

    const filePath = req.file.path;
    const fileName = req.file.originalname;

    const records = await importService.parseApprovalCSV(filePath, null);
    
    if (records.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'CSV文件中没有有效数据'
      });
    }

    const batch = await importService.createBatch(
      'approval',
      fileName,
      createdBy,
      records.length,
      remark
    );

    records.forEach(r => r.batchId = batch.id);
    await importService.insertApprovalForms(records);

    res.json({
      success: true,
      data: {
        batchId: batch.id,
        batchNo: batch.batchNo,
        count: records.length
      },
      message: `成功导入 ${records.length} 条审批表数据`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '导入失败: ' + error.message
    });
  }
}

module.exports = {
  createBatch,
  importInspectionCSV,
  importSensorJSON,
  importApprovalCSV
};
