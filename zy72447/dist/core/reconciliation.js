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
    let groupRecords = state.groupRecords;
    let contractRecords = state.contractRecords;
    if (lateContractBatchId) {
        contractRecords = contractRecords.filter((c) => c.importBatchId === lateContractBatchId);
    }
    let existingResults = state.results;
    let skipped = 0;
    if (preserveConfirmed && lateContractBatchId) {
        const confirmedGroupIds = new Set(existingResults
            .filter((r) => r.status === types_1.RecordStatus.CONFIRMED && r.groupRecordId)
            .map((r) => r.groupRecordId));
        groupRecords = groupRecords.filter((g) => !confirmedGroupIds.has(g.id));
        skipped = existingResults.filter((r) => r.status === types_1.RecordStatus.CONFIRMED).length;
    }
    const candidates = findMatches(groupRecords, contractRecords);
    let created = 0;
    let updated = 0;
    for (const candidate of candidates) {
        const existing = existingResults.find((r) => (candidate.groupRecord && r.groupRecordId === candidate.groupRecord.id) ||
            (candidate.contractRecord && r.contractRecordId === candidate.contractRecord.id));
        const status = candidate.reviewReasons.length > 0 ? types_1.RecordStatus.NEEDS_REVIEW : types_1.RecordStatus.MATCHED;
        if (existing) {
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
                reviewReasons: [...new Set([...existing.reviewReasons, ...candidate.reviewReasons])],
                isLateContractRefresh: !!lateContractBatchId || existing.isLateContractRefresh
            }, operator, lateContractBatchId ? '晚到合同材料刷新' : '重新核对');
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
                isLateContractRefresh: !!lateContractBatchId
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