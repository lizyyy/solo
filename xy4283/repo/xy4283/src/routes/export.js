const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const services = require('../services');

/**
 * 报告导出相关API路由
 */

// 生成综合报告
router.get('/comprehensive', async (req, res, next) => {
  try {
    const report = await services.exporter.generateComprehensiveReport();
    
    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    next(error);
  }
});

// 生成综合报告并下载
router.get('/comprehensive/download', async (req, res, next) => {
  try {
    const report = await services.exporter.generateComprehensiveReport();
    
    // 创建导出目录
    const exportDir = path.join(__dirname, '../../exports');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }
    
    // 生成时间戳
    const timestamp = new Date().toISOString().slice(0, 10);
    
    // 保存Markdown报告
    const mdPath = path.join(exportDir, `comprehensive-report-${timestamp}.md`);
    fs.writeFileSync(mdPath, report.markdown);
    
    // 保存CSV文件
    const csvPaths = {};
    for (const [name, csvContent] of Object.entries(report.csv)) {
      const csvPath = path.join(exportDir, `comprehensive-${name}-${timestamp}.csv`);
      fs.writeFileSync(csvPath, csvContent);
      csvPaths[name] = csvPath;
    }
    
    res.json({
      success: true,
      data: {
        markdown_path: mdPath,
        csv_paths: csvPaths,
        export_directory: exportDir
      },
      message: '综合报告已生成并保存'
    });
  } catch (error) {
    next(error);
  }
});

// 生成召回详细报告
router.get('/recall/:recallId', async (req, res, next) => {
  try {
    const { recallId } = req.params;
    
    const report = await services.exporter.generateRecallDetailReport(recallId);
    
    if (!report) {
      return res.status(404).json({
        success: false,
        error: '召回清单不存在'
      });
    }
    
    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    next(error);
  }
});

// 生成召回详细报告并下载
router.get('/recall/:recallId/download', async (req, res, next) => {
  try {
    const { recallId } = req.params;
    
    const report = await services.exporter.generateRecallDetailReport(recallId);
    
    if (!report) {
      return res.status(404).json({
        success: false,
        error: '召回清单不存在'
      });
    }
    
    // 创建导出目录
    const exportDir = path.join(__dirname, '../../exports');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }
    
    // 生成时间戳
    const timestamp = new Date().toISOString().slice(0, 10);
    
    // 保存Markdown报告
    const mdPath = path.join(exportDir, `recall-${recallId}-${timestamp}.md`);
    fs.writeFileSync(mdPath, report.markdown);
    
    // 保存CSV文件
    const csvPaths = {};
    for (const [name, csvContent] of Object.entries(report.csv)) {
      const csvPath = path.join(exportDir, `recall-${recallId}-${name}-${timestamp}.csv`);
      fs.writeFileSync(csvPath, csvContent);
      csvPaths[name] = csvPath;
    }
    
    res.json({
      success: true,
      data: {
        markdown_path: mdPath,
        csv_paths: csvPaths,
        export_directory: exportDir
      },
      message: '召回详细报告已生成并保存'
    });
  } catch (error) {
    next(error);
  }
});

// 生成风险报告
router.get('/risk', async (req, res, next) => {
  try {
    const report = await services.exporter.generateRiskReport();
    
    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    next(error);
  }
});

// 生成风险报告并下载
router.get('/risk/download', async (req, res, next) => {
  try {
    const report = await services.exporter.generateRiskReport();
    
    // 创建导出目录
    const exportDir = path.join(__dirname, '../../exports');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }
    
    // 生成时间戳
    const timestamp = new Date().toISOString().slice(0, 10);
    
    // 保存Markdown报告
    const mdPath = path.join(exportDir, `risk-report-${timestamp}.md`);
    fs.writeFileSync(mdPath, report.markdown);
    
    // 保存CSV文件
    const csvPaths = {};
    for (const [name, csvContent] of Object.entries(report.csv)) {
      const csvPath = path.join(exportDir, `risk-${name}-${timestamp}.csv`);
      fs.writeFileSync(csvPath, csvContent);
      csvPaths[name] = csvPath;
    }
    
    res.json({
      success: true,
      data: {
        markdown_path: mdPath,
        csv_paths: csvPaths,
        export_directory: exportDir
      },
      message: '风险报告已生成并保存'
    });
  } catch (error) {
    next(error);
  }
});

// 生成器材台账报告
router.get('/equipment', async (req, res, next) => {
  try {
    const report = await services.exporter.generateEquipmentReport();
    
    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    next(error);
  }
});

// 生成器材台账报告并下载
router.get('/equipment/download', async (req, res, next) => {
  try {
    const report = await services.exporter.generateEquipmentReport();
    
    // 创建导出目录
    const exportDir = path.join(__dirname, '../../exports');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }
    
    // 生成时间戳
    const timestamp = new Date().toISOString().slice(0, 10);
    
    // 保存Markdown报告
    const mdPath = path.join(exportDir, `equipment-report-${timestamp}.md`);
    fs.writeFileSync(mdPath, report.markdown);
    
    // 保存CSV文件
    const csvPath = path.join(exportDir, `equipment-${timestamp}.csv`);
    fs.writeFileSync(csvPath, report.csv);
    
    res.json({
      success: true,
      data: {
        markdown_path: mdPath,
        csv_path: csvPath,
        export_directory: exportDir
      },
      message: '器材台账报告已生成并保存'
    });
  } catch (error) {
    next(error);
  }
});

// 获取导出目录列表
router.get('/files', async (req, res, next) => {
  try {
    const exportDir = path.join(__dirname, '../../exports');
    
    if (!fs.existsSync(exportDir)) {
      return res.json({
        success: true,
        data: [],
        count: 0,
        export_directory: exportDir
      });
    }
    
    const files = fs.readdirSync(exportDir).map(filename => {
      const filePath = path.join(exportDir, filename);
      const stats = fs.statSync(filePath);
      return {
        filename,
        path: filePath,
        size: stats.size,
        created_at: stats.birthtime,
        modified_at: stats.mtime
      };
    }).sort((a, b) => b.modified_at - a.modified_at);
    
    res.json({
      success: true,
      data: files,
      count: files.length,
      export_directory: exportDir
    });
  } catch (error) {
    next(error);
  }
});

// 清空导出目录
router.delete('/files', async (req, res, next) => {
  try {
    const exportDir = path.join(__dirname, '../../exports');
    
    if (!fs.existsSync(exportDir)) {
      return res.json({
        success: true,
        message: '导出目录不存在'
      });
    }
    
    const files = fs.readdirSync(exportDir);
    let deletedCount = 0;
    
    for (const file of files) {
      const filePath = path.join(exportDir, file);
      fs.unlinkSync(filePath);
      deletedCount++;
    }
    
    res.json({
      success: true,
      message: `已删除 ${deletedCount} 个文件`,
      deleted_count: deletedCount
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
