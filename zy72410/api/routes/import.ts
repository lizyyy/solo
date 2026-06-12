import express from 'express';
import type { Request, Response } from 'express';
import { ImportService } from '../services/ImportService.js';
import { getDb } from '../db/init.js';
import { MaterialRepository } from '../repositories/MaterialRepository.js';
import { TrackRepository } from '../repositories/TrackRepository.js';
import { ChangeRepository } from '../repositories/ChangeRepository.js';
import type { ApiResponse, ImportPreviewResult, ImportConfirmRequest } from '../../shared/types.js';

const router = express.Router();

const db = getDb();
const materialRepo = new MaterialRepository(db);
const trackRepo = new TrackRepository(db);
const changeRepo = new ChangeRepository(db);
const importService = new ImportService(materialRepo, trackRepo, changeRepo);

router.post('/preview', async (req: Request, res: Response) => {
  try {
    if (!req.body || !req.body.data || !req.body.file_name) {
      return res.status(400).json({
        success: false,
        error: '缺少导入数据或文件名'
      } as ApiResponse<null>);
    }

    const { data, file_name, imported_by } = req.body;
    const parsed = data.map((row: any) => importService['mapRowToMaterial'](row));
    const result = importService.previewImport(parsed, file_name, imported_by || '版权运营');

    res.json({
      success: true,
      data: result
    } as ApiResponse<ImportPreviewResult>);
  } catch (e: any) {
    res.status(500).json({
      success: false,
      error: e.message
    } as ApiResponse<null>);
  }
});

router.post('/confirm', async (req: Request, res: Response) => {
  try {
    const request = req.body as ImportConfirmRequest;
    const operator = req.body.operator || '版权运营';

    const result = importService.confirmImport(request, operator);

    res.json({
      success: true,
      data: result,
      message: `成功导入${result.materials.length}条素材，${result.tracks.length}条轨道`
    } as ApiResponse<any>);
  } catch (e: any) {
    res.status(500).json({
      success: false,
      error: e.message
    } as ApiResponse<null>);
  }
});

router.post('/parse-file', async (req: Request, res: Response) => {
  try {
    if (!req.body || !req.body.file_name || !req.body.fileContent) {
      return res.status(400).json({
        success: false,
        error: '缺少文件数据'
      } as ApiResponse<null>);
    }

    const { file_name, fileContent } = req.body;
    const buffer = Buffer.from(fileContent, 'base64');
    const parsed = importService.parseFile(buffer, file_name);

    res.json({
      success: true,
      data: parsed
    } as ApiResponse<any>);
  } catch (e: any) {
    res.status(500).json({
      success: false,
      error: e.message
    } as ApiResponse<null>);
  }
});

export default router;
