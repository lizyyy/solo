import {
  Candidate,
  CandidateStatus,
  CreateCandidateRequest,
  UpdateCandidateRequest,
  ReviewRequest,
  MergeAction,
  CandidateQuery,
  PaginatedResult,
  SourceChannel
} from '../types';
import { store } from '../store';

export class CandidateService {
  createCandidate(request: CreateCandidateRequest): { candidate: Candidate; conflicts: Candidate[] } {
    const duplicates = store.findByPhoneOrEmail(request.phone, request.email);
    
    let status = CandidateStatus.PENDING_MERGE;
    let conflictCandidateIds: string[] | undefined;
    
    if (duplicates.length > 0) {
      status = CandidateStatus.CONFLICT_REVIEW;
      conflictCandidateIds = duplicates.map(d => d.id);
      
      duplicates.forEach(d => {
        if (d.status !== CandidateStatus.MERGED) {
          store.updateCandidate(d.id, {
            status: CandidateStatus.CONFLICT_REVIEW,
            conflictCandidateIds: [...(d.conflictCandidateIds || [])]
          });
        }
      });
    }

    const candidate = store.addCandidate({
      ...request,
      status,
      conflictCandidateIds
    });

    if (conflictCandidateIds) {
      conflictCandidateIds.forEach(conflictId => {
        const conflict = store.getCandidate(conflictId);
        if (conflict) {
          store.updateCandidate(conflictId, {
            conflictCandidateIds: [...(conflict.conflictCandidateIds || []), candidate.id]
          });
        }
      });
    }

    return { candidate, conflicts: duplicates };
  }

  getCandidate(id: string): Candidate | undefined {
    return store.getCandidate(id);
  }

  updateCandidate(id: string, request: UpdateCandidateRequest): Candidate | undefined {
    return store.updateCandidate(id, request);
  }

  listCandidates(query: CandidateQuery): PaginatedResult<Candidate> {
    let candidates = store.getAllCandidates();
    
    if (query.status) {
      candidates = candidates.filter(c => c.status === query.status);
    }
    
    if (query.sourceChannel) {
      candidates = candidates.filter(c => c.sourceChannel === query.sourceChannel);
    }
    
    if (query.keyword) {
      const keyword = query.keyword.toLowerCase();
      candidates = candidates.filter(c => 
        c.name.toLowerCase().includes(keyword) ||
        c.phone.includes(keyword) ||
        c.email.toLowerCase().includes(keyword)
      );
    }

    const page = query.page || 1;
    const pageSize = query.pageSize || 20;
    const start = (page - 1) * pageSize;
    const end = start + pageSize;

    return {
      data: candidates.slice(start, end),
      total: candidates.length,
      page,
      pageSize
    };
  }

  reviewCandidate(request: ReviewRequest): Candidate | undefined {
    const candidate = store.getCandidate(request.candidateId);
    if (!candidate) return undefined;

    store.addMergeHistory({
      candidateId: request.candidateId,
      action: request.action,
      operator: request.operator,
      remark: request.remark,
      targetCandidateId: request.targetCandidateId
    });

    switch (request.action) {
      case MergeAction.MERGE:
        if (request.targetCandidateId) {
          store.updateCandidate(candidate.id, {
            status: CandidateStatus.MERGED,
            mergedIntoId: request.targetCandidateId
          });
          
          if (candidate.conflictCandidateIds) {
            candidate.conflictCandidateIds.forEach(conflictId => {
              const conflict = store.getCandidate(conflictId);
              if (conflict && conflict.status === CandidateStatus.CONFLICT_REVIEW) {
                const remainingConflicts = conflict.conflictCandidateIds?.filter(id => id !== candidate.id);
                store.updateCandidate(conflictId, {
                  status: remainingConflicts && remainingConflicts.length > 0 
                    ? CandidateStatus.CONFLICT_REVIEW 
                    : CandidateStatus.PENDING_MERGE,
                  conflictCandidateIds: remainingConflicts
                });
              }
            });
          }
        }
        break;

      case MergeAction.KEEP_INDEPENDENT:
        store.updateCandidate(candidate.id, {
          status: CandidateStatus.KEEP_INDEPENDENT
        });
        
        if (candidate.conflictCandidateIds) {
          candidate.conflictCandidateIds.forEach(conflictId => {
            const conflict = store.getCandidate(conflictId);
            if (conflict && conflict.status === CandidateStatus.CONFLICT_REVIEW) {
              const remainingConflicts = conflict.conflictCandidateIds?.filter(id => id !== candidate.id);
              store.updateCandidate(conflictId, {
                status: remainingConflicts && remainingConflicts.length > 0 
                  ? CandidateStatus.CONFLICT_REVIEW 
                  : CandidateStatus.PENDING_MERGE,
                conflictCandidateIds: remainingConflicts
              });
            }
          });
        }
        break;

      case MergeAction.WITHDRAW:
        store.updateCandidate(candidate.id, {
          status: CandidateStatus.PENDING_MERGE
        });
        break;
    }

    return store.getCandidate(request.candidateId);
  }

  getMergeHistory(candidateId: string) {
    return store.getMergeHistoriesByCandidate(candidateId);
  }

  getAllMergeHistories() {
    return store.getAllMergeHistories();
  }
}

export const candidateService = new CandidateService();
