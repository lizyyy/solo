const fs = require('fs');
const csv = require('csv-parser');
const { Batch, WorkOrder, RepairRecord, Defect } = require('../models');
const HistoryService = require('../services/historyService');

class FileUploadController {
  static async uploadRepairCSV(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: '请上传文件' });
      }

      const results = [];
      const errors = [];
      let successCount = 0;

      await new Promise((resolve, reject) => {
        fs.createReadStream(req.file.path)
          .pipe(csv())
          .on('data', (data) => results.push(data))
          .on('end', resolve)
          .on('error', reject);
      });

      for (let i = 0; i < results.length; i++) {
        try {
          const row = results[i];
          const recordNo = `R${Date.now()}${String(i).padStart(4, '0')}`;
          
          let batchId = null;
          if (row.批次号) {
            const batch = await Batch.findOne({ where: { batchNo: row.批次号 } });
            if (batch) batchId = batch.id;
          }

          let workOrderId = null;
          if (row.工单号) {
            const workOrder = await WorkOrder.findOne({ where: { orderNo: row.工单号 } });
            if (workOrder) workOrderId = workOrder.id;
          }

          const repairRecord = await RepairRecord.create({
            recordNo,
            batchId,
            workOrderId,
            serialNo: row.产品序列号 || '',
            workstation: row.返修工位 || row.workstation || 'unknown',
            responsibleStation: row.责任工位 || '',
            operator: row.操作员 || '',
            defectDescription: row.缺陷描述 || row.description || '未提供',
            rootCause: row.根本原因 || '',
            solution: row.处理方案 || '',
            materialsUsed: row.使用物料 || '',
            repairTime: parseInt(row.返修耗时) || 0,
            handler: row.处理人 || '',
            status: row.状态 || 'pending',
            remark: row.备注 || ''
          });

          await HistoryService.addHistory(
            repairRecord.id,
            'CSV导入创建',
            row.操作员 || 'system',
            { newStatus: repairRecord.status, reason: '批量导入返修记录' }
          );

          successCount++;
        } catch (rowError) {
          errors.push(`第 ${i + 2} 行: ${rowError.message}`);
        }
      }

      fs.unlinkSync(req.file.path);

      res.json({
        success: true,
        message: `导入完成，成功 ${successCount} 条，失败 ${errors.length} 条`,
        successCount,
        errorCount: errors.length,
        errors
      });
    } catch (error) {
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async uploadWorkOrderJSON(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: '请上传文件' });
      }

      const jsonData = JSON.parse(fs.readFileSync(req.file.path, 'utf8'));
      const workOrders = Array.isArray(jsonData) ? jsonData : [jsonData];
      const errors = [];
      let successCount = 0;

      for (let i = 0; i < workOrders.length; i++) {
        try {
          const wo = workOrders[i];
          
          const existing = await WorkOrder.findOne({ where: { orderNo: wo.orderNo || wo.工单号 } });
          if (existing) {
            errors.push(`工单 ${wo.orderNo || wo.工单号} 已存在，跳过`);
            continue;
          }

          await WorkOrder.create({
            orderNo: wo.orderNo || wo.工单号,
            productCode: wo.productCode || wo.产品编码 || '',
            productName: wo.productName || wo.产品名称 || '',
            plannedQuantity: parseInt(wo.plannedQuantity || wo.计划数量) || 0,
            actualQuantity: parseInt(wo.actualQuantity || wo.实际数量) || 0,
            workstation: wo.workstation || wo.工位 || 'unknown',
            shift: wo.shift || wo.班次 || '',
            operator: wo.operator || wo.操作员 || '',
            startTime: wo.startTime ? new Date(wo.startTime) : null,
            endTime: wo.endTime ? new Date(wo.endTime) : null,
            status: wo.status || wo.状态 || 'created',
            remark: wo.remark || wo.备注 || ''
          });

          successCount++;
        } catch (rowError) {
          errors.push(`第 ${i + 1} 条: ${rowError.message}`);
        }
      }

      fs.unlinkSync(req.file.path);

      res.json({
        success: true,
        message: `导入完成，成功 ${successCount} 条，失败 ${errors.length} 条`,
        successCount,
        errorCount: errors.length,
        errors
      });
    } catch (error) {
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async uploadBatchJSON(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: '请上传文件' });
      }

      const jsonData = JSON.parse(fs.readFileSync(req.file.path, 'utf8'));
      const batches = Array.isArray(jsonData) ? jsonData : [jsonData];
      const errors = [];
      let successCount = 0;

      for (let i = 0; i < batches.length; i++) {
        try {
          const batch = batches[i];
          
          const existing = await Batch.findOne({ where: { batchNo: batch.batchNo || batch.批次号 } });
          if (existing) {
            errors.push(`批次 ${batch.batchNo || batch.批次号} 已存在，跳过`);
            continue;
          }

          const newBatch = await Batch.create({
            batchNo: batch.batchNo || batch.批次号,
            materialCode: batch.materialCode || batch.物料编码 || '',
            materialName: batch.materialName || batch.物料名称 || '',
            quantity: parseInt(batch.quantity || batch.数量) || 0,
            productionDate: batch.productionDate ? new Date(batch.productionDate) : new Date(),
            workstation: batch.workstation || batch.工位 || 'unknown',
            operator: batch.operator || batch.操作员 || '',
            status: batch.status || batch.状态 || 'pending',
            remark: batch.remark || batch.备注 || ''
          });

          await HistoryService.addHistory(
            newBatch.id,
            'JSON导入创建',
            batch.operator || 'system',
            { newStatus: newBatch.status, reason: '批量导入物料批次' }
          );

          successCount++;
        } catch (rowError) {
          errors.push(`第 ${i + 1} 条: ${rowError.message}`);
        }
      }

      fs.unlinkSync(req.file.path);

      res.json({
        success: true,
        message: `导入完成，成功 ${successCount} 条，失败 ${errors.length} 条`,
        successCount,
        errorCount: errors.length,
        errors
      });
    } catch (error) {
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getUploadTemplate(req, res) {
    try {
      const { type } = req.params;
      let template = '';

      if (type === 'repair') {
        template = [
          ['批次号', '工单号', '产品序列号', '返修工位', '责任工位', '操作员', '缺陷描述', '根本原因', '处理方案', '使用物料', '返修耗时', '处理人', '状态', '备注'].join(','),
          ['BATCH001', 'WO001', 'SN001', 'WS01', 'WS02', '张三', '外观划痕', '操作不当', '打磨抛光', '砂纸', '30', '李四', 'pending', '示例数据'].join(','),
          ['BATCH002', 'WO002', 'SN002', 'WS02', 'WS01', '王五', '尺寸超差', '设备问题', '返工重做', '', '60', '赵六', 'processing', '示例数据'].join(',')
        ].join('\n');
      } else if (type === 'workorder') {
        template = [
          ['工单号', '产品编码', '产品名称', '计划数量', '实际数量', '工位', '班次', '操作员', '开始时间', '结束时间', '状态', '备注'].join(','),
          ['WO001', 'P001', '产品A', '100', '95', 'WS01', '早班', '张三', '2024-01-01', '2024-01-02', 'completed', '示例数据'].join(','),
          ['WO002', 'P002', '产品B', '200', '0', 'WS02', '晚班', '李四', '', '', 'created', '示例数据'].join(',')
        ].join('\n');
      } else if (type === 'batch') {
        template = [
          ['批次号', '物料编码', '物料名称', '数量', '生产日期', '工位', '操作员', '状态', '备注'].join(','),
          ['BATCH001', 'M001', '物料A', '1000', '2024-01-01', 'WS01', '张三', 'pending', '示例数据'].join(','),
          ['BATCH002', 'M002', '物料B', '2000', '2024-01-02', 'WS02', '李四', 'processing', '示例数据'].join(',')
        ].join('\n');
      } else {
        return res.status(400).json({ success: false, message: '不支持的模板类型' });
      }

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=${type}_template.csv`);
      res.send('\uFEFF' + template);
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
}

module.exports = FileUploadController;
