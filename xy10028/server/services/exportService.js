const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const { PassThrough } = require('stream');
const db = require('../models');

const exportService = {
  async exportToExcel(data, options = {}) {
    const { title = '数据导出', columns, sheetName = 'Sheet1' } = options;
    
    const workbook = new ExcelJS.Workbook();
    workbook.creator = '库存管理系统';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet(sheetName);

    worksheet.columns = columns.map(col => ({
      header: col.label,
      key: col.key,
      width: col.width || 20
    }));

    worksheet.getRow(1).font = { bold: true, size: 14 };
    worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

    data.forEach(item => {
      const rowData = {};
      columns.forEach(col => {
        if (col.formatter) {
          rowData[col.key] = col.formatter(item[col.key], item);
        } else {
          rowData[col.key] = item[col.key];
        }
      });
      worksheet.addRow(rowData);
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return buffer;
  },

  async exportInventoryToExcel(options = {}) {
    const { storeId, lowStock = false } = options;
    
    const inventories = await db.Inventory.findAll({
      where: {
        ...(storeId && { storeId }),
        ...(lowStock && { quantity: { [db.Sequelize.Op.lte]: db.Sequelize.col('minStock') } })
      },
      include: [{ model: db.Store }, { model: db.Product }]
    });

    const data = inventories.map(inv => ({
      storeName: inv.Store?.name,
      storeCode: inv.Store?.code,
      productName: inv.Product?.name,
      productSku: inv.Product?.sku,
      productCategory: inv.Product?.category,
      quantity: inv.quantity,
      price: Number(inv.price),
      totalValue: Number(inv.quantity) * Number(inv.price),
      minStock: inv.minStock,
      lastUpdatedAt: inv.lastUpdatedAt,
      version: inv.version
    }));

    const columns = [
      { key: 'storeCode', label: '门店编码', width: 12 },
      { key: 'storeName', label: '门店名称', width: 15 },
      { key: 'productSku', label: '商品SKU', width: 15 },
      { key: 'productName', label: '商品名称', width: 25 },
      { key: 'productCategory', label: '商品分类', width: 12 },
      { key: 'quantity', label: '库存数量', width: 10 },
      { key: 'price', label: '单价', width: 12, formatter: (val) => `¥${val?.toFixed(2) || '0.00'}` },
      { key: 'totalValue', label: '库存总值', width: 12, formatter: (val) => `¥${val?.toFixed(2) || '0.00'}` },
      { key: 'minStock', label: '最低库存', width: 10 },
      { key: 'version', label: '版本号', width: 8 },
      { key: 'lastUpdatedAt', label: '最后更新', width: 20, formatter: (val) => val ? new Date(val).toLocaleString('zh-CN') : '' }
    ];

    return await this.exportToExcel(data, {
      title: '库存报表',
      columns,
      sheetName: '库存数据'
    });
  },

  async exportToMarkdown(data, options = {}) {
    const { title = '数据导出', columns } = options;
    
    let markdown = `# ${title}\n\n`;
    markdown += `导出时间: ${new Date().toLocaleString('zh-CN')}\n\n`;
    markdown += `## 数据列表\n\n`;

    const headers = columns.map(col => col.label).join(' | ');
    const separator = columns.map(() => '---').join(' | ');
    markdown += `| ${headers} |\n`;
    markdown += `| ${separator} |\n`;

    data.forEach(item => {
      const rowData = columns.map(col => {
        let value = item[col.key];
        if (col.formatter) {
          value = col.formatter(value, item);
        }
        if (value === null || value === undefined) {
          value = '';
        }
        return String(value).replace(/\|/g, '\\|');
      }).join(' | ');
      markdown += `| ${rowData} |\n`;
    });

    return markdown;
  },

  async exportInventoryToMarkdown(options = {}) {
    const { storeId, lowStock = false } = options;
    
    const inventories = await db.Inventory.findAll({
      where: {
        ...(storeId && { storeId }),
        ...(lowStock && { quantity: { [db.Sequelize.Op.lte]: db.Sequelize.col('minStock') } })
      },
      include: [{ model: db.Store }, { model: db.Product }]
    });

    const data = inventories.map(inv => ({
      storeName: inv.Store?.name,
      storeCode: inv.Store?.code,
      productName: inv.Product?.name,
      productSku: inv.Product?.sku,
      quantity: inv.quantity,
      price: Number(inv.price),
      totalValue: Number(inv.quantity) * Number(inv.price),
      lastUpdatedAt: inv.lastUpdatedAt
    }));

    const columns = [
      { key: 'storeCode', label: '门店编码' },
      { key: 'storeName', label: '门店名称' },
      { key: 'productSku', label: '商品SKU' },
      { key: 'productName', label: '商品名称' },
      { key: 'quantity', label: '库存数量' },
      { key: 'price', label: '单价', formatter: (val) => `¥${val?.toFixed(2) || '0.00'}` },
      { key: 'totalValue', label: '库存总值', formatter: (val) => `¥${val?.toFixed(2) || '0.00'}` },
      { key: 'lastUpdatedAt', label: '最后更新', formatter: (val) => val ? new Date(val).toLocaleString('zh-CN') : '' }
    ];

    let markdown = await this.exportToMarkdown(data, {
      title: '库存报表',
      columns
    });

    const totalInventory = data.reduce((sum, item) => sum + (item.quantity || 0), 0);
    const totalValue = data.reduce((sum, item) => sum + (item.totalValue || 0), 0);

    markdown += `\n## 汇总统计\n\n`;
    markdown += `- **库存总数量**: ${totalInventory}\n`;
    markdown += `- **库存总价值**: ¥${totalValue.toFixed(2)}\n`;
    markdown += `- **商品种类**: ${data.length}\n`;

    return markdown;
  },

  async exportToPDF(data, options = {}) {
    const { title = '数据导出', columns } = options;
    
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        layout: 'landscape',
        margin: 50
      });

      const stream = new PassThrough();
      const buffers = [];

      stream.on('data', (chunk) => buffers.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(buffers)));
      stream.on('error', reject);

      doc.pipe(stream);

      doc.fontSize(20).text(title, { align: 'center' });
      doc.moveDown();
      doc.fontSize(10).text(`导出时间: ${new Date().toLocaleString('zh-CN')}`, { align: 'right' });
      doc.moveDown();

      const pageWidth = doc.page.width - 100;
      const colWidth = pageWidth / columns.length;
      let y = doc.y;

      doc.font('Helvetica-Bold').fontSize(10);
      columns.forEach((col, i) => {
        doc.text(col.label, 50 + i * colWidth, y, { width: colWidth, align: 'left' });
      });
      doc.moveDown();
      y = doc.y;

      doc.font('Helvetica').fontSize(9);
      data.forEach((item, rowIndex) => {
        if (y > doc.page.height - 100) {
          doc.addPage();
          y = 100;

          doc.font('Helvetica-Bold').fontSize(10);
          columns.forEach((col, i) => {
            doc.text(col.label, 50 + i * colWidth, y - 20, { width: colWidth, align: 'left' });
          });
          doc.font('Helvetica').fontSize(9);
        }

        columns.forEach((col, colIndex) => {
          let value = item[col.key];
          if (col.formatter) {
            value = col.formatter(value, item);
          }
          if (value === null || value === undefined) {
            value = '';
          }
          doc.text(String(value), 50 + colIndex * colWidth, y, { width: colWidth, align: 'left' });
        });

        y = doc.y;
        if ((rowIndex + 1) % 1 === 0) doc.moveDown(0.5);
      });

      doc.end();
    });
  },

  async exportInventoryToPDF(options = {}) {
    const { storeId, lowStock = false } = options;
    
    const inventories = await db.Inventory.findAll({
      where: {
        ...(storeId && { storeId }),
        ...(lowStock && { quantity: { [db.Sequelize.Op.lte]: db.Sequelize.col('minStock') } })
      },
      include: [{ model: db.Store }, { model: db.Product }]
    });

    const data = inventories.map(inv => ({
      storeCode: inv.Store?.code,
      storeName: inv.Store?.name,
      productSku: inv.Product?.sku,
      productName: inv.Product?.name,
      quantity: inv.quantity,
      price: Number(inv.price),
      totalValue: Number(inv.quantity) * Number(inv.price),
      lastUpdatedAt: inv.lastUpdatedAt
    }));

    const columns = [
      { key: 'storeCode', label: '门店编码', width: 80 },
      { key: 'storeName', label: '门店名称', width: 100 },
      { key: 'productSku', label: '商品SKU', width: 100 },
      { key: 'productName', label: '商品名称', width: 150 },
      { key: 'quantity', label: '数量', width: 60 },
      { key: 'price', label: '单价', width: 80, formatter: (val) => `¥${val?.toFixed(2) || '0.00'}` },
      { key: 'totalValue', label: '总值', width: 100, formatter: (val) => `¥${val?.toFixed(2) || '0.00'}` },
      { key: 'lastUpdatedAt', label: '更新时间', width: 150, formatter: (val) => val ? new Date(val).toLocaleString('zh-CN') : '' }
    ];

    return await this.exportToPDF(data, {
      title: '库存报表',
      columns
    });
  },

  async exportOperationsToExcel(options = {}) {
    const { startDate, endDate, operationType } = options;
    
    const logs = await db.OperationLog.findAll({
      where: {
        operationAt: { [db.Sequelize.Op.between]: [startDate, endDate] },
        ...(operationType && { operationType })
      },
      include: [
        { model: db.User, attributes: ['name'] },
        { model: db.Inventory, include: [{ model: db.Product }, { model: db.Store }] }
      ],
      order: [['sequence', 'DESC']]
    });

    const data = logs.map(log => ({
      sequence: log.sequence,
      operationType: log.operationType,
      storeName: log.Inventory?.Store?.name,
      productName: log.Inventory?.Product?.name,
      productSku: log.Inventory?.Product?.sku,
      beforeState: JSON.parse(log.beforeState),
      afterState: JSON.parse(log.afterState),
      changeDetails: JSON.parse(log.changeDetails),
      operator: log.User?.name,
      status: log.status,
      operationAt: log.operationAt,
      requestId: log.requestId
    }));

    const columns = [
      { key: 'sequence', label: '序号', width: 8 },
      { key: 'operationType', label: '操作类型', width: 12 },
      { key: 'storeName', label: '门店', width: 15 },
      { key: 'productName', label: '商品', width: 20 },
      { key: 'productSku', label: 'SKU', width: 15 },
      { key: 'beforeQuantity', label: '变更前数量', width: 12, formatter: (_, item) => item.beforeState?.quantity },
      { key: 'afterQuantity', label: '变更后数量', width: 12, formatter: (_, item) => item.afterState?.quantity },
      { key: 'operator', label: '操作人', width: 10 },
      { key: 'status', label: '状态', width: 10 },
      { key: 'operationAt', label: '操作时间', width: 20, formatter: (val) => val ? new Date(val).toLocaleString('zh-CN') : '' },
      { key: 'requestId', label: '请求ID', width: 36 }
    ];

    return await this.exportToExcel(data, {
      title: '操作日志报表',
      columns,
      sheetName: '操作日志'
    });
  }
};

module.exports = exportService;
