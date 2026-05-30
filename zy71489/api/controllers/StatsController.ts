import { type Request, type Response } from 'express';
import TrackRepo from '../repositories/TrackRepo.js';
import VoteRepo from '../repositories/VoteRepo.js';
import CopyrightRepo from '../repositories/CopyrightRepo.js';
import DecisionRepo from '../repositories/DecisionRepo.js';
import type { Stats, Decision } from '../../shared/types.js';

const trackRepo = new TrackRepo();
const voteRepo = new VoteRepo();
const copyrightRepo = new CopyrightRepo();
const decisionRepo = new DecisionRepo();

export async function getStats(req: Request, res: Response): Promise<void> {
  try {
    const totalTracks = trackRepo.count();
    const totalVotes = voteRepo.count();
    const expiredCopyrights = copyrightRepo.countExpired();

    const recentDecisions = decisionRepo.findRecent(1);
    const currentDecision = recentDecisions[0] as Decision | undefined;

    let selectedCount = 0;
    let totalDuration = 0;
    let totalSelectedVotes = 0;
    let avgStamina = 0;
    let hasCopyrightRisk = false;

    if (currentDecision) {
      selectedCount = currentDecision.selectedTrackIds.length;
      totalDuration = currentDecision.totalDuration;
      totalSelectedVotes = currentDecision.totalVotes;
      avgStamina = currentDecision.avgStamina;
      hasCopyrightRisk = currentDecision.copyrightRisk === 'high' || currentDecision.copyrightRisk === 'medium';
    }

    const stats: Stats = {
      totalTracks,
      totalVotes,
      expiredCopyrights,
      selectedCount,
      totalDuration,
      totalSelectedVotes,
      avgStamina,
      hasCopyrightRisk,
    };

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取统计信息失败',
    });
  }
}
