import express from 'express';
import { exportService } from '../services/exportService';
import crypto from 'crypto';

const router = express.Router();

router.get('/verify', (req, res) => {
  const pageHash = req.query.pageHash as string;
  
  const isConsistent = exportService.verifyConsistency(pageHash);
  
  res.json({
    success: true,
    data: {
      isConsistent,
      currentHash: exportService.getExportData().dataHash
    },
    message: isConsistent ? '数据一致，可以导出' : '数据不一致，页面数据与数据源有差异',
    timestamp: new Date().toISOString(),
    dataHash: exportService.getExportData().dataHash
  });
});

router.get('/', (req, res) => {
  const { records, dataHash } = exportService.getExportData();
  
  res.json({
    success: true,
    data: records,
    timestamp: new Date().toISOString(),
    dataHash
  });
});

router.get('/excel', (req, res) => {
  try {
    const { buffer, dataHash } = exportService.generateExcelBuffer();
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    const filename = encodeURIComponent(`授信额度明细_${new Date().toISOString().split('T')[0]}.xlsx`);
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${filename}`);
    res.setHeader('X-Data-Hash', dataHash);
    
    res.send(buffer);
  } catch (error: any) {
    console.error('导出Excel失败:', error);
    res.status(500).json({
      success: false,
      message: `导出失败: ${error?.message || String(error)}`,
      timestamp: new Date().toISOString(),
      dataHash: ''
    });
  }
});

export default router;
