import { v4 as uuidv4 } from 'uuid';
import type { Track, TrackWithRelations, SourceInfo } from '../../shared/types.js';
import { TrackRepo } from '../repositories/TrackRepo.js';
import { AuditRepo } from '../repositories/AuditRepo.js';
import { VoteRepo } from '../repositories/VoteRepo.js';
import { CopyrightRepo } from '../repositories/CopyrightRepo.js';

export class TrackService {
  private trackRepo: TrackRepo;
  private auditRepo: AuditRepo;
  private voteRepo: VoteRepo;
  private copyrightRepo: CopyrightRepo;

  constructor() {
    this.trackRepo = new TrackRepo();
    this.auditRepo = new AuditRepo();
    this.voteRepo = new VoteRepo();
    this.copyrightRepo = new CopyrightRepo();
  }

  createTrack(
    data: Omit<Track, 'id' | 'createdAt' | 'updatedAt' | 'source'> & { source?: SourceInfo },
    operator: string
  ): Track {
    const source: SourceInfo = data.source || {
      sourceType: 'manual',
      importedBy: operator,
      importedAt: new Date().toISOString(),
    };

    const track: Omit<Track, 'createdAt' | 'updatedAt'> = {
      id: uuidv4(),
      name: data.name,
      artist: data.artist,
      duration: data.duration,
      staminaLevel: data.staminaLevel,
      notes: data.notes,
      source,
    };

    const created = this.trackRepo.create(track);

    this.auditRepo.create({
      id: uuidv4(),
      action: 'create',
      entityType: 'track',
      entityId: created.id,
      beforeChange: undefined,
      afterChange: created,
      operator,
      ip: undefined,
    });

    return created;
  }

  updateTrack(
    id: string,
    data: Partial<Omit<Track, 'id' | 'createdAt' | 'updatedAt' | 'source'>>,
    operator: string
  ): Track | null {
    const before = this.trackRepo.findById(id);
    if (!before) return null;

    const updated = this.trackRepo.update(id, data);
    if (!updated) return null;

    this.auditRepo.create({
      id: uuidv4(),
      action: 'update',
      entityType: 'track',
      entityId: id,
      beforeChange: before,
      afterChange: updated,
      operator,
      ip: undefined,
    });

    return updated;
  }

  deleteTrack(id: string, operator: string): boolean {
    const before = this.trackRepo.findById(id);
    if (!before) return false;

    const success = this.trackRepo.delete(id);
    if (!success) return false;

    this.auditRepo.create({
      id: uuidv4(),
      action: 'delete',
      entityType: 'track',
      entityId: id,
      beforeChange: before,
      afterChange: undefined,
      operator,
      ip: undefined,
    });

    return true;
  }

  getTrackWithRelations(id: string, selectedIds: string[] = []): TrackWithRelations | null {
    const track = this.trackRepo.findById(id);
    if (!track) return null;

    const voteCount = this.voteRepo.countByTrackId(id);
    const copyright = this.copyrightRepo.findByTrackId(id);
    const isSelected = selectedIds.includes(id);

    return {
      ...track,
      voteCount,
      copyright: copyright ?? undefined,
      isSelected,
    };
  }
}

export default TrackService;
