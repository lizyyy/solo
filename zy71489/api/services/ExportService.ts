import { v4 as uuidv4 } from 'uuid';
import { Parser } from 'json2csv';
import type {
  Decision,
  Track,
  Vote,
  Copyright,
  BadDataRecord,
  SourceInfo,
} from '../../shared/types.js';
import { DecisionRepo } from '../repositories/DecisionRepo.js';
import { BadDataRepo } from '../repositories/BadDataRepo.js';
import { AuditRepo } from '../repositories/AuditRepo.js';
import { calculateTotalDuration, formatDuration } from '../engines/DurationEngine.js';
import { dedupeVotes } from '../engines/DedupeEngine.js';

interface TrackDataSource {
  trackId: string;
  trackName: string;
  voteSources: SourceInfo[];
  copyrightSource?: SourceInfo;
  trackSource: SourceInfo;
}

interface DurationCalculationStep {
  trackId: string;
  trackName: string;
  duration: number;
  cumulative: number;
}

interface DedupeStats {
  totalVotes: number;
  duplicateVotes: number;
  uniqueVotes: number;
  duplicateDetails: Array<{
    voterId?: string;
    voterName?: string;
    trackName: string;
    duplicateCount: number;
  }>;
}

interface CopyrightRiskAssessment {
  totalTracks: number;
  highRisk: number;
  mediumRisk: number;
  lowRisk: number;
  noRisk: number;
  riskDetails: Array<{
    trackId: string;
    trackName: string;
    status: string;
    warningLevel: string;
    expiredAt?: string;
  }>;
}

interface AuditReport {
  decisionId: string;
  decisionName: string;
  createdAt: string;
  createdBy: string;
  filters: any;
  deduplicationRules: any;
  selectedTracks: Track[];
  trackDataSources: TrackDataSource[];
  durationCalculation: {
    steps: DurationCalculationStep[];
    total: number;
    formattedTotal: string;
  };
  dedupeStats: DedupeStats;
  copyrightRisk: CopyrightRiskAssessment;
  badDataRecords: BadDataRecord[];
  auditLogs: any[];
  exportTime: string;
}

export class ExportService {
  private decisionRepo: DecisionRepo;
  private badDataRepo: BadDataRepo;
  private auditRepo: AuditRepo;

  constructor() {
    this.decisionRepo = new DecisionRepo();
    this.badDataRepo = new BadDataRepo();
    this.auditRepo = new AuditRepo();
  }

  exportToJSON(decisionId: string): Decision | null {
    const decision = this.decisionRepo.findById(decisionId);
    if (!decision) return null;

    this.auditRepo.create({
      id: uuidv4(),
      action: 'export',
      entityType: 'decision',
      entityId: decisionId,
      beforeChange: undefined,
      afterChange: { format: 'JSON' },
      operator: 'system',
      ip: undefined,
    });

    return decision;
  }

  exportToCSV(decisionId: string): string | null {
    const decision = this.decisionRepo.findById(decisionId);
    if (!decision) return null;

    const { tracks, votes, copyrights } = decision.snapshot;
    const selectedTrackIds = new Set(decision.selectedTrackIds);

    const selectedTracks = tracks.filter(t => selectedTrackIds.has(t.id));
    const copyrightMap = new Map(copyrights.map(c => [c.trackId, c]));

    const nonDuplicateVotes = votes.filter(v => !v.isDuplicate);
    const voteCountMap = new Map<string, number>();
    for (const vote of nonDuplicateVotes) {
      voteCountMap.set(vote.trackId, (voteCountMap.get(vote.trackId) || 0) + 1);
    }

    const csvData = selectedTracks.map(track => {
      const copyright = copyrightMap.get(track.id);
      const voteCount = voteCountMap.get(track.id) || 0;

      return {
        id: track.id,
        name: track.name,
        artist: track.artist,
        duration: track.duration,
        durationFormatted: formatDuration(track.duration),
        staminaLevel: track.staminaLevel,
        voteCount,
        copyrightStatus: copyright?.status || 'unknown',
        copyrightWarningLevel: copyright?.warningLevel || 'none',
        sourceType: track.source.sourceType,
        notes: track.notes || '',
      };
    });

    const parser = new Parser();
    const csv = parser.parse(csvData);

    this.auditRepo.create({
      id: uuidv4(),
      action: 'export',
      entityType: 'decision',
      entityId: decisionId,
      beforeChange: undefined,
      afterChange: { format: 'CSV' },
      operator: 'system',
      ip: undefined,
    });

    return csv;
  }

  generateAuditReport(decisionId: string): AuditReport | null {
    const decision = this.decisionRepo.findById(decisionId);
    if (!decision) return null;

    const { tracks, votes, copyrights } = decision.snapshot;
    const selectedTrackIds = new Set(decision.selectedTrackIds);
    const selectedTracks = tracks.filter(t => selectedTrackIds.has(t.id));

    const trackDataSources: TrackDataSource[] = selectedTracks.map(track => {
      const trackVotes = votes.filter(v => v.trackId === track.id);
      const trackCopyright = copyrights.find(c => c.trackId === track.id);

      return {
        trackId: track.id,
        trackName: track.name,
        voteSources: trackVotes.map(v => v.source),
        copyrightSource: trackCopyright?.source,
        trackSource: track.source,
      };
    });

    const durationSteps: DurationCalculationStep[] = [];
    let cumulative = 0;
    for (const track of selectedTracks) {
      cumulative += track.duration;
      durationSteps.push({
        trackId: track.id,
        trackName: track.name,
        duration: track.duration,
        cumulative,
      });
    }

    const dedupedVotes = dedupeVotes(votes, decision.deduplicationRules);
    const duplicateVotes = dedupedVotes.filter(v => v.isDuplicate);
    const uniqueVotes = dedupedVotes.filter(v => !v.isDuplicate);

    const duplicateDetailsMap = new Map<string, number>();
    for (const vote of duplicateVotes) {
      const key = `${vote.voterId || ''}:${vote.voterName || ''}:${vote.trackName}`;
      duplicateDetailsMap.set(key, (duplicateDetailsMap.get(key) || 0) + 1);
    }

    const duplicateDetails = Array.from(duplicateDetailsMap.entries()).map(([key, count]) => {
      const [voterId, voterName, trackName] = key.split(':');
      return {
        voterId: voterId || undefined,
        voterName: voterName || undefined,
        trackName,
        duplicateCount: count,
      };
    });

    const dedupeStats: DedupeStats = {
      totalVotes: votes.length,
      duplicateVotes: duplicateVotes.length,
      uniqueVotes: uniqueVotes.length,
      duplicateDetails,
    };

    const selectedCopyrights = copyrights.filter(c => selectedTrackIds.has(c.trackId));
    const riskDetails = selectedCopyrights.map(c => ({
      trackId: c.trackId,
      trackName: c.trackName,
      status: c.status,
      warningLevel: c.warningLevel,
      expiredAt: c.expiredAt,
    }));

    const copyrightRisk: CopyrightRiskAssessment = {
      totalTracks: selectedTracks.length,
      highRisk: selectedCopyrights.filter(c => c.warningLevel === 'high').length,
      mediumRisk: selectedCopyrights.filter(c => c.warningLevel === 'medium').length,
      lowRisk: selectedCopyrights.filter(c => c.warningLevel === 'low').length,
      noRisk: selectedTracks.length - selectedCopyrights.length,
      riskDetails,
    };

    const allBadData = this.badDataRepo.findAll();
    const auditLogs = this.auditRepo.findByEntityId(decisionId);

    const report: AuditReport = {
      decisionId: decision.id,
      decisionName: decision.name,
      createdAt: decision.createdAt,
      createdBy: decision.createdBy,
      filters: decision.filters,
      deduplicationRules: decision.deduplicationRules,
      selectedTracks,
      trackDataSources,
      durationCalculation: {
        steps: durationSteps,
        total: calculateTotalDuration(decision.selectedTrackIds, tracks),
        formattedTotal: formatDuration(calculateTotalDuration(decision.selectedTrackIds, tracks)),
      },
      dedupeStats,
      copyrightRisk,
      badDataRecords: allBadData,
      auditLogs,
      exportTime: new Date().toISOString(),
    };

    this.auditRepo.create({
      id: uuidv4(),
      action: 'export',
      entityType: 'decision',
      entityId: decisionId,
      beforeChange: undefined,
      afterChange: { format: 'AuditReport' },
      operator: 'system',
      ip: undefined,
    });

    return report;
  }
}

export default ExportService;
