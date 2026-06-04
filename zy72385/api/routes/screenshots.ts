import { Router, Request, Response } from 'express';
import {
  getAllScreenshots,
  getScreenshotById,
  checkDuplicate,
  handleDuplicateUpload,
  createScreenshot,
  processScreenshot,
  calculateFileHash,
} from '../services/dedupeService.js';
import { recordChange } from '../services/auditService.js';
import crypto from 'crypto';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const screenshots = await getAllScreenshots();
    res.json(screenshots);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch screenshots' });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const screenshot = await getScreenshotById(req.params.id);
    if (!screenshot) {
      res.status(404).json({ error: 'Screenshot not found' });
      return;
    }
    res.json(screenshot);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch screenshot' });
  }
});

router.post('/check-duplicate', async (req: Request, res: Response) => {
  try {
    const { fileHash, fileName } = req.body;
    const result = await checkDuplicate(fileHash, fileName);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to check duplicate' });
  }
});

router.post('/upload', async (req: Request, res: Response) => {
  try {
    const { fileName, fileSize, uploader, fileContent, isDuplicate, duplicateOf } = req.body;

    let fileHash = req.body.fileHash;
    if (!fileHash && fileContent) {
      const buffer = Buffer.from(fileContent, 'base64');
      fileHash = await calculateFileHash(buffer);
    }

    if (isDuplicate && duplicateOf) {
      const duplicate = await handleDuplicateUpload(duplicateOf, {
        fileName,
        fileHash: fileHash || `dup-${Date.now()}`,
        fileSize,
        uploader,
      });
      res.json({
        screenshot: duplicate,
        isDuplicate: true,
        message: '已识别为重复截图，不会创建新的计算任务',
      });
      return;
    }

    const mockOcr = `泵站模拟数据 压力: ${0.3 + Math.random() * 0.2}MPa 流量: ${100 + Math.random() * 50}m³/h 采样时间: ${new Date().toISOString().slice(0, 19)}`;
    const mockExtracted = {
      pumpId: 'pump-demo',
      pressure: Number((0.3 + Math.random() * 0.2).toFixed(2)),
      flowRate: Math.round(100 + Math.random() * 50),
      sampleTime: new Date().toISOString().slice(0, 19),
      temperature: Math.round(25 + Math.random() * 5),
    };

    const screenshot = await createScreenshot({
      fileName,
      fileHash: fileHash || `hash-${Date.now()}`,
      fileSize,
      uploader,
      status: 'processed',
      ocrData: mockOcr,
      extractedData: mockExtracted,
      imageUrl: `/mock/shot${Math.floor(Math.random() * 4) + 1}.svg`,
    });

    res.json({
      screenshot,
      isDuplicate: false,
      message: '截图导入成功',
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to upload screenshot' });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { extractedData, ocrData, changedBy, changeReason } = req.body;

    const screenshot = await getScreenshotById(id);
    if (!screenshot) {
      res.status(404).json({ error: 'Screenshot not found' });
      return;
    }

    if (extractedData && screenshot.extractedData) {
      for (const [field, value] of Object.entries(extractedData)) {
        const key = field as keyof typeof screenshot.extractedData;
        const oldVal = screenshot.extractedData[key];
        if (oldVal !== value) {
          await recordChange(
            'screenshot',
            id,
            `extractedData.${field}`,
            oldVal,
            value,
            changeReason || '修正提取数据',
            changedBy || 'user-1',
            screenshot.calculationIds
          );
          (screenshot.extractedData as any)[key] = value;
        }
      }
    }

    if (ocrData && ocrData !== screenshot.ocrData) {
      await recordChange(
        'screenshot',
        id,
        'ocrData',
        screenshot.ocrData,
        ocrData,
        changeReason || '修正OCR识别结果',
        changedBy || 'user-1',
        screenshot.calculationIds
      );
      screenshot.ocrData = ocrData;
    }

    res.json(screenshot);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update screenshot' });
  }
});

export default router;
