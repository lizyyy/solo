"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findMatches = findMatches;
exports.runReconciliation = runReconciliation;
exports.confirmResult = confirmResult;
exports.rejectResult = rejectResult;
exports.rollbackResult = rollbackResult;
const types_1 = require("../types");
function normalizeName(name) {
    if (!name)
        return '';
    return name.toLowerCase().replace(/\s+/g, '').replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '');
}
function isNameMatch(a, b) {
    const normA = normalizeName(a);
    const normB = normalizeName(b);
    if (!normA || !normB)
        return false;
    if (normA === normB)
        return true;
    return normA.includes(normB) || normB.includes(normA);
}
function findMatches(groupRecords, contractRecords) {
    const candidates = [];
    const usedContractIds = new Set();
    const usedGroupIds = new Set();
    for (const group of groupRecords) {
        if (usedGroupIds.has(group.id))
            continue;
        let bestMatch;
        let bestScore = 0;
        let reasons = [];
        for (const contract of contractRecords) {
            if (usedContractIds.has(contract.id))
                continue;
            let score = 0;
            const currentReasons = [];
            if (isNameMatch(group.performerName, contract.performerName)) {
                score += 50;
            }
            if (isNameMatch(group.songName, contract.songName)) {
                score += 30;
            }
            if (group.isTemporarySubstitute) {
                currentReasons.push(types_1.ReviewReason.TEMP_SUBSTITUTE_ONLY_IN_GROUP);
            }
            if (score > bestScore) {
                bestScore = score;
                bestMatch = contract;
                reasons = currentReasons;
            }
        }
        if (bestMatch && bestScore >= 30) {
            usedGroupIds.add(group.id);
            usedContractIds.add(bestMatch.id);
            if (!reasons.includes(types_1.ReviewReason.TEMP_SUBSTITUTE_ONLY_IN_GROUP)) {
                if (!bestMatch.performerName) {
                    reasons.push(types_1.ReviewReason.CONTRACT_MISSING);
                }
            }
            candidates.push({
                groupRecord: group,
                contractRecord: bestMatch,
                matchScore: bestScore,
                reviewReasons: reasons
            });
        }
        else {
            candidates.push({
                groupRecord: group,
                matchScore: 0,
                reviewReasons: [
                    types_1.ReviewReason.CONTRACT_MISSING,
                    ...(group.isTemporarySubstitute ? [types_1.ReviewReason.TEMP_SUBSTITUTE_ONLY_IN_GROUP] : [])
                ]
            });
            usedGroupIds.add(group.id);
        }
    }
    for (const contract of contractRecords) {
        if (usedContractIds.has(contract.id))
            continue;
        candidates.push({
            contractRecord: contract,
            matchScore: 0,
            reviewReasons: [types_1.ReviewReason.GROUP_RECORD_MISSING]
        });
    }
    return candidates;
}
function runReconciliation(store, operator, options = {}) {
    const state = store.getState();
    const { lateContractBatchId, preserveConfirmed = true } = options;
    const allGroupRecords = state.groupRecords;
    const allContractRecords = state.contractRecords;
    let existingResults = state.results;
    let skipped = 0;
    let created = 0;
    let updated = 0;
    if (lateContractBatchId) {
        const lateContracts = allContractRecords.filter((c) => c.importBatchId === lateContractBatchId);
        if (lateContracts.length === 0) {
            return { created: 0, updated: 0, skipped: 0 };
        }
        const plans = [];
        const touchedResultIds = new Set();
        const usedLateContractIds = new Set();
        for (const contract of lateContracts) {
            let bestGroup = null;
            for (const result of existingResults) {
                if (touchedResultIds.has(result.id))
                    continue;
                if (preserveConfirmed && result.status === types_1.RecordStatus.CONFIRMED)
                    continue;
                const g = allGroupRecords.find((gr) => gr.id === result.groupRecordId);
                if (!g)
                    continue;
                const score = (isNameMatch(g.performerName, contract.performerName) ? 50 : 0) +
                    (isNameMatch(g.songName, contract.songName) ? 30 : 0);
                if (score >= 30 && (!bestGroup || score > bestGroup.score)) {
                    bestGroup = { record: g, result, score };
                }
            }
            if (bestGroup) {
                plans.push({
                    kind: 'update',
                    resultId: bestGroup.result.id,
                    groupRecord: bestGroup.record,
                    contractRecord: contract,
                    candidateReviewReasons: bestGroup.record.isTemporarySubstitute
                        ? [types_1.ReviewReason.TEMP_SUBSTITUTE_ONLY_IN_GROUP]
                        : []
                });
                touchedResultIds.add(bestGroup.result.id);
                usedLateContractIds.add(contract.id);
            }
        }
        {
            const unMatchedLate = lateContracts.filter((c) => !usedLateContractIds.has(c.id));
            for (const contract of unMatchedLate) {
                const orphanGroup = allGroupRecords.find((g) => {
                    if (existingResults.some((r) => r.groupRecordId === g.id))
                        return false;
                    const score = (isNameMatch(g.performerName, contract.performerName) ? 50 : 0) +
                        (isNameMatch(g.songName, contract.songName) ? 30 : 0);
                    return score >= 30;
                });
                if (orphanGroup) {
                    plans.push({
                        kind: 'create',
                        groupRecord: orphanGroup,
                        contractRecord: contract,
                        candidateReviewReasons: orphanGroup.isTemporarySubstitute
                            ? [types_1.ReviewReason.TEMP_SUBSTITUTE_ONLY_IN_GROUP]
                            : []
                    });
                    usedLateContractIds.add(contract.id);
                }
                else {
                    plans.push({
                        kind: 'create',
                        contractRecord: contract,
                        candidateReviewReasons: [types_1.ReviewReason.GROUP_RECORD_MISSING]
                    });
                }
            }
        }
        skipped = existingResults.filter((r) => preserveConfirmed && r.status === types_1.RecordStatus.CONFIRMED && !touchedResultIds.has(r.id)).length;
        for (const plan of plans) {
            if (plan.kind === 'update' && plan.resultId) {
                const oldResult = existingResults.find((r) => r.id === plan.resultId);
                let mergedReasons = [...oldResult.reviewReasons];
                if (plan.contractRecord) {
                    mergedReasons = mergedReasons.filter((r) => r !== types_1.ReviewReason.CONTRACT_MISSING);
                }
                for (const reason of plan.candidateReviewReasons) {
                    if (!mergedReasons.includes(reason))
                        mergedReasons.push(reason);
                }
                const newStatus = oldResult.status === types_1.RecordStatus.CONFIRMED
                    ? oldResult.status
                    : mergedReasons.length > 0
                        ? types_1.RecordStatus.NEEDS_REVIEW
                        : types_1.RecordStatus.MATCHED;
                store.updateResult(oldResult.id, {
                    groupRecordId: plan.groupRecord?.id || oldResult.groupRecordId,
                    contractRecordId: plan.contractRecord?.id || oldResult.contractRecordId,
                    matchedPerformerName: plan.groupRecord?.performerName ||
                        plan.contractRecord?.performerName ||
                        oldResult.matchedPerformerName,
                    matchedSongName: plan.groupRecord?.songName ||
                        plan.contractRecord?.songName ||
                        oldResult.matchedSongName,
                    status: newStatus,
                    reviewReasons: mergedReasons,
                    isLateContractRefresh: true
                }, operator, `晚到合同材料刷新: ${lateContractBatchId}`);
                updated++;
            }
            else {
                const status = plan.candidateReviewReasons.length > 0
                    ? types_1.RecordStatus.NEEDS_REVIEW
                    : types_1.RecordStatus.MATCHED;
                store.addResult({
                    groupRecordId: plan.groupRecord?.id,
                    contractRecordId: plan.contractRecord?.id,
                    matchedPerformerName: plan.groupRecord?.performerName || plan.contractRecord?.performerName,
                    matchedSongName: plan.groupRecord?.songName || plan.contractRecord?.songName,
                    status,
                    reviewReasons: plan.candidateReviewReasons,
                    isLateContractRefresh: true
                }, operator);
                created++;
            }
        }
        return { created, updated, skipped };
    }
    let groupRecords = allGroupRecords;
    let contractRecords = allContractRecords;
    if (preserveConfirmed) {
        const confirmedGroupIds = new Set(existingResults
            .filter((r) => r.status === types_1.RecordStatus.CONFIRMED && r.groupRecordId)
            .map((r) => r.groupRecordId));
        groupRecords = groupRecords.filter((g) => !confirmedGroupIds.has(g.id));
        skipped = existingResults.filter((r) => r.status === types_1.RecordStatus.CONFIRMED).length;
    }
    const candidates = findMatches(groupRecords, contractRecords);
    for (const candidate of candidates) {
        const existing = existingResults.find((r) => (candidate.groupRecord && r.groupRecordId === candidate.groupRecord.id) ||
            (candidate.contractRecord && r.contractRecordId === candidate.contractRecord.id));
        const status = candidate.reviewReasons.length > 0 ? types_1.RecordStatus.NEEDS_REVIEW : types_1.RecordStatus.MATCHED;
        if (existing) {
            let mergedReasons = [...candidate.reviewReasons];
            for (const reason of existing.reviewReasons) {
                if (reason === types_1.ReviewReason.TEMP_SUBSTITUTE_ONLY_IN_GROUP ||
                    reason === types_1.ReviewReason.MANUAL_REVIEW_REQUIRED ||
                    reason === types_1.ReviewReason.INFO_MISMATCH) {
                    if (!mergedReasons.includes(reason))
                        mergedReasons.push(reason);
                }
            }
            store.updateResult(existing.id, {
                groupRecordId: candidate.groupRecord?.id || existing.groupRecordId,
                contractRecordId: candidate.contractRecord?.id || existing.contractRecordId,
                matchedPerformerName: candidate.groupRecord?.performerName ||
                    candidate.contractRecord?.performerName ||
                    existing.matchedPerformerName,
                matchedSongName: candidate.groupRecord?.songName ||
                    candidate.contractRecord?.songName ||
                    existing.matchedSongName,
                status: existing.status === types_1.RecordStatus.CONFIRMED ? existing.status : status,
                reviewReasons: mergedReasons,
                isLateContractRefresh: existing.isLateContractRefresh
            }, operator, '全量重新核对');
            updated++;
        }
        else {
            store.addResult({
                groupRecordId: candidate.groupRecord?.id,
                contractRecordId: candidate.contractRecord?.id,
                matchedPerformerName: candidate.groupRecord?.performerName || candidate.contractRecord?.performerName,
                matchedSongName: candidate.groupRecord?.songName || candidate.contractRecord?.songName,
                status,
                reviewReasons: candidate.reviewReasons,
                isLateContractRefresh: false
            }, operator);
            created++;
        }
    }
    return { created, updated, skipped };
}
function confirmResult(store, resultId, operator, notes) {
    return store.updateResult(resultId, {
        status: types_1.RecordStatus.CONFIRMED,
        reviewedBy: operator,
        reviewedAt: new Date().toISOString(),
        reviewNotes: notes
    }, operator, '票务同事复核确认');
}
function rejectResult(store, resultId, operator, notes) {
    return store.updateResult(resultId, {
        status: types_1.RecordStatus.REJECTED,
        reviewedBy: operator,
        reviewedAt: new Date().toISOString(),
        reviewNotes: notes
    }, operator, '票务同事复核驳回');
}
function rollbackResult(store, resultId, operator, reason) {
    const result = store.getState().results.find((r) => r.id === resultId);
    if (!result)
        return undefined;
    const newStatus = result.reviewReasons.length > 0 ? types_1.RecordStatus.NEEDS_REVIEW : types_1.RecordStatus.MATCHED;
    return store.updateResult(resultId, {
        status: newStatus,
        reviewedBy: undefined,
        reviewedAt: undefined
    }, operator, `回滚: ${reason || '取消确认'}`);
}
//# sourceMappingURL=reconciliation.js.map