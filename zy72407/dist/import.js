"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseTunerMessage = parseTunerMessage;
exports.parseGroupSignup = parseGroupSignup;
exports.createConsumptionRecordsFromTuner = createConsumptionRecordsFromTuner;
exports.mergeGroupSignupToRecords = mergeGroupSignupToRecords;
const uuid_1 = require("uuid");
const types_1 = require("./types");
function parseTunerMessage(lines, batchId, operator) {
    const now = new Date().toISOString();
    const records = [];
    lines.forEach((line, index) => {
        if (!line.trim())
            return;
        const parts = line.split(/[，,|\t]+/).map(p => p.trim());
        if (parts.length < 5)
            return;
        const record = {
            id: (0, uuid_1.v4)(),
            originalLineNumber: index + 1,
            rawContent: line,
            studentName: parts[0] || '',
            courseDate: parts[1] || '',
            courseTime: parts[2] || '',
            teacherName: parts[3] || '',
            courseType: parts[4] || '陪练',
            durationMinutes: parseInt(parts[5]) || 45,
            remark: parts[6],
            importBatchId: batchId,
            importedAt: now
        };
        records.push(record);
    });
    const batch = {
        id: batchId,
        source: types_1.DataSource.TUNER_MESSAGE,
        fileName: `tuner_${batchId}.txt`,
        importedAt: now,
        operator,
        recordCount: records.length,
        rawData: lines
    };
    return { batch, records };
}
function parseGroupSignup(lines, batchId, operator) {
    const now = new Date().toISOString();
    const records = [];
    lines.forEach((line, index) => {
        if (!line.trim())
            return;
        const parts = line.split(/[，,|\t]+/).map(p => p.trim());
        if (parts.length < 4)
            return;
        const isOnSite = parts.some(p => p.includes('现场') || p.includes('到') || p.includes('是'));
        const record = {
            id: (0, uuid_1.v4)(),
            originalLineNumber: index + 1,
            rawContent: line,
            studentName: parts[0] || '',
            courseDate: parts[1] || '',
            courseTime: parts[2] || '',
            teacherName: parts[3] || '',
            isOnSite,
            remark: parts[4],
            importBatchId: batchId,
            importedAt: now
        };
        records.push(record);
    });
    const batch = {
        id: batchId,
        source: types_1.DataSource.GROUP_SIGNUP,
        fileName: `group_${batchId}.txt`,
        importedAt: now,
        operator,
        recordCount: records.length,
        rawData: lines
    };
    return { batch, records };
}
function createConsumptionRecordsFromTuner(tunerRecords) {
    const now = new Date().toISOString();
    return tunerRecords.map(tuner => ({
        id: (0, uuid_1.v4)(),
        studentName: tuner.studentName,
        courseDate: tuner.courseDate,
        courseTime: tuner.courseTime,
        teacherName: tuner.teacherName,
        courseType: tuner.courseType,
        durationMinutes: tuner.durationMinutes,
        isOnSite: false,
        status: types_1.RecordStatus.IMPORTED,
        reviewFlag: types_1.ReviewFlag.NONE,
        tunerMessageId: tuner.id,
        tunerOriginalLineNumber: tuner.originalLineNumber,
        tunerRawContent: tuner.rawContent,
        manualEdits: [],
        createdAt: now,
        updatedAt: now
    }));
}
function mergeGroupSignupToRecords(existingRecords, groupRecords) {
    const now = new Date().toISOString();
    const updatedRecords = [...existingRecords];
    const usedGroupIds = new Set();
    updatedRecords.forEach(record => {
        const match = groupRecords.find(group => {
            if (usedGroupIds.has(group.id))
                return false;
            return (group.studentName === record.studentName &&
                group.courseDate === record.courseDate &&
                (group.courseTime === record.courseTime ||
                    group.teacherName === record.teacherName));
        });
        if (match) {
            usedGroupIds.add(match.id);
            record.groupSignupId = match.id;
            record.groupOriginalLineNumber = match.originalLineNumber;
            record.groupRawContent = match.rawContent;
            record.isOnSite = match.isOnSite;
            record.status = types_1.RecordStatus.MATCHED;
            record.matchedBy = 'auto';
            record.matchedAt = now;
            record.updatedAt = now;
        }
    });
    groupRecords.forEach(group => {
        if (!usedGroupIds.has(group.id)) {
            const isTempSub = group.remark?.includes('临时') ||
                group.remark?.includes('替补') ||
                group.rawContent.includes('临时') ||
                group.rawContent.includes('替补');
            const newRecord = {
                id: (0, uuid_1.v4)(),
                studentName: group.studentName,
                courseDate: group.courseDate,
                courseTime: group.courseTime,
                teacherName: group.teacherName,
                courseType: '陪练',
                durationMinutes: 45,
                isOnSite: group.isOnSite,
                status: isTempSub ? types_1.RecordStatus.NEEDS_REVIEW : types_1.RecordStatus.IMPORTED,
                reviewFlag: isTempSub ? types_1.ReviewFlag.TEMP_SUB_ONLY_IN_GROUP : types_1.ReviewFlag.NONE,
                groupSignupId: group.id,
                groupOriginalLineNumber: group.originalLineNumber,
                groupRawContent: group.rawContent,
                manualEdits: [],
                createdAt: now,
                updatedAt: now
            };
            updatedRecords.push(newRecord);
        }
    });
    return updatedRecords;
}
//# sourceMappingURL=import.js.map