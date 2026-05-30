import { v4 as uuidv4 } from 'uuid';
import type {
  Decision,
  Track,
  Vote,
  Copyright,
  Stats,
  FilterCriteria,
  DedupeRule,
} from '../../shared/types.js';
import { DecisionRepo } from '../repositories/DecisionRepo.js';
import { TrackRepo } from '../repositories/TrackRepo.js';
import { VoteRepo } from '../repositories/VoteRepo.js';
import { CopyrightRepo } from '../repositories/CopyrightRepo.js';
import { AuditRepo } from '../repositories/AuditRepo.js';
import { evaluateDecision } from '../engines/DecisionEngine.js';
import { filterTracks } from '../engines/FilterEngine.js';
import { dedupeVotes } from '../engines/DedupeEngine.js';

export class DecisionService {
  private decisionRepo: DecisionRepo;
  private trackRepo: TrackRepo;
  private voteRepo: VoteRepo;
  private copyrightRepo: CopyrightRepo;
  private auditRepo: AuditRepo;

  constructor() {
    this.decisionRepo = new DecisionRepo();
    this.trackRepo = new TrackRepo();
    this.voteRepo = new VoteRepo();
    this.copyrightRepo = new CopyrightRepo();
    this.auditRepo = new AuditRepo();
  }

  saveDecision(
    data: {
      name: string;
      selectedTrackIds: string[];
      filters: FilterCriteria;
      deduplicationRules: DedupeRule[];
      decisionReason?: string;
    },
    operator: string
  ): Decision {
    const allTracks = this.trackRepo.findAll();
    const allVotes = this.voteRepo.findAll();
    const allCopyrights = this.copyrightRepo.findAll();

    const dedupedVotes = dedupeVotes(allVotes, data.deduplicationRules);

    const filteredTracks = filterTracks(
      allTracks,
      dedupedVotes,
      allCopyrights,
      data.filters
    );

    const filteredTrackIds = new Set(filteredTracks.map(t => t.id));
    const validSelectedIds = data.selectedTrackIds.filter(id => filteredTrackIds.has(id));

    const evaluation = evaluateDecision(
      validSelectedIds,
      allTracks,
      dedupedVotes,
      allCopyrights
    );

    const decision: Omit<Decision, 'createdAt'> = {
      id: uuidv4(),
      name: data.name,
      selectedTrackIds: validSelectedIds,
      totalDuration: evaluation.totalDuration,
      totalVotes: evaluation.totalVotes,
      avgStamina: evaluation.avgStamina,
      copyrightRisk: evaluation.copyrightRisk,
      filters: data.filters,
      deduplicationRules: data.deduplicationRules,
      snapshot: {
        tracks: allTracks,
        votes: dedupedVotes,
        copyrights: allCopyrights,
      },
      decisionReason: data.decisionReason,
      createdBy: operator,
    };

    const created = this.decisionRepo.create(decision);

    this.auditRepo.create({
      id: uuidv4(),
      action: 'decision',
      entityType: 'decision',
      entityId: created.id,
      beforeChange: undefined,
      afterChange: created,
      operator,
      ip: undefined,
    });

    return created;
  }

  getDecisionStats(decisionId: string, selectedIds: string[]): Stats {
    const allTracks = this.trackRepo.findAll();
    const allVotes = this.voteRepo.findAll();
    const allCopyrights = this.copyrightRepo.findAll();

    const nonDuplicateVotes = allVotes.filter(v => !v.isDuplicate);
    const expiredCopyrights = allCopyrights.filter(c => c.warningLevel === 'high');

    const selectedTracks = allTracks.filter(t => selectedIds.includes(t.id));
    const totalDuration = selectedTracks.reduce((sum, t) => sum + t.duration, 0);
    const totalSelectedVotes = nonDuplicateVotes.filter(v => selectedIds.includes(v.trackId)).length;

    let avgStamina = 0;
    if (selectedTracks.length > 0) {
      avgStamina = selectedTracks.reduce((sum, t) => sum + t.staminaLevel, 0) / selectedTracks.length;
    }

    const selectedCopyrights = allCopyrights.filter(c => selectedIds.includes(c.trackId));
    const hasCopyrightRisk = selectedCopyrights.some(c => c.warningLevel === 'high');

    return {
      totalTracks: allTracks.length,
      totalVotes: nonDuplicateVotes.length,
      expiredCopyrights: expiredCopyrights.length,
      selectedCount: selectedIds.length,
      totalDuration,
      totalSelectedVotes,
      avgStamina,
      hasCopyrightRisk,
    };
  }

  toggleTrackInDecision(decisionId: string, trackId: string, selected: boolean): Decision | null {
    const decision = this.decisionRepo.findById(decisionId);
    if (!decision) return null;

    const before = { ...decision };

    if (selected) {
      this.decisionRepo.addTrackToDecision(decisionId, trackId);
    } else {
      this.decisionRepo.removeTrackFromDecision(decisionId, trackId);
    }

    const updated = this.decisionRepo.findById(decisionId);
    if (!updated) return null;

    const allTracks = decision.snapshot.tracks;
    const allVotes = decision.snapshot.votes;
    const allCopyrights = decision.snapshot.copyrights;

    const evaluation = evaluateDecision(
      updated.selectedTrackIds,
      allTracks,
      allVotes,
      allCopyrights
    );

    const finalUpdated = this.decisionRepo.update(decisionId, {
      totalDuration: evaluation.totalDuration,
      totalVotes: evaluation.totalVotes,
      avgStamina: evaluation.avgStamina,
      copyrightRisk: evaluation.copyrightRisk,
    });

    if (finalUpdated) {
      this.auditRepo.create({
        id: uuidv4(),
        action: 'update',
        entityType: 'decision',
        entityId: decisionId,
        beforeChange: before,
        afterChange: finalUpdated,
        operator: 'system',
        ip: undefined,
      });
    }

    return finalUpdated;
  }

  getDecisionWithSnapshot(id: string): (Decision & {
    tracks: Track[];
    votes: Vote[];
    copyrights: Copyright[];
  }) | null {
    const decision = this.decisionRepo.findById(id);
    if (!decision) return null;

    return {
      ...decision,
      tracks: decision.snapshot.tracks,
      votes: decision.snapshot.votes,
      copyrights: decision.snapshot.copyrights,
    };
  }
}

export default DecisionService;
