import { type Request, type Response } from 'express';
import CopyrightRepo from '../repositories/CopyrightRepo.js';

const copyrightRepo = new CopyrightRepo();

export async function getCopyrights(req: Request, res: Response): Promise<void> {
  try {
    const { status, warningLevel } = req.query;
    let copyrights;

    if (status && typeof status === 'string') {
      copyrights = copyrightRepo.findByStatus(status as 'active' | 'expired' | 'pending' | 'restricted');
    } else if (warningLevel && typeof warningLevel === 'string') {
      copyrights = copyrightRepo.findByWarningLevel(warningLevel as 'high' | 'medium' | 'low');
    } else {
      copyrights = copyrightRepo.findAll();
    }

    res.json({
      success: true,
      data: copyrights,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取版权列表失败',
    });
  }
}

export async function getCopyrightByTrack(req: Request, res: Response): Promise<void> {
  try {
    const { trackId } = req.params;
    const copyright = copyrightRepo.findByTrackId(trackId);

    res.json({
      success: true,
      data: copyright,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取曲目版权失败',
    });
  }
}
