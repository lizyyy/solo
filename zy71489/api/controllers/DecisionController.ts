import { type Request, type Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import PDFDocument from 'pdfkit';
import DecisionRepo from '../repositories/DecisionRepo.js';
import TrackRepo from '../repositories/TrackRepo.js';
import VoteRepo from '../repositories/VoteRepo.js';
import CopyrightRepo from '../repositories/CopyrightRepo.js';
import AuditRepo from '../repositories/AuditRepo.js';
import { evaluateDecision } from '../engines/DecisionEngine.js';
import { dedupeVotes } from '../engines/DedupeEngine.js';
import { filterTracks } from '../engines/FilterEngine.js';
import type { Decision, FilterCriteria, DedupeRule, TrackWithRelations } from '../../shared/types.js';

const decisionRepo = new DecisionRepo();
const trackRepo = new TrackRepo();
const voteRepo = new VoteRepo();
const copyrightRepo = new CopyrightRepo();
const auditRepo = new AuditRepo();

export async function getDecisions(req: Request, res: Response): Promise<void> {
  try {
    const { limit, createdBy } = req.query;
    let decisions;

    if (createdBy && typeof createdBy === 'string') {
      decisions = decisionRepo.findByCreatedBy(createdBy);
    } else if (limit) {
      decisions = decisionRepo.findRecent(parseInt(limit as string, 10));
    } else {
      decisions = decisionRepo.findAll();
    }

    res.json({
      success: true,
      data: decisions,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取决策列表失败',
    });
  }
}

export async function getDecision(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const decision = decisionRepo.findById(id);

    if (!decision) {
      res.status(404).json({
        success: false,
        error: '决策不存在',
      });
      return;
    }

    res.json({
      success: true,
      data: decision,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取决策详情失败',
    });
  }
}

export async function createDecision(req: Request, res: Response): Promise<void> {
  try {
    const { name, selectedTrackIds, filters, deduplicationRules, decisionReason } = req.body;

    if (!name || !selectedTrackIds || !Array.isArray(selectedTrackIds)) {
      res.status(400).json({
        success: false,
        error: '缺少必填字段',
      });
      return;
    }

    const tracks = trackRepo.findAll();
    const votes = voteRepo.findAll();
    const copyrights = copyrightRepo.findAll();

    const defaultFilters: FilterCriteria = filters || {};
    const defaultDedupeRules: DedupeRule[] = deduplicationRules || [
      { field: 'voterId', enabled: true },
      { field: 'voterName', enabled: true },
      { field: 'trackName', enabled: false },
    ];

    const dedupedVotes = dedupeVotes(votes, defaultDedupeRules);
    const filteredTracks = filterTracks(tracks, dedupedVotes, copyrights, defaultFilters);

    const validSelectedIds = selectedTrackIds.filter((id: string) =>
      filteredTracks.some((t) => t.id === id)
    );

    const evaluation = evaluateDecision(validSelectedIds, tracks, dedupedVotes, copyrights);

    const decision: Omit<Decision, 'createdAt'> = {
      id: uuidv4(),
      name,
      selectedTrackIds: validSelectedIds,
      ...evaluation,
      filters: defaultFilters,
      deduplicationRules: defaultDedupeRules,
      snapshot: {
        tracks,
        votes: dedupedVotes,
        copyrights,
      },
      decisionReason,
      createdBy: req.ip || 'unknown',
    };

    const created = decisionRepo.create(decision);

    auditRepo.create({
      id: uuidv4(),
      action: 'decision',
      entityType: 'decision',
      entityId: created.id,
      afterChange: created,
      operator: req.ip || 'unknown',
      ip: req.ip,
    });

    res.status(201).json({
      success: true,
      data: created,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '创建决策失败',
    });
  }
}

export async function toggleTrack(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { trackId } = req.body;

    if (!trackId) {
      res.status(400).json({
        success: false,
        error: '缺少 trackId',
      });
      return;
    }

    const existing = decisionRepo.findById(id);
    if (!existing) {
      res.status(404).json({
        success: false,
        error: '决策不存在',
      });
      return;
    }

    const isSelected = existing.selectedTrackIds.includes(trackId);
    let updated;

    if (isSelected) {
      decisionRepo.removeTrackFromDecision(id, trackId);
    } else {
      decisionRepo.addTrackToDecision(id, trackId);
    }

    const updatedDecision = decisionRepo.findById(id)!;
    const evaluation = evaluateDecision(
      updatedDecision.selectedTrackIds,
      existing.snapshot.tracks,
      existing.snapshot.votes,
      existing.snapshot.copyrights
    );

    updated = decisionRepo.update(id, {
      selectedTrackIds: updatedDecision.selectedTrackIds,
      ...evaluation,
    });

    auditRepo.create({
      id: uuidv4(),
      action: 'update',
      entityType: 'decision',
      entityId: id,
      beforeChange: existing,
      afterChange: updated,
      operator: req.ip || 'unknown',
      ip: req.ip,
    });

    res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '切换曲目失败',
    });
  }
}

export async function exportDecision(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const decision = decisionRepo.findById(id);

    if (!decision) {
      res.status(404).json({
        success: false,
        error: '决策不存在',
      });
      return;
    }

    const { snapshot, selectedTrackIds } = decision;
    const selectedTracks = snapshot.tracks.filter((t) => selectedTrackIds.includes(t.id));
    const selectedVotes = snapshot.votes.filter((v) => selectedTrackIds.includes(v.trackId) && !v.isDuplicate);

    const trackWithRelations: TrackWithRelations[] = selectedTracks.map((track) => {
      const voteCount = selectedVotes.filter((v) => v.trackId === track.id).length;
      const copyright = snapshot.copyrights.find((c) => c.trackId === track.id);
      return {
        ...track,
        voteCount,
        copyright,
        isSelected: true,
      };
    });

    auditRepo.create({
      id: uuidv4(),
      action: 'export',
      entityType: 'decision',
      entityId: id,
      operator: req.ip || 'unknown',
      ip: req.ip,
    });

    const { format } = req.query;

    if (format === 'pdf') {
      const doc = new PDFDocument();
      const filename = `decision-${id}.pdf`;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      doc.pipe(res);

      doc.fontSize(24).text('演出返场曲单决策报告', { align: 'center' });
      doc.moveDown();
      doc.fontSize(14).text(`决策名称: ${decision.name}`);
      doc.text(`创建时间: ${decision.createdAt}`);
      doc.text(`创建人: ${decision.createdBy}`);
      doc.moveDown();

      doc.fontSize(16).text('决策概览');
      doc.fontSize(12).text(`选中曲目数: ${selectedTrackIds.length}`);
      doc.text(`总时长: ${Math.floor(decision.totalDuration / 60)}分${decision.totalDuration % 60}秒`);
      doc.text(`总票数: ${decision.totalVotes}`);
      doc.text(`平均体力值: ${decision.avgStamina.toFixed(1)}`);
      doc.text(`版权风险: ${decision.copyrightRisk}`);
      doc.moveDown();

      if (decision.decisionReason) {
        doc.fontSize(16).text('决策理由');
        doc.fontSize(12).text(decision.decisionReason);
        doc.moveDown();
      }

      doc.fontSize(16).text('选中曲目列表');
      doc.moveDown();

      trackWithRelations.forEach((track, index) => {
        doc.fontSize(14).text(`${index + 1}. ${track.name} - ${track.artist}`);
        doc.fontSize(12).text(`   时长: ${Math.floor(track.duration / 60)}分${track.duration % 60}秒 | 票数: ${track.voteCount} | 体力: ${track.staminaLevel}`);
        if (track.copyright) {
          doc.text(`   版权状态: ${track.copyright.status} | 风险等级: ${track.copyright.warningLevel}`);
        }
        doc.moveDown();
      });

      doc.end();
    } else {
      const allVotes = snapshot.votes;
      const duplicateVotes = allVotes.filter((v) => v.isDuplicate);
      const activeVotes = allVotes.filter((v) => !v.isDuplicate);

      const durationCalc = {
        totalSeconds: decision.totalDuration,
        totalFormatted: `${Math.floor(decision.totalDuration / 60)}分${decision.totalDuration % 60}秒`,
        breakdown: trackWithRelations.map((t) => ({
          trackId: t.id,
          trackName: t.name,
          duration: t.duration,
          formatted: `${Math.floor(t.duration / 60)}分${t.duration % 60}秒`,
        })),
      };

      const dedupeStats = {
        totalVotes: allVotes.length,
        activeVotes: activeVotes.length,
        duplicateVotes: duplicateVotes.length,
        rules: decision.deduplicationRules,
        duplicates: duplicateVotes.map((v) => ({
          id: v.id,
          voterId: v.voterId,
          trackId: v.trackId,
          duplicateOf: v.duplicateOf,
          source: v.source,
        })),
      };

      const copyrightRisk = {
        level: decision.copyrightRisk,
        expiredTracks: snapshot.copyrights.filter((c) => c.status === 'expired').map((c) => ({
          trackId: c.trackId,
          trackName: c.trackName,
          expiredAt: c.expiredAt,
          warningLevel: c.warningLevel,
          source: c.source,
        })),
        atRiskTracks: snapshot.copyrights.filter((c) => c.warningLevel === 'medium').map((c) => ({
          trackId: c.trackId,
          trackName: c.trackName,
          expiredAt: c.expiredAt,
          warningLevel: c.warningLevel,
          source: c.source,
        })),
      };

      const sourceTraces: any[] = [];
      snapshot.tracks.forEach((t) => {
        sourceTraces.push({
          entityType: 'track',
          entityId: t.id,
          name: t.name,
          source: t.source,
        });
      });
      activeVotes.forEach((v) => {
        sourceTraces.push({
          entityType: 'vote',
          entityId: v.id,
          voterName: v.voterName,
          trackId: v.trackId,
          source: v.source,
        });
      });
      snapshot.copyrights.forEach((c) => {
        sourceTraces.push({
          entityType: 'copyright',
          entityId: c.id,
          trackId: c.trackId,
          trackName: c.trackName,
          status: c.status,
          source: c.source,
        });
      });

      res.json({
        success: true,
        data: {
          decision: {
            id: decision.id,
            name: decision.name,
            createdAt: decision.createdAt,
            createdBy: decision.createdBy,
            decisionReason: decision.decisionReason,
            selectedTrackIds: decision.selectedTrackIds,
            totalDuration: decision.totalDuration,
            totalVotes: decision.totalVotes,
            avgStamina: decision.avgStamina,
            copyrightRisk: decision.copyrightRisk,
          },
          filters: decision.filters,
          deduplicationRules: decision.deduplicationRules,
          selectedTracks: trackWithRelations.map((t) => ({
            id: t.id,
            name: t.name,
            artist: t.artist,
            duration: t.duration,
            staminaLevel: t.staminaLevel,
            voteCount: t.voteCount,
            copyright: t.copyright,
            source: t.source,
          })),
          durationCalculation: durationCalc,
          deduplicationStats: dedupeStats,
          copyrightRiskAssessment: copyrightRisk,
          sourceTraces,
          exportTime: new Date().toISOString(),
          exportedBy: req.ip || 'unknown',
        },
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '导出决策报告失败',
    });
  }
}
