import { type Request, type Response } from 'express';
import BadDataRepo from '../repositories/BadDataRepo.js';

const badDataRepo = new BadDataRepo();

export async function getBadData(req: Request, res: Response): Promise<void> {
  try {
    const { errorType, importSession, limit } = req.query;
    let records;

    if (errorType && typeof errorType === 'string') {
      records = badDataRepo.findByErrorType(errorType as 'missing_field' | 'invalid_format' | 'invalid_duration' | 'duplicate' | 'unknown_track');
    } else if (importSession && typeof importSession === 'string') {
      records = badDataRepo.findByImportSession(importSession);
    } else if (limit) {
      records = badDataRepo.findRecent(parseInt(limit as string, 10));
    } else {
      records = badDataRepo.findAll();
    }

    res.json({
      success: true,
      data: records,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取坏数据档案失败',
    });
  }
}
