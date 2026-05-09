const express = require('express');
const ExcelJS = require('exceljs');
const { 
  CountTask, 
  CountDetail, 
  Product, 
  Warehouse,
  User,
  HistoryRecord
} = require('../models');
const { requireLogin } = require('../middleware/auth');
const { Op } = require('sequelize');

const router = express.Router();

router.get('/count-task/:id/excel', requireLogin, async (req, res, next) => {
  try {
    const task = await CountTask.findByPk(req.params.id, {
      include: [
        { 
          model: Warehouse, 
          attributes: ['id', 'name', 'code', 'address'] 
        },
        { 
          model: User, 
          as: 'creator', 
          attributes: ['id', 'fullName', 'username'] 
        },
        { 
          model: User, 
          as: 'completer', 
          attributes: ['id', 'fullName', 'username'] 
        },
        { 
          model: CountDetail,
          include: [
            { 
              model: Product,
              attributes: ['id', 'code', 'name', 'barcode', 'specification', 'unit']
            },
            { 
              model: User, 
              as: 'counter', 
              attributes: ['id', 'fullName'] 
            }
          ],
          order: [['createdAt', 'ASC']]
        }
      ]
    });

    if (!task) {
      return res.status(404).json({
        success: false,
        message: '盘点任务不存在'
      });
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = '仓库盘点系统';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('盘点报告', {
      properties: { defaultRowHeight: 20 }
    });

    worksheet.columns = [
      { header: '序号', key: 'no', width: 6 },
      { header: '商品编码', key: 'code', width: 15 },
      { header: '商品名称', key: 'name', width: 30 },
      { header: '规格', key: 'specification', width: 15 },
      { header: '单位', key: 'unit', width: 8 },
      { header: '系统数量', key: 'systemQuantity', width: 12 },
      { header: '盘点数量', key: 'countQuantity', width: 12 },
      { header: '差异数量', key: 'differenceQuantity', width: 12 },
      { header: '状态', key: 'countStatus', width: 10 },
      { header: '盘点人', key: 'counterName', width: 12 },
      { header: '盘点时间', key: 'countedAt', width: 20 },
      { header: '备注', key: 'remark', width: 30 }
    ];

    worksheet.getRow(1).font = { bold: true, size: 12 };
    worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' }
    };
    worksheet.getRow(1).font.color = { argb: 'FFFFFFFF' };

    task.CountDetails.forEach((detail, index) => {
      const product = detail.Product || {};
      const counter = detail.counter || {};
      
      worksheet.addRow({
        no: index + 1,
        code: product.code || '-',
        name: product.name || '-',
        specification: product.specification || '-',
        unit: product.unit || '-',
        systemQuantity: parseFloat(detail.systemQuantity),
        countQuantity: parseFloat(detail.countQuantity),
        differenceQuantity: parseFloat(detail.differenceQuantity),
        countStatus: getStatusText(detail.countStatus),
        counterName: counter.fullName || '-',
        countedAt: detail.countedAt ? formatDate(detail.countedAt) : '-',
        remark: detail.remark || '-'
      });
    });

    const lastRow = worksheet.lastRow.number;
    worksheet.addRow({});
    
    const summaryRow = worksheet.addRow({
      code: '合计',
      systemQuantity: {
        formula: `SUM(F2:F${lastRow})`
      },
      countQuantity: {
        formula: `SUM(G2:G${lastRow})`
      },
      differenceQuantity: {
        formula: `SUM(H2:H${lastRow})`
      }
    });
    
    summaryRow.font = { bold: true };
    summaryRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD9E1F2' }
    };

    worksheet.spliceRows(1, 0, [], 
      ['盘点任务报告'],
      [`任务编号：${task.taskNo}`],
      [`任务名称：${task.name}`],
      [`仓库：${task.Warehouse ? task.Warehouse.name : '-'}`],
      [`创建人：${task.creator ? task.creator.fullName : '-'}`],
      [`状态：${getTaskStatusText(task.status)}`],
      [`开始时间：${task.startDate ? formatDate(task.startDate) : '-'}`],
      [`结束时间：${task.endDate ? formatDate(task.endDate) : '-'}`],
      []
    );

    const titleRow = worksheet.getRow(1);
    titleRow.font = { bold: true, size: 16 };
    titleRow.alignment = { horizontal: 'center' };
    worksheet.mergeCells('A1:L1');

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${encodeURIComponent(`盘点报告_${task.taskNo}.xlsx`)}`);

    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    next(error);
  }
});

router.get('/count-task/:id/statistics', requireLogin, async (req, res, next) => {
  try {
    const task = await CountTask.findByPk(req.params.id, {
      include: [{ model: CountDetail }]
    });

    if (!task) {
      return res.status(404).json({
        success: false,
        message: '盘点任务不存在'
      });
    }

    const details = task.CountDetails || [];
    const total = details.length;
    const pending = details.filter(d => d.countStatus === 'pending').length;
    const counted = details.filter(d => d.countStatus === 'counted').length;
    const approved = details.filter(d => d.countStatus === 'approved').length;
    
    const withDifference = details.filter(d => parseFloat(d.differenceQuantity) !== 0).length;
    const overstock = details.filter(d => parseFloat(d.differenceQuantity) > 0).length;
    const understock = details.filter(d => parseFloat(d.differenceQuantity) < 0).length;

    const totalSystemQuantity = details.reduce((sum, d) => sum + parseFloat(d.systemQuantity), 0);
    const totalCountQuantity = details.reduce((sum, d) => sum + parseFloat(d.countQuantity), 0);
    const totalDifference = details.reduce((sum, d) => sum + parseFloat(d.differenceQuantity), 0);

    res.json({
      success: true,
      data: {
        taskNo: task.taskNo,
        name: task.name,
        status: task.status,
        statistics: {
          total,
          pending,
          counted,
          approved,
          withDifference,
          overstock,
          understock,
          totalSystemQuantity,
          totalCountQuantity,
          totalDifference,
          progress: total > 0 ? Math.round((counted + approved) / total * 100) : 0
        }
      }
    });

  } catch (error) {
    next(error);
  }
});

router.get('/inventory/excel', requireLogin, async (req, res, next) => {
  try {
    const { warehouseId } = req.query;
    
    const where = {};
    if (warehouseId) {
      where.warehouseId = warehouseId;
    }

    const { Inventory, Product, Warehouse } = require('../models');
    const inventories = await Inventory.findAll({
      where,
      include: [
        { model: Product },
        { model: Warehouse }
      ],
      order: [['createdAt', 'DESC']]
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('库存清单');

    worksheet.columns = [
      { header: '序号', key: 'no', width: 6 },
      { header: '仓库', key: 'warehouseName', width: 20 },
      { header: '商品编码', key: 'code', width: 15 },
      { header: '商品名称', key: 'name', width: 30 },
      { header: '规格', key: 'specification', width: 15 },
      { header: '单位', key: 'unit', width: 8 },
      { header: '库存数量', key: 'quantity', width: 15 },
      { header: '版本号', key: 'version', width: 10 },
      { header: '更新时间', key: 'updatedAt', width: 20 }
    ];

    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' }
    };
    worksheet.getRow(1).font.color = { argb: 'FFFFFFFF' };

    inventories.forEach((inv, index) => {
      const product = inv.Product || {};
      const warehouse = inv.Warehouse || {};
      
      worksheet.addRow({
        no: index + 1,
        warehouseName: warehouse.name || '-',
        code: product.code || '-',
        name: product.name || '-',
        specification: product.specification || '-',
        unit: product.unit || '-',
        quantity: parseFloat(inv.quantity),
        version: inv.version,
        updatedAt: formatDate(inv.updatedAt)
      });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${encodeURIComponent('库存清单.xlsx')}`);

    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    next(error);
  }
});

function getStatusText(status) {
  const map = {
    pending: '待盘点',
    counted: '已盘点',
    approved: '已确认',
    rejected: '已拒绝'
  };
  return map[status] || status;
}

function getTaskStatusText(status) {
  const map = {
    draft: '草稿',
    in_progress: '进行中',
    completed: '已完成',
    cancelled: '已取消'
  };
  return map[status] || status;
}

function formatDate(date) {
  if (!date) return '-';
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

module.exports = router;