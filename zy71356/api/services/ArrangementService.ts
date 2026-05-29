import {
  ArrangementRepository,
  AssignmentRepository,
  SwapLogRepository,
  ConflictRepository,
} from '../repositories/ArrangementRepository';
import { VendorRepository } from '../repositories/VendorRepository';
import { StallRepository } from '../repositories/StallRepository';
import { ConflictDetectionService } from './ConflictDetectionService';
import {
  Arrangement,
  Assignment,
  SwapLog,
  Conflict,
  ArrangementWithDetails,
  AssignmentWithDetails,
} from '../../shared/types';

export class ArrangementService {
  private arrangementRepository: ArrangementRepository;
  private assignmentRepository: AssignmentRepository;
  private swapLogRepository: SwapLogRepository;
  private conflictRepository: ConflictRepository;
  private vendorRepository: VendorRepository;
  private stallRepository: StallRepository;
  private conflictDetectionService: ConflictDetectionService;

  constructor() {
    this.arrangementRepository = new ArrangementRepository();
    this.assignmentRepository = new AssignmentRepository();
    this.swapLogRepository = new SwapLogRepository();
    this.conflictRepository = new ConflictRepository();
    this.vendorRepository = new VendorRepository();
    this.stallRepository = new StallRepository();
    this.conflictDetectionService = new ConflictDetectionService();
  }

  getAllArrangements(): Arrangement[] {
    return this.arrangementRepository.findAll();
  }

  getArrangementById(id: string): ArrangementWithDetails | undefined {
    const arrangement = this.arrangementRepository.findById(id);
    if (!arrangement) return undefined;

    const assignments = this.assignmentRepository.findByArrangement(id);
    const conflicts = this.conflictRepository.findByArrangement(id);
    const swapLogs = this.swapLogRepository.findByArrangement(id);

    return {
      ...arrangement,
      assignments,
      conflicts,
      swapLogs,
    };
  }

  getLatestArrangement(): ArrangementWithDetails | undefined {
    const latest = this.arrangementRepository.findLatest();
    if (!latest) return undefined;
    return this.getArrangementById(latest.id);
  }

  createArrangement(
    data: Omit<Arrangement, 'id' | 'createdAt'>
  ): Arrangement {
    return this.arrangementRepository.create(data);
  }

  updateArrangement(
    id: string,
    data: Partial<Omit<Arrangement, 'id' | 'createdAt' | 'createdBy'>>
  ): Arrangement | undefined {
    return this.arrangementRepository.update(id, data);
  }

  assignVendorToStall(
    arrangementId: string,
    stallId: string,
    vendorId: string,
    source: string = '手动分配'
  ): Assignment | undefined {
    const existing = this.assignmentRepository.findByStall(
      arrangementId,
      stallId
    );
    if (existing) {
      this.assignmentRepository.deleteByStall(arrangementId, stallId);
    }

    const assignment = this.assignmentRepository.create({
      arrangementId,
      stallId,
      vendorId,
      source,
    });

    this.detectAndSaveConflicts(arrangementId);

    return assignment;
  }

  removeAssignment(
    arrangementId: string,
    stallId: string
  ): boolean {
    const result = this.assignmentRepository.deleteByStall(
      arrangementId,
      stallId
    );
    if (result) {
      this.detectAndSaveConflicts(arrangementId);
    }
    return result;
  }

  swapVendors(
    arrangementId: string,
    stallA: string,
    stallB: string,
    reason: string,
    operator: string
  ): { success: boolean; message?: string } {
    const assignmentA = this.assignmentRepository.findByStall(
      arrangementId,
      stallA
    );
    const assignmentB = this.assignmentRepository.findByStall(
      arrangementId,
      stallB
    );

    if (!assignmentA && !assignmentB) {
      return {
        success: false,
        message: '两个摊位都没有分配摊主，无需换位',
      };
    }

    if (!reason.trim()) {
      const stallAData = this.stallRepository.findById(stallA);
      const stallBData = this.stallRepository.findById(stallB);
      const unrecordedConflict = this.conflictDetectionService.detectUnrecordedSwap(
        arrangementId,
        stallA,
        stallB,
        stallAData?.name || stallA,
        stallBData?.name || stallB
      );
      this.conflictRepository.create(unrecordedConflict);
    } else {
      this.swapLogRepository.create({
        arrangementId,
        stallA,
        stallB,
        reason,
        operator,
      });
    }

    const vendorA = assignmentA?.vendorId;
    const vendorB = assignmentB?.vendorId;

    if (assignmentA) {
      this.assignmentRepository.deleteByStall(arrangementId, stallA);
    }
    if (assignmentB) {
      this.assignmentRepository.deleteByStall(arrangementId, stallB);
    }

    if (vendorB) {
      this.assignmentRepository.create({
        arrangementId,
        stallId: stallA,
        vendorId: vendorB,
        source: `换位自 ${stallB}`,
      });
    }
    if (vendorA) {
      this.assignmentRepository.create({
        arrangementId,
        stallId: stallB,
        vendorId: vendorA,
        source: `换位自 ${stallA}`,
      });
    }

    this.detectAndSaveConflicts(arrangementId);

    return { success: true };
  }

  detectConflicts(arrangementId: string): Conflict[] {
    return this.detectAndSaveConflicts(arrangementId);
  }

  getSwapLogs(arrangementId: string): SwapLog[] {
    return this.swapLogRepository.findByArrangement(arrangementId);
  }

  getAssignmentsWithDetails(
    arrangementId: string
  ): AssignmentWithDetails[] {
    const assignments = this.assignmentRepository.findByArrangement(arrangementId);
    const vendors = this.vendorRepository.findAll();
    const stalls = this.stallRepository.findAll();

    return assignments
      .map((a) => {
        const vendor = vendors.find((v) => v.id === a.vendorId);
        const stall = stalls.find((s) => s.id === a.stallId);
        if (!vendor || !stall) return null;
        return { ...a, vendor, stall };
      })
      .filter((a): a is AssignmentWithDetails => a !== null);
  }

  createNewVersion(
    sourceArrangementId: string,
    newVersion: string,
    name: string,
    createdBy: string,
    note?: string
  ): ArrangementWithDetails | undefined {
    const source = this.arrangementRepository.findById(sourceArrangementId);
    if (!source) return undefined;

    const newArrangement = this.arrangementRepository.create({
      version: newVersion,
      name,
      createdBy,
      note,
    });

    const sourceAssignments = this.assignmentRepository.findByArrangement(
      sourceArrangementId
    );
    const newAssignments = sourceAssignments.map((a) => ({
      arrangementId: newArrangement.id,
      stallId: a.stallId,
      vendorId: a.vendorId,
      source: `复制自版本 ${source.version}`,
    }));

    if (newAssignments.length > 0) {
      this.assignmentRepository.bulkCreate(newAssignments);
    }

    this.detectAndSaveConflicts(newArrangement.id);

    return this.getArrangementById(newArrangement.id);
  }

  private detectAndSaveConflicts(arrangementId: string): Conflict[] {
    this.conflictRepository.deleteByArrangement(arrangementId);

    const assignments = this.assignmentRepository.findByArrangement(arrangementId);
    const vendors = this.vendorRepository.findAll();
    const stalls = this.stallRepository.findAll();

    const conflicts = this.conflictDetectionService.detectConflicts(
      arrangementId,
      assignments,
      vendors,
      stalls
    );

    if (conflicts.length > 0) {
      return this.conflictRepository.bulkCreate(conflicts);
    }

    return [];
  }
}
