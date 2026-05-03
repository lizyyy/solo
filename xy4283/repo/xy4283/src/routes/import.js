const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const models = require('../models');
const parsers = require('../parsers');
const validators = require('../validators');

// 配置multer文件上传
const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB限制
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.csv', '.json'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('只支持CSV和JSON格式文件'));
    }
  }
});

/**
 * 数据导入相关API路由
 */

// 导入器材台账（CSV格式）
router.post('/equipment', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: '请上传CSV文件'
      });
    }
    
    const filePath = req.file.path;
    
    try {
      // 解析CSV文件
      const parseResult = await parsers.csv.parseEquipmentCSV(filePath);
      
      if (!parseResult.success) {
        fs.unlinkSync(filePath);
        return res.status(400).json({
          success: false,
          error: 'CSV解析失败',
          errors: parseResult.errors
        });
      }
      
      const rawData = parseResult.data;
      
      if (rawData.length === 0) {
        fs.unlinkSync(filePath);
        return res.status(400).json({
          success: false,
          error: '文件为空或没有有效数据'
        });
      }
      
      // 校验数据
      const validationResult = await validators.data.validateEquipmentBatch(rawData);
      
      if (!validationResult.isValid) {
        fs.unlinkSync(filePath);
        return res.status(400).json({
          success: false,
          error: '数据校验失败',
          errors: validationResult.errors,
          valid_count: validationResult.validCount,
          invalid_count: validationResult.invalidCount
        });
      }
      
      // 批量创建器材
      const created = [];
      const errors = [];
      
      for (const item of validationResult.validData) {
        try {
          // 检查器材编号是否已存在
          const existing = await models.equipment.getEquipmentByCode(item.equipment_code);
          if (existing) {
            errors.push({
              row: item.__rowIndex,
              error: `器材编号 ${item.equipment_code} 已存在`
            });
            continue;
          }
          
          const equipment = await models.equipment.createEquipment(item);
          created.push(equipment);
        } catch (err) {
          errors.push({
            row: item.__rowIndex,
            error: err.message
          });
        }
      }
      
      // 删除临时文件
      fs.unlinkSync(filePath);
      
      res.json({
        success: true,
        data: {
          total_processed: rawData.length,
          created_count: created.length,
          error_count: errors.length,
          created: created,
          errors: errors
        },
        message: `导入完成，成功创建 ${created.length} 条器材记录`
      });
    } catch (error) {
      // 确保删除临时文件
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      throw error;
    }
  } catch (error) {
    next(error);
  }
});

// 导入巡检记录（JSON格式）
router.post('/inspection', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: '请上传JSON文件'
      });
    }
    
    const filePath = req.file.path;
    
    try {
      // 解析JSON文件
      const parseResult = await parsers.json.parseInspectionJSON(filePath);
      
      if (!parseResult.success) {
        fs.unlinkSync(filePath);
        return res.status(400).json({
          success: false,
          error: 'JSON解析失败',
          errors: parseResult.errors
        });
      }
      
      const rawData = parseResult.data;
      
      if (rawData.length === 0) {
        fs.unlinkSync(filePath);
        return res.status(400).json({
          success: false,
          error: '文件为空或没有有效数据'
        });
      }
      
      // 校验数据
      const validationResult = await validators.data.validateInspectionBatch(rawData);
      
      if (!validationResult.isValid) {
        fs.unlinkSync(filePath);
        return res.status(400).json({
          success: false,
          error: '数据校验失败',
          errors: validationResult.errors,
          valid_count: validationResult.validCount,
          invalid_count: validationResult.invalidCount
        });
      }
      
      // 批量创建巡检记录
      const created = [];
      const errors = [];
      
      for (const item of validationResult.validData) {
        try {
          // 检查器材是否存在
          let equipment = null;
          if (item.equipment_id) {
            equipment = await models.equipment.getEquipmentById(item.equipment_id);
          } else if (item.equipment_code) {
            equipment = await models.equipment.getEquipmentByCode(item.equipment_code);
          }
          
          if (!equipment) {
            errors.push({
              row: item.__rowIndex,
              error: `器材 ${item.equipment_id || item.equipment_code || '未知'} 不存在`
            });
            continue;
          }
          
          // 使用找到的器材ID
          const inspectionData = {
            ...item,
            equipment_id: equipment.id
          };
          delete inspectionData.equipment_code;
          delete inspectionData.__rowIndex;
          
          const inspection = await models.inspection.createInspection(inspectionData);
          created.push(inspection);
        } catch (err) {
          errors.push({
            row: item.__rowIndex,
            error: err.message
          });
        }
      }
      
      // 删除临时文件
      fs.unlinkSync(filePath);
      
      res.json({
        success: true,
        data: {
          total_processed: rawData.length,
          created_count: created.length,
          error_count: errors.length,
          created: created,
          errors: errors
        },
        message: `导入完成，成功创建 ${created.length} 条巡检记录`
      });
    } catch (error) {
      // 确保删除临时文件
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      throw error;
    }
  } catch (error) {
    next(error);
  }
});

// 导入召回清单（支持CSV或JSON格式）
router.post('/recall', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: '请上传文件'
      });
    }
    
    const filePath = req.file.path;
    const ext = path.extname(req.file.originalname).toLowerCase();
    
    try {
      let rawData;
      
      // 根据文件扩展名选择解析方式
      let parseResult;
      if (ext === '.csv') {
        parseResult = await parsers.csv.parseRecallCSV(filePath);
      } else if (ext === '.json') {
        parseResult = await parsers.json.parseRecallJSON(filePath);
      } else {
        fs.unlinkSync(filePath);
        return res.status(400).json({
          success: false,
          error: '不支持的文件格式'
        });
      }
      
      if (!parseResult.success) {
        fs.unlinkSync(filePath);
        return res.status(400).json({
          success: false,
          error: '文件解析失败',
          errors: parseResult.errors
        });
      }
      
      rawData = parseResult.data;
      
      if (rawData.length === 0) {
        fs.unlinkSync(filePath);
        return res.status(400).json({
          success: false,
          error: '文件为空或没有有效数据'
        });
      }
      
      // 校验数据
      const validationResult = await validators.data.validateRecallBatch(rawData);
      
      if (!validationResult.isValid) {
        fs.unlinkSync(filePath);
        return res.status(400).json({
          success: false,
          error: '数据校验失败',
          errors: validationResult.errors,
          valid_count: validationResult.validCount,
          invalid_count: validationResult.invalidCount
        });
      }
      
      // 批量创建召回清单
      const created = [];
      const errors = [];
      
      for (const item of validationResult.validData) {
        try {
          // 检查召回编号是否已存在
          const existing = await models.recall.getRecallByCode(item.recall_code);
          if (existing) {
            errors.push({
              row: item.__rowIndex,
              error: `召回编号 ${item.recall_code} 已存在`
            });
            continue;
          }
          
          const recall = await models.recall.createRecall(item);
          created.push(recall);
        } catch (err) {
          errors.push({
            row: item.__rowIndex,
            error: err.message
          });
        }
      }
      
      // 删除临时文件
      fs.unlinkSync(filePath);
      
      res.json({
        success: true,
        data: {
          total_processed: rawData.length,
          created_count: created.length,
          error_count: errors.length,
          created: created,
          errors: errors
        },
        message: `导入完成，成功创建 ${created.length} 条召回清单`
      });
    } catch (error) {
      // 确保删除临时文件
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      throw error;
    }
  } catch (error) {
    next(error);
  }
});

// 预览上传文件内容（不保存到数据库）
router.post('/preview', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: '请上传文件'
      });
    }
    
    const filePath = req.file.path;
    const ext = path.extname(req.file.originalname).toLowerCase();
    
    try {
      let rawData;
      let dataType = 'unknown';
      
      // 根据文件扩展名解析
      if (ext === '.csv') {
        const parseResult = await parsers.csv.parseEquipmentCSV(filePath);
        rawData = parseResult.success ? parseResult.data : [];
        dataType = 'equipment';
      } else if (ext === '.json') {
        try {
          const parseResult = await parsers.json.parseInspectionJSON(filePath);
          rawData = parseResult.success ? parseResult.data : [];
          dataType = 'inspection';
        } catch {
          try {
            const parseResult = await parsers.json.parseRecallJSON(filePath);
            rawData = parseResult.success ? parseResult.data : [];
            dataType = 'recall';
          } catch {
            rawData = [];
          }
        }
      }
      
      // 删除临时文件
      fs.unlinkSync(filePath);
      
      // 限制预览数量
      const previewData = rawData.slice(0, 10);
      
      res.json({
        success: true,
        data: {
          data_type: dataType,
          total_count: rawData.length,
          preview_count: previewData.length,
          preview_data: previewData
        }
      });
    } catch (error) {
      // 确保删除临时文件
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      throw error;
    }
  } catch (error) {
    next(error);
  }
});

module.exports = router;
