const express = require('express');
const router = express.Router();
const xlsx = require('xlsx');

const unifiedDataService = require('../services/unified-data-service');

function prepareForJsonExport(rows) {
  return rows.map(row => {
    const cleanRow = {};
    Object.keys(row).forEach(key => {
      if (key === '_evidenceLinks') return;
      const val = row[key];
      if (typeof val === 'object' && val !== null && 'url' in val) {
        if (val.full && val.full.length > 0) {
          cleanRow[key] = val.full.map(s => `${s.text}: ${s.url}`).join('; ');
        } else {
          cleanRow[key] = val.url || val.text || '';
        }
      } else {
        cleanRow[key] = val;
      }
    });
    return cleanRow;
  });
}

function prepareForExcelExport(rows) {
  return rows.map(row => {
    const excelRow = {};
    Object.keys(row).forEach(key => {
      if (key === '_evidenceLinks') return;
      const val = row[key];
      if (typeof val === 'object' && val !== null && 'url' in val) {
        if (val.full && val.full.length > 0) {
          excelRow[key] = {
            t: 's',
            v: val.full.map(s => s.text).join('; '),
            l: { Target: val.full[0].url }
          };
        } else if (val.url) {
          excelRow[key] = {
            t: 's',
            v: val.text,
            l: { Target: val.url }
          };
        } else {
          excelRow[key] = val.text || '-';
        }
      } else {
        excelRow[key] = val;
      }
    });
    return excelRow;
  });
}

router.get('/json', (req, res) => {
  unifiedDataService.getExportData((err, data) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    const cleanData = prepareForJsonExport(data);
    res.json({
      success: true,
      data: cleanData,
      count: cleanData.length
    });
  });
});

router.get('/excel', (req, res) => {
  unifiedDataService.getExportData((err, data) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    try {
      const excelData = prepareForExcelExport(data);
      const ws = xlsx.utils.json_to_sheet(excelData);
      const wb = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(wb, ws, '私募持仓穿透核对明细');

      const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
      const filename = `私募持仓穿透核对_${new Date().toISOString().slice(0, 10)}.xlsx`;
      const asciiFilename = `reconciliation_${new Date().toISOString().slice(0, 10)}.xlsx`;
      const encodedFilename = encodeURIComponent(filename).replace(/['()]/g, escape).replace(/\*/g, '%2A');

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodedFilename}`);
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
      const cleanData = prepareForJsonExport(data);

      if (cleanData.length === 0) {
        return res.send('');
      }

      const headers = Object.keys(cleanData[0]);
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
        ...cleanData.map(row => headers.map(h => escapeCsv(row[h])).join(','))
      ];

      const filename = `私募持仓穿透核对_${new Date().toISOString().slice(0, 10)}.csv`;
      const asciiFilename = `reconciliation_${new Date().toISOString().slice(0, 10)}.csv`;
      const encodedFilename = encodeURIComponent(filename).replace(/['()]/g, escape).replace(/\*/g, '%2A');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodedFilename}`);
      res.send('\ufeff' + csvRows.join('\n'));
    } catch (exportErr) {
      res.status(500).json({ error: '导出失败: ' + exportErr.message });
    }
  });
});

module.exports = router;
