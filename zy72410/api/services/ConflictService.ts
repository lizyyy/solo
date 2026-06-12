import type { Material, Conflict, ConflictStatus, TunerMessage } from '../../shared/types.js';
import { MaterialRepository } from '../repositories/MaterialRepository.js';
import { MessageRepository } from '../repositories/MessageRepository.js';
import { detectConflict } from '../utils/detector.js';
import { SyncService } from './SyncService.js';

export class ConflictService {
  private materialRepo: MaterialRepository;
  private messageRepo: MessageRepository;
  private syncService: SyncService;

  constructor(
    materialRepo: MaterialRepository,
    messageRepo: MessageRepository,
    syncService: SyncService
  ) {
    this.materialRepo = materialRepo;
    this.messageRepo = messageRepo;
    this.syncService = syncService;
  }

  addTunerMessage(
    material_id: string,
    content: string,
    message_date: string,
    recorded_by: string
  ): { message: TunerMessage; conflicts: Conflict[] } {
    const material = this.materialRepo.findById(material_id);
    if (!material) throw new Error('Material not found');

    const message = this.messageRepo.createMessage({
      material_id,
      content,
      message_date,
      recorded_by,
      has_conflict: false,
      conflict_status: ''
    });

    const detection = detectConflict(material, content);
    const conflicts: Conflict[] = [];

    if (detection.has_conflict) {
      this.materialRepo.updateStatus(material_id, 'conflict');

      for (const conflict of detection.conflicts) {
        const created = this.messageRepo.createConflict({
          material_id,
          track_id: '',
          message_id: message.id,
          field_name: conflict.field_name,
          original_value: conflict.original_value,
          message_value: conflict.message_value,
          status: 'pending',
          evidence: conflict.evidence
        });
        conflicts.push(created);
      }
    }

    return { message, conflicts };
  }

  getConflicts(material_id?: string, status?: ConflictStatus): Conflict[] {
    if (material_id) {
      return this.messageRepo.findConflictsByMaterialId(material_id, status);
    }
    return this.messageRepo.findAllConflicts(status);
  }

  async resolveConflict(
    conflict_id: string,
    resolution: 'confirmed' | 'rejected',
    resolved_by: string
  ): Promise<Conflict> {
    const conflict = this.messageRepo.findConflictById(conflict_id);
    if (!conflict) throw new Error('Conflict not found');

    this.messageRepo.resolveConflict(conflict_id, resolution, resolved_by);

    await this.syncService.resolveConflict(
      conflict_id,
      conflict.material_id,
      conflict.field_name,
      conflict.original_value,
      conflict.message_value,
      resolved_by,
      resolution
    );

    const pendingConflicts = this.messageRepo.findConflictsByMaterialId(
      conflict.material_id,
      'pending'
    );

    if (pendingConflicts.length === 0) {
      const material = this.materialRepo.findById(conflict.material_id);
      if (material && material.status === 'conflict') {
        this.materialRepo.updateStatus(conflict.material_id, 'normal');
      }
    }

    return this.messageRepo.findConflictById(conflict_id)!;
  }

  getMessages(material_id: string): TunerMessage[] {
    return this.messageRepo.findMessagesByMaterialId(material_id);
  }

  getPendingConflictsCount(): number {
    return this.messageRepo.countPendingConflicts();
  }
}
