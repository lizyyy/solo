import express from 'express';
import type { ApiResponse, ScreenshotData } from '../../shared/types';
import { unifiedResultRepository } from '../repositories/unifiedResultRepository';
import { conflictDetectionService } from '../services/conflictDetectionService';
import { recalculationService } from '../services/recalculationService';
import crypto from 'crypto';

const router = express.Router();

router.get('/', (req, res) => {
  const { records, dataHash } = unifiedResultRepository.getAllRecords();
  
  const response: ApiResponse<typeof records> = {
    success: true,
    data: records,
    timestamp: new Date().toISOString(),
    dataHash
  };
  
  res.json(response);
});

router.get('/:id', (req, res) => {
  const record = unifiedResultRepository.getRecordById(req.params.id);
  
  if (!record) {
    return res.status(404).json({
      success: false,
      message: '记录不存在',
      timestamp: new Date().toISOString(),
      dataHash: ''
    });
  }
  
  const response: ApiResponse<typeof record> = {
    success: true,
    data: record,
    timestamp: new Date().toISOString(),
    dataHash: crypto.createHash('md5').update(JSON.stringify(record)).digest('hex')
  };
  
  res.json(response);
});

router.post('/import', (req, res) => {
  const { records: importRecords, fileName, operator = '阿南' } = req.body;
  
  let imported = 0;
  let duplicates = 0;
  let nameInconsistencies = 0;
  const resultRecords = [];
  
  const fileHash = crypto.createHash('md5').update(fileName || Date.now().toString()).digest('hex');
  
  if (unifiedResultRepository.checkDuplicateImport(fileHash)) {
    return res.status(400).json({
      success: false,
      message: '该文件已导入过，请不要重复导入',
      timestamp: new Date().toISOString(),
      dataHash: ''
    });
  }
  
  for (const recordData of importRecords) {
    const duplicate = unifiedResultRepository.checkDuplicateInstitutionDate(
      recordData.institutionCode,
      recordData.custodianData?.confirmDate || new Date().toISOString().split('T')[0]
    );
    
    if (duplicate) {
      duplicates++;
      continue;
    }
    
    const nameConsistent = recordData.institutionNamePrev === recordData.institutionNameCurrent;
    if (!nameConsistent) {
      nameInconsistencies++;
    }
    
    const newRecord = unifiedResultRepository.addRecord({
      institutionCode: recordData.institutionCode,
      institutionNamePrev: recordData.institutionNamePrev,
      institutionNameCurrent: recordData.institutionNameCurrent,
      nameConsistent,
      creditLine: recordData.creditLine || 0,
      occupiedAmount: recordData.occupiedAmount || 0,
      availableAmount: recordData.availableAmount || 0,
      custodianData: {
        source: 'custodian',
        exDividendDate: recordData.custodianData?.exDividendDate || '',
        shareRatio: recordData.custodianData?.shareRatio || 0,
        totalShares: recordData.custodianData?.totalShares || 0,
        confirmDate: recordData.custodianData?.confirmDate || new Date().toISOString().split('T')[0],
        fileHash
      },
      hasConflict: false,
      status: nameConsistent ? 'imported' : 'abnormal',
      importTime: new Date().toISOString().replace('T', ' ').substring(0, 19),
      updateTime: new Date().toISOString().replace('T', ' ').substring(0, 19),
      operator,
      reviewStatus: 'pending'
    });
    
    imported++;
    resultRecords.push(newRecord);
  }
  
  unifiedResultRepository.addImportHistory({
    fileHash,
    fileName: fileName || '未命名文件.xlsx',
    importTime: new Date().toISOString().replace('T', ' ').substring(0, 19),
    operator,
    recordCount: imported
  });
  
  const { dataHash } = unifiedResultRepository.getAllRecords();
  
  res.json({
    success: true,
    data: {
      imported,
      duplicates,
      nameInconsistencies,
      records: resultRecords
    },
    message: `成功导入${imported}条记录，发现${duplicates}条重复，${nameInconsistencies}条机构简称不一致`,
    timestamp: new Date().toISOString(),
    dataHash
  });
});

router.post('/:id/screenshot', async (req, res) => {
  const { id } = req.params;
  const { screenshotData, operator = '阿南' } = req.body;
  
  const result = await conflictDetectionService.applyScreenshotData(
    id,
    {
      ...screenshotData,
      source: 'screenshot',
      uploadTime: new Date().toISOString().replace('T', ' ').substring(0, 19)
    },
    operator
  );
  
  if (!result) {
    return res.status(404).json({
      success: false,
      message: '记录不存在',
      timestamp: new Date().toISOString(),
      dataHash: ''
    });
  }
  
  const { dataHash } = unifiedResultRepository.getAllRecords();
  
  res.json({
    success: true,
    data: {
      hasConflict: result.hasConflict,
      conflicts: result.conflictEvidence || []
    },
    timestamp: new Date().toISOString(),
    dataHash
  });
});

router.post('/:id/resolve', async (req, res) => {
  const { id } = req.params;
  const { resolution, remark, operator = '阿南' } = req.body;
  
  const result = await conflictDetectionService.resolveConflict(
    id,
    resolution,
    remark,
    operator
  );
  
  if (!result) {
    return res.status(404).json({
      success: false,
      message: '记录不存在',
      timestamp: new Date().toISOString(),
      dataHash: ''
    });
  }
  
  const { dataHash } = unifiedResultRepository.getAllRecords();
  
  const response: ApiResponse<typeof result> = {
    success: true,
    data: result,
    message: `冲突已${resolution === 'confirm_custodian' ? '确认托管数据' : '驳回，以截图为准'}`,
    timestamp: new Date().toISOString(),
    dataHash
  };
  
  res.json(response);
});

router.post('/:id/supplement', async (req, res) => {
  const { id } = req.params;
  const { fields, operator = '阿南' } = req.body;
  
  const result = await recalculationService.supplementAndRecalculate(id, fields, operator);
  
  if (!result) {
    return res.status(404).json({
      success: false,
      message: '记录不存在',
      timestamp: new Date().toISOString(),
      dataHash: ''
    });
  }
  
  const { dataHash } = unifiedResultRepository.getAllRecords();
  
  const response: ApiResponse<typeof result> = {
    success: true,
    data: result,
    message: '补录完成，已自动重算额度',
    timestamp: new Date().toISOString(),
    dataHash
  };
  
  res.json(response);
});

router.get('/:id/logs', (req, res) => {
  const logs = unifiedResultRepository.getOperationLogsByRecordId(req.params.id);
  
  res.json({
    success: true,
    data: logs,
    timestamp: new Date().toISOString(),
    dataHash: crypto.createHash('md5').update(JSON.stringify(logs)).digest('hex')
  });
});

export default router;
