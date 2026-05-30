import { type Request, type Response } from 'express';
import VoteRepo from '../repositories/VoteRepo.js';

const voteRepo = new VoteRepo();

export async function getVotes(req: Request, res: Response): Promise<void> {
  try {
    const { isDuplicate } = req.query;
    let votes;

    if (isDuplicate !== undefined) {
      votes = voteRepo.findByDuplicateStatus(isDuplicate === 'true');
    } else {
      votes = voteRepo.findAll();
    }

    res.json({
      success: true,
      data: votes,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取投票列表失败',
    });
  }
}

export async function getVotesByTrack(req: Request, res: Response): Promise<void> {
  try {
    const { trackId } = req.params;
    const votes = voteRepo.findByTrackId(trackId);

    res.json({
      success: true,
      data: votes,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取曲目投票失败',
    });
  }
}
