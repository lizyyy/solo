import { Router, Request, Response } from 'express';
import { contractService } from '../services/contractService';
import { verifyService } from '../services/verifyService';
import { ContractStatus, VerifyResult } from '../types';
import path from 'path';

const router = Router();

router.post('/suppliers', async (req: Request, res: Response) => {
  try {
    const { name, publicKey, signAlgorithm } = req.body;
    if (!name || !publicKey) {
      return res.status(400).json({ error: '供应商名称和公钥不能为空' });
    }
    const result = await contractService.createSupplier(name, publicKey, signAlgorithm);
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : '创建供应商失败' });
  }
});

router.get('/suppliers/:supplierId', async (req: Request, res: Response) => {
  try {
    const supplier = await contractService.getSupplier(req.params.supplierId);
    if (!supplier) {
      return res.status(404).json({ success: false, error: '供应商不存在' });
    }
    res.json({ success: true, data: supplier });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : '查询供应商失败' });
  }
});

router.post('/contracts', async (req: Request, res: Response) => {
  try {
    const { supplierId, version, callbackUrl, expectedFields, signHeaderName } = req.body;
    if (!supplierId || !version || !callbackUrl || !expectedFields) {
      return res.status(400).json({ error: '参数不完整' });
    }
    const result = await contractService.createContractVersion(
      supplierId, version, callbackUrl, expectedFields, signHeaderName
    );
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : '创建契约版本失败' });
  }
});

router.get('/contracts/:contractId', async (req: Request, res: Response) => {
  try {
    const contract = await contractService.getContractVersion(req.params.contractId);
    if (!contract) {
      return res.status(404).json({ success: false, error: '契约版本不存在' });
    }
    res.json({ success: true, data: contract });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : '查询契约版本失败' });
  }
});

router.post('/samples', async (req: Request, res: Response) => {
  try {
    const { supplierId, contractVersionId, headers, body } = req.body;
    if (!supplierId || !contractVersionId || !headers || !body) {
      return res.status(400).json({ error: '参数不完整' });
    }
    const sample = await contractService.createCallbackSample(supplierId, contractVersionId, headers, body);
    const conclusion = await contractService.processSample(sample.sampleId);
    
    const fieldDiffs = await verifyService.getFieldDiffs(sample.sampleId);
    
    res.json({
      success: true,
      data: {
        sampleId: sample.sampleId,
        conclusionId: conclusion?.id,
        conclusion
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : '处理样例失败' });
  }
});

router.get('/samples/:sampleId', async (req: Request, res: Response) => {
  try {
    const sample = await contractService.getCallbackSample(req.params.sampleId);
    if (!sample) {
      return res.status(404).json({ success: false, error: '样例不存在' });
    }
    res.json({ success: true, data: sample });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : '查询样例失败' });
  }
});

router.get('/conclusions/:conclusionId', async (req: Request, res: Response) => {
  try {
    const conclusion = await verifyService.getConclusion(req.params.conclusionId);
    if (!conclusion) {
      return res.status(404).json({ success: false, error: '验收结论不存在' });
    }
    const fieldDiffs = await verifyService.getFieldDiffs(conclusion.callback_sample_id);
    const auditLogs = await verifyService.getAuditLogs(req.params.conclusionId);
    
    res.json({ success: true, data: { conclusion, fieldDiffs, auditLogs } });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : '查询验收结论失败' });
  }
});

router.put('/conclusions/:conclusionId/status', async (req: Request, res: Response) => {
  try {
    const { newStatus, operator, remark } = req.body;
    if (!newStatus || !operator) {
      return res.status(400).json({ error: '状态和操作人不能为空' });
    }
    const result = await contractService.updateStatus(
      req.params.conclusionId,
      newStatus as ContractStatus,
      operator,
      remark
    );
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : '更新状态失败' });
  }
});

router.post('/conclusions/:conclusionId/correct', async (req: Request, res: Response) => {
  try {
    const { correctedResult, operator, correctionRemark } = req.body;
    if (!correctedResult || !operator || !correctionRemark) {
      return res.status(400).json({ error: '修正结果、操作人和修正说明不能为空' });
    }
    const result = await contractService.manualCorrect(
      req.params.conclusionId,
      correctedResult as VerifyResult,
      operator,
      correctionRemark
    );
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : '人工修正失败' });
  }
});

router.get('/conclusions', async (req: Request, res: Response) => {
  try {
    const { supplierId, status, overallResult, startDate, endDate } = req.query;
    const results = await contractService.queryConclusions({
      supplierId: supplierId as string,
      status: status as ContractStatus,
      overallResult: overallResult as VerifyResult,
      startDate: startDate as string,
      endDate: endDate as string
    });
    res.json({ success: true, data: results, count: results.length });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : '查询验收结论列表失败' });
  }
});

router.get('/conclusions/:conclusionId/trace', async (req: Request, res: Response) => {
  try {
    const trace = await contractService.getExceptionTrace(req.params.conclusionId);
    res.json({ success: true, data: trace });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : '获取异常追溯信息失败' });
  }
});

router.post('/export', async (req: Request, res: Response) => {
  try {
    const { supplierId, status, startDate, endDate } = req.body;
    const exportPath = path.join(__dirname, '../../exports', `conclusions_${Date.now()}.csv`);
    
    const result = await contractService.exportToCSV({
      supplierId,
      status: status as ContractStatus,
      startDate,
      endDate
    }, exportPath);
    
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : '导出失败' });
  }
});

export default router;
