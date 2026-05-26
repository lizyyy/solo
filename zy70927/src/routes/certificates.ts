import { Router, Request, Response } from 'express';
import { getCertificateById, getCertificatesByBatchId } from '../services/certificate';

const router = Router();

router.get('/:certificateId', async (req: Request, res: Response) => {
  try {
    const { certificateId } = req.params;
    const certificate = await getCertificateById(certificateId);

    if (!certificate) {
      return res.status(404).json({
        error: '证书不存在',
      });
    }

    res.status(200).json(certificate);
  } catch (error) {
    console.error('查询证书失败:', error);
    res.status(500).json({
      error: '服务器内部错误',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

router.get('/batch/:batchId', async (req: Request, res: Response) => {
  try {
    const { batchId } = req.params;
    const certificates = await getCertificatesByBatchId(batchId);

    res.status(200).json({
      batchId,
      count: certificates.length,
      certificates,
    });
  } catch (error) {
    console.error('查询批次证书失败:', error);
    res.status(500).json({
      error: '服务器内部错误',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

export default router;
