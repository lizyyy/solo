"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.candidateService = exports.CandidateService = void 0;
const types_1 = require("../types");
const store_1 = require("../store");
class CandidateService {
    createCandidate(request) {
        const duplicates = store_1.store.findByPhoneOrEmail(request.phone, request.email);
        let status = types_1.CandidateStatus.PENDING_MERGE;
        let conflictCandidateIds;
        if (duplicates.length > 0) {
            status = types_1.CandidateStatus.CONFLICT_REVIEW;
            conflictCandidateIds = duplicates.map(d => d.id);
            duplicates.forEach(d => {
                if (d.status !== types_1.CandidateStatus.MERGED) {
                    store_1.store.updateCandidate(d.id, {
                        status: types_1.CandidateStatus.CONFLICT_REVIEW,
                        conflictCandidateIds: [...(d.conflictCandidateIds || [])]
                    });
                }
            });
        }
        const candidate = store_1.store.addCandidate({
            ...request,
            status,
            conflictCandidateIds
        });
        if (conflictCandidateIds) {
            conflictCandidateIds.forEach(conflictId => {
                const conflict = store_1.store.getCandidate(conflictId);
                if (conflict) {
                    store_1.store.updateCandidate(conflictId, {
                        conflictCandidateIds: [...(conflict.conflictCandidateIds || []), candidate.id]
                    });
                }
            });
        }
        return { candidate, conflicts: duplicates };
    }
    getCandidate(id) {
        return store_1.store.getCandidate(id);
    }
    updateCandidate(id, request) {
        return store_1.store.updateCandidate(id, request);
    }
    listCandidates(query) {
        let candidates = store_1.store.getAllCandidates();
        if (query.status) {
            candidates = candidates.filter(c => c.status === query.status);
        }
        if (query.sourceChannel) {
            candidates = candidates.filter(c => c.sourceChannel === query.sourceChannel);
        }
        if (query.keyword) {
            const keyword = query.keyword.toLowerCase();
            candidates = candidates.filter(c => c.name.toLowerCase().includes(keyword) ||
                c.phone.includes(keyword) ||
                c.email.toLowerCase().includes(keyword));
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
    reviewCandidate(request) {
        const candidate = store_1.store.getCandidate(request.candidateId);
        if (!candidate)
            return undefined;
        store_1.store.addMergeHistory({
            candidateId: request.candidateId,
            action: request.action,
            operator: request.operator,
            remark: request.remark,
            targetCandidateId: request.targetCandidateId
        });
        switch (request.action) {
            case types_1.MergeAction.MERGE:
                if (request.targetCandidateId) {
                    store_1.store.updateCandidate(candidate.id, {
                        status: types_1.CandidateStatus.MERGED,
                        mergedIntoId: request.targetCandidateId
                    });
                    if (candidate.conflictCandidateIds) {
                        candidate.conflictCandidateIds.forEach(conflictId => {
                            const conflict = store_1.store.getCandidate(conflictId);
                            if (conflict && conflict.status === types_1.CandidateStatus.CONFLICT_REVIEW) {
                                const remainingConflicts = conflict.conflictCandidateIds?.filter(id => id !== candidate.id);
                                store_1.store.updateCandidate(conflictId, {
                                    status: remainingConflicts && remainingConflicts.length > 0
                                        ? types_1.CandidateStatus.CONFLICT_REVIEW
                                        : types_1.CandidateStatus.PENDING_MERGE,
                                    conflictCandidateIds: remainingConflicts
                                });
                            }
                        });
                    }
                }
                break;
            case types_1.MergeAction.KEEP_INDEPENDENT:
                store_1.store.updateCandidate(candidate.id, {
                    status: types_1.CandidateStatus.KEEP_INDEPENDENT
                });
                if (candidate.conflictCandidateIds) {
                    candidate.conflictCandidateIds.forEach(conflictId => {
                        const conflict = store_1.store.getCandidate(conflictId);
                        if (conflict && conflict.status === types_1.CandidateStatus.CONFLICT_REVIEW) {
                            const remainingConflicts = conflict.conflictCandidateIds?.filter(id => id !== candidate.id);
                            store_1.store.updateCandidate(conflictId, {
                                status: remainingConflicts && remainingConflicts.length > 0
                                    ? types_1.CandidateStatus.CONFLICT_REVIEW
                                    : types_1.CandidateStatus.PENDING_MERGE,
                                conflictCandidateIds: remainingConflicts
                            });
                        }
                    });
                }
                break;
            case types_1.MergeAction.WITHDRAW:
                store_1.store.updateCandidate(candidate.id, {
                    status: types_1.CandidateStatus.PENDING_MERGE
                });
                break;
        }
        return store_1.store.getCandidate(request.candidateId);
    }
    getMergeHistory(candidateId) {
        return store_1.store.getMergeHistoriesByCandidate(candidateId);
    }
    getAllMergeHistories() {
        return store_1.store.getAllMergeHistories();
    }
}
exports.CandidateService = CandidateService;
exports.candidateService = new CandidateService();
