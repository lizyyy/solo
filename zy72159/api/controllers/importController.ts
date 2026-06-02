import type { Request, Response } from 'express';
import { importService } from '../services/importService';
import type { ImportRawItem } from '../../shared/types';

export class ImportController {
  async preview(req: Request, res: Response) {
    try {
      const { content, format } = req.body;
      if (!content) {
        return res.status(400).json({ error: '请提供导入内容' });
      }

      let items: ImportRawItem[];
      if (format === 'csv') {
        items = importService.parseCSV(content);
      } else {
        items = importService.parseJSON(content);
      }

      if (items.length === 0) {
        return res.status(400).json({ error: '未能解析出有效记录，请检查格式' });
      }

      const result = importService.previewImport(items);
      res.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : '导入预览失败';
      res.status(400).json({ error: message });
    }
  }

  async import(req: Request, res: Response) {
    try {
      const { content, format } = req.body;
      if (!content) {
        return res.status(400).json({ error: '请提供导入内容' });
      }

      let items: ImportRawItem[];
      if (format === 'csv') {
        items = importService.parseCSV(content);
      } else {
        items = importService.parseJSON(content);
      }

      if (items.length === 0) {
        return res.status(400).json({ error: '未能解析出有效记录，请检查格式' });
      }

      const result = await importService.importRawItems(items);
      res.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : '导入失败';
      res.status(400).json({ error: message });
    }
  }
}

export const importController = new ImportController();
