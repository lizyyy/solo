const ExcelJS = require('exceljs');
const db = require('../database/init');
const { calculateExportRow, calculateCompensationSummary } = require('../utils/calculator');

function exportExcel(req, res) {
  const { status, pool_type, start_date, end_date } = req.query;

  let query = 'SELECT * FROM water_temp_records WHERE 1=1';
  const params = [];

  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }
  if (pool_type) {
    query += ' AND pool_type = ?';
    params.push(pool_type);
  }
  if (start_date) {
    query += ' AND record_date >= ?';
    params.push(start_date);
  }
  if (end_date) {
    query += ' AND record_date <= ?';
    params.push(end_date);
  }

  query += ' ORDER BY record_date DESC, created_at DESC';

  db.all(query, params, async (err, rows) => {
    if (err) {
      return res.status(500).json({ success: false, message: err.message });
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('水温记录');

    const exportRows = rows.map(calculateExportRow);

    if (exportRows.length > 0) {
      const headers = Object.keys(exportRows[0]);
      worksheet.addRow(headers);
      worksheet.getRow(1).font = { bold: true };

      exportRows.forEach(row => {
        worksheet.addRow(Object.values(row));
      });

      worksheet.columns.forEach(column => {
        let maxLength = 0;
        column.eachCell({ includeEmpty: true }, cell => {
          const columnLength = cell.value ? cell.value.toString().length : 10;
          if (columnLength > maxLength) {
            maxLength = columnLength;
          }
        });
        column.width = maxLength < 15 ? 15 : maxLength;
      });
    }

    const summaryWorksheet = workbook.addWorksheet('汇总统计');
    const summary = calculateCompensationSummary(rows);

    summaryWorksheet.addRow(['统计项', '数值']);
    summaryWorksheet.getRow(1).font = { bold: true };
    summaryWorksheet.addRow(['总记录数', summary.total]);
    summaryWorksheet.addRow(['达标记录数', summary.compliant]);
    summaryWorksheet.addRow(['不达标记录数', summary.nonCompliant]);
    summaryWorksheet.addRow(['需补偿记录数', summary.needCompensation]);
    summaryWorksheet.addRow(['已完成补偿数', summary.compensated]);
    summaryWorksheet.addRow(['待审核数', summary.pending]);
    summaryWorksheet.addRow(['待人工处理数', summary.manualReview]);
    summaryWorksheet.addRow(['补偿总金额', summary.totalCompensationAmount]);
    summaryWorksheet.addRow(['补偿总数量', summary.totalCompensationQuantity]);

    summaryWorksheet.columns = [
      { width: 20 },
      { width: 15 }
    ];

    const fileName = `水温记录_${new Date().toISOString().slice(0, 10)}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);

    await workbook.xlsx.write(res);
    res.end();
  });
}

function exportCSV(req, res) {
  const { status, pool_type, start_date, end_date } = req.query;

  let query = 'SELECT * FROM water_temp_records WHERE 1=1';
  const params = [];

  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }
  if (pool_type) {
    query += ' AND pool_type = ?';
    params.push(pool_type);
  }
  if (start_date) {
    query += ' AND record_date >= ?';
    params.push(start_date);
  }
  if (end_date) {
    query += ' AND record_date <= ?';
    params.push(end_date);
  }

  query += ' ORDER BY record_date DESC, created_at DESC';

  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ success: false, message: err.message });
    }

    const exportRows = rows.map(calculateExportRow);

    let csvContent = '';

    if (exportRows.length > 0) {
      const headers = Object.keys(exportRows[0]);
      csvContent += headers.join(',') + '\n';

      exportRows.forEach(row => {
        const values = Object.values(row).map(v => {
          if (typeof v === 'string' && (v.includes(',') || v.includes('"') || v.includes('\n'))) {
            return `"${v.replace(/"/g, '""')}"`;
          }
          return v;
        });
        csvContent += values.join(',') + '\n';
      });
    }

    const fileName = `水温记录_${new Date().toISOString().slice(0, 10)}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
    res.send('\uFEFF' + csvContent);
  });
}

module.exports = {
  exportExcel,
  exportCSV
};