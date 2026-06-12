import type { Material, Track, MaterialStatus, ChangeTraceNode } from '../../shared/types.js';
import { MaterialRepository } from '../repositories/MaterialRepository.js';
import { TrackRepository } from '../repositories/TrackRepository.js';
import { ChangeRepository } from '../repositories/ChangeRepository.js';
import { generateFieldLabel } from '../utils/detector.js';

export class SyncService {
  private materialRepo: MaterialRepository;
  private trackRepo: TrackRepository;
  private changeRepo: ChangeRepository;

  constructor(
    materialRepo: MaterialRepository,
    trackRepo: TrackRepository,
    changeRepo: ChangeRepository
  ) {
    this.materialRepo = materialRepo;
    this.trackRepo = trackRepo;
    this.changeRepo = changeRepo;
  }

  async updateMaterialField(
    material_id: string,
    field_name: string,
    old_value: string | number,
    new_value: string | number,
    operator: string,
    change_reason: string
  ): Promise<void> {
    const material = this.materialRepo.findById(material_id);
    if (!material) throw new Error('Material not found');

    this.materialRepo.updateField(material_id, field_name, new_value);

    const change = this.changeRepo.create({
      material_id,
      track_id: '',
      field_name,
      old_value: String(old_value),
      new_value: String(new_value),
      operator,
      change_reason,
      affected_items: [material_id]
    });

    const updatedMaterial = this.materialRepo.findById(material_id)!;
    const latestVersion = this.changeRepo.getLatestVersion(material_id);
    this.changeRepo.createHistoryRecord({
      material_id,
      track_id: '',
      field_name,
      old_value: String(old_value),
      new_value: String(new_value),
      operator,
      change_reason,
      record_snapshot: updatedMaterial as unknown as Record<string, unknown>,
      change_id: change.id
    });

    this.recalculateDependentFields(material_id, field_name, new_value);
  }

  async updateTrackRemarks(
    track_id: string,
    oldRemarks: string,
    newRemarks: string,
    operator: string,
    change_reason: string
  ): Promise<Track> {
    const track = this.trackRepo.findById(track_id);
    if (!track) throw new Error('Track not found');

    const updatedTrack = this.trackRepo.updateRemarks(track_id, newRemarks);

    const change = this.changeRepo.create({
      material_id: track.material_id,
      track_id,
      field_name: 'remarks',
      old_value: oldRemarks,
      new_value: newRemarks,
      operator,
      change_reason,
      affected_items: [track.material_id, track_id]
    });

    const latestVersion = this.changeRepo.getLatestVersion(track.material_id, track_id);
    this.changeRepo.createHistoryRecord({
      material_id: track.material_id,
      track_id,
      field_name: 'remarks',
      old_value: oldRemarks,
      new_value: newRemarks,
      operator,
      change_reason,
      record_snapshot: updatedTrack as unknown as Record<string, unknown>,
      change_id: change.id
    });

    return updatedTrack;
  }

  async updateTrackReworkChecked(
    track_id: string,
    operator: string
  ): Promise<void> {
    const track = this.trackRepo.findById(track_id);
    if (!track) throw new Error('Track not found');

    this.trackRepo.markReworkChecked(track_id, operator);

    this.changeRepo.create({
      material_id: track.material_id,
      track_id,
      field_name: 'rework_confirmed',
      old_value: 'false',
      new_value: 'true',
      operator,
      change_reason: '版权运营复核返工原因',
      affected_items: [track.material_id, track_id]
    });
  }

  recalculateDependentFields(
    material_id: string,
    changedField: string,
    new_value: string | number
  ): void {
    const material = this.materialRepo.findById(material_id);
    if (!material) return;

    let needsStatusUpdate = false;
    let newStatus: MaterialStatus = material.status;

    switch (changedField) {
      case 'license_fee':
      case 'episode_count':
        console.log(`Recalculating financial fields for material ${material_id}`);
        break;
      case 'license_end_date':
        const endDate = new Date(String(new_value));
        const now = new Date();
        if (endDate < now) {
          console.log(`Material ${material_id} authorization expired`);
        }
        break;
    }

    if (needsStatusUpdate) {
      this.materialRepo.updateStatus(material_id, newStatus);
    }
  }

  async recalculateAll(material_id: string, operator: string): Promise<void> {
    const material = this.materialRepo.findById(material_id);
    if (!material) throw new Error('Material not found');

    const tracks = this.trackRepo.findByMaterialId(material_id);

    this.changeRepo.create({
      material_id,
      track_id: '',
      field_name: 'recalculation',
      old_value: 'pre-recalculate',
      new_value: 'post-recalculate',
      operator,
      change_reason: '补录后触发全量重算',
      affected_items: [material_id, ...tracks.map(t => t.id)]
    });

    const allTracksHaveNoPendingRework = tracks.every(
      t => !t.need_recheck || t.rework_confirmed
    );
    const hasPendingConflicts = false;

    if (allTracksHaveNoPendingRework && !hasPendingConflicts) {
      this.materialRepo.updateStatus(material_id, 'completed');
    }

    const latestVersion = this.changeRepo.getLatestVersion(material_id);
    const updatedMaterial = this.materialRepo.findById(material_id)!;
    this.changeRepo.createHistoryRecord({
      material_id,
      track_id: '',
      field_name: 'recalculation',
      old_value: 'pre-recalculate',
      new_value: 'post-recalculate',
      operator,
      change_reason: '补录后触发全量重算',
      record_snapshot: updatedMaterial as unknown as Record<string, unknown>,
      change_id: ''
    });
  }

  async resolveConflict(
    conflict_id: string,
    material_id: string,
    field_name: string,
    old_value: string,
    new_value: string,
    operator: string,
    resolution: 'confirmed' | 'rejected'
  ): Promise<void> {
    const material = this.materialRepo.findById(material_id);
    if (!material) throw new Error('Material not found');

    if (resolution === 'confirmed') {
      let parsedValue: string | number = new_value;
      if (field_name === 'episode_count' || field_name === 'license_fee') {
        parsedValue = parseFloat(new_value);
      } else if (field_name === 'revenue_ratio') {
        const rate = parseFloat(new_value);
        parsedValue = rate > 1 ? rate / 100 : rate;
      }
      await this.updateMaterialField(
        material_id,
        field_name,
        old_value,
        parsedValue,
        operator,
        `许老师${resolution === 'confirmed' ? '确认' : '驳回'}调音师留言与授权期限页冲突，${resolution === 'confirmed' ? '以留言为准' : '保留原授权页数据'}：${generateFieldLabel(field_name)}`
      );
    } else {
      this.changeRepo.create({
        material_id,
        track_id: '',
        field_name: `${field_name}_conflict_rejected`,
        old_value,
        new_value: old_value,
        operator,
        change_reason: `许老师驳回冲突，保留原授权期限页数据：${generateFieldLabel(field_name)}`,
        affected_items: [material_id]
      });
    }
  }

  getChangeTrace(material_id: string): ChangeTraceNode[] {
    const changes = this.changeRepo.findByMaterialId(material_id);
    return changes.map(change => ({
      id: change.id,
      operator: change.operator,
      change_type: change.change_reason,
      change_reason: change.change_reason,
      field_name: change.field_name,
      old_value: change.old_value,
      new_value: change.new_value,
      changed_at: change.created_at,
      affected_items: change.affected_items
    }));
  }
}
