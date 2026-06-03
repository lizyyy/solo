const express = require('express');
const router = express.Router();
const xlsx = require('xlsx');

const unifiedDataService = require('../services/unified-data-service');

router.get('/json', (req, res) => {
  unifiedDataService.getExportData((err, data) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({
      success: true,
      data: data,
      count: data.length
    });
  });
});

router.get('/excel', (req, res) => {
  unifiedDataService.getExportData((err, data) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    try {
      const ws = xlsx.utils.json_to_sheet(data);
      const wb = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(wb, ws, '私募持仓穿透核对明细');

      const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
      const filename = `私募持仓穿透核对_${new Date().toISOString().slice(0, 10)}.xlsx`;

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(buffer);
    } catch (exportErr) {
      res.status(500).json({ error: '导出失败: ' + exportErr.message });
    }
  });
});

router.get('/csv', (req, res) => {
  unifiedDataService.getExportData((err, data) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    try {
      if (data.length === 0) {
        return res.send('');
      }

      const headers = Object.keys(data[0]);
      const escapeCsv = (val) => {
        if (val === null || val === undefined) return '';
        const str = String(val);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return '"' + str.replace(/"/g, '""') + '"';
        }
        return str;
      };

      const csvRows = [
        headers.join(','),
        ...data.map(row => headers.map(h => escapeCsv(row[h])).join(','))
      ];

      const filename = `私募持仓穿透核对_${new Date().toISOString().slice(0, 10)}.csv`;
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send('\ufeff' + csvRows.join('\n'));
    } catch (exportErr) {
      res.status(500).json({ error: '导出失败: ' + exportErr.message });
    }
  });
});

module.exports = router;
