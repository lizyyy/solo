export function attachSamplingNote(record, note, manualChange) {
    const updated = {
        originalLineNumber: record.originalLineNumber,
        note,
        manualChange,
        currentStatus: record.processingStatus,
        updatedAt: new Date().toISOString(),
    };
    return { ...record, samplingIntervalNote: updated };
}
export function updateProcessingStatus(record, newStatus, reason) {
    const prevStatus = record.processingStatus;
    const updatedNote = record.samplingIntervalNote
        ? {
            ...record.samplingIntervalNote,
            currentStatus: newStatus,
            manualChange: `status ${prevStatus} -> ${newStatus}, reason: ${reason}`,
            updatedAt: new Date().toISOString(),
        }
        : null;
    return {
        ...record,
        processingStatus: newStatus,
        samplingIntervalNote: updatedNote,
    };
}
export function getEvidenceSummary(record) {
    const parts = [];
    parts.push(`line ${record.originalLineNumber}, belt ${record.beltId}`);
    parts.push(`tension ${record.tensionValue}${record.unit}, threshold ${record.thresholdValue}${record.unit}`);
    if (record.isOverThreshold) {
        parts.push("over threshold");
    }
    if (record.avgMasked) {
        parts.push("masked by average but over-threshold fact preserved");
    }
    parts.push(`status: ${statusLabel(record.processingStatus)}`);
    if (record.samplingIntervalNote) {
        parts.push(`sampling note: ${record.samplingIntervalNote.note}`);
        if (record.samplingIntervalNote.manualChange) {
            parts.push(`manual change: ${record.samplingIntervalNote.manualChange}`);
        }
    }
    return parts.join("; ");
}
function statusLabel(s) {
    const map = {
        pending_review: "pending review",
        confirmed_normal: "confirmed normal",
        confirmed_abnormal: "confirmed abnormal",
        overridden_by_average: "overridden by average",
    };
    return map[s];
}
//# sourceMappingURL=evidence-trail.js.map