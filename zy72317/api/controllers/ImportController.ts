import { Request, Response } from 'express';
import multer from 'multer';
import Papa from 'papaparse';
import { importService } from '../services/ImportService';
import { hashService } from '../services/HashService';

const storage = multer.memoryStorage();
export const upload = multer({ storage });

export class ImportController {
  async importCSV(req: Request, res: Response) {
    try {
      if (!req.file) {
        return res.status(400).json({ error: '请上传CSV文件' });
      }

      const operator = req.body.operator || '吴老师';
      const forceReimport = req.body.forceReimport === 'true' || req.body.forceReimport === true;

      const result = await importService.importCSV(
        req.file.buffer,
        req.file.originalname,
        operator,
        forceReimport
      );

      return res.json(result);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }

  async checkDuplicate(req: Request, res: Response) {
    try {
      if (!req.file) {
        return res.status(400).json({ error: '请上传CSV文件' });
      }

      const fileContent = req.file.buffer.toString('utf-8');
      const parseResult = Papa.parse(fileContent, {
        header: true,
        skipEmptyLines: true,
      });

      const result = await importService.checkDuplicate(fileContent, parseResult.data as any[]);

      return res.json(result);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }

  async getBatches(req: Request, res: Response) {
    try {
      const batches = importService.getImportBatches();
      return res.json(batches);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }
}

export const importController = new ImportController();
