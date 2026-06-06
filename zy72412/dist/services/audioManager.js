"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addAudioFile = addAudioFile;
exports.updateAudioRemark = updateAudioRemark;
exports.getAudioFileById = getAudioFileById;
exports.getAudioFilesByBatch = getAudioFilesByBatch;
exports.getAudioFilesByTicket = getAudioFilesByTicket;
exports.getAllAudioFiles = getAllAudioFiles;
const database_1 = require("../db/database");
const authReminder_1 = require("./authReminder");
function addAudioFile(fileId, fileName, ticketNo, batchId, uploadedBy) {
    const db = (0, database_1.getDb)();
    const now = new Date().toISOString();
    try {
        const existingIdx = db.audioFiles.findIndex(a => a.fileId === fileId);
        if (existingIdx >= 0) {
            return db.audioFiles[existingIdx];
        }
        const audio = {
            id: (0, database_1.getNextAudioId)(),
            fileId,
            fileName,
            ticketNo,
            batchId,
            uploadedBy,
            uploadedAt: now
        };
        db.audioFiles.push(audio);
        const ticketIdx = db.tickets.findIndex(t => t.ticketNo === ticketNo);
        if (ticketIdx >= 0) {
            db.tickets[ticketIdx].audioFileId = fileId;
            db.tickets[ticketIdx].updatedAt = now;
        }
        (0, database_1.saveDb)();
        return audio;
    }
    catch (error) {
        console.error('添加音频文件失败:', error);
        return null;
    }
}
function updateAudioRemark(ticketId, remark, operator) {
    const db = (0, database_1.getDb)();
    const now = new Date().toISOString();
    try {
        const ticketRow = db.tickets.find(t => t.id === ticketId);
        if (!ticketRow)
            return false;
        if (ticketRow.audioFileId) {
            const audioIdx = db.audioFiles.findIndex(a => a.fileId === ticketRow.audioFileId);
            if (audioIdx >= 0) {
                db.audioFiles[audioIdx].remark = remark;
                db.audioFiles[audioIdx].verifiedBy = operator;
                db.audioFiles[audioIdx].verifiedAt = now;
            }
        }
        (0, database_1.saveDb)();
        (0, authReminder_1.updateReminderAfterAudioRemark)(ticketId, remark);
        return true;
    }
    catch (error) {
        console.error('更新音频备注失败:', error);
        return false;
    }
}
function getAudioFileById(fileId) {
    const db = (0, database_1.getDb)();
    const audio = db.audioFiles.find(a => a.fileId === fileId);
    return audio || null;
}
function getAudioFilesByBatch(batchId) {
    const db = (0, database_1.getDb)();
    return db.audioFiles
        .filter(a => a.batchId === batchId)
        .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
}
function getAudioFilesByTicket(ticketNo) {
    const db = (0, database_1.getDb)();
    const audio = db.audioFiles.find(a => a.ticketNo === ticketNo);
    return audio || null;
}
function getAllAudioFiles() {
    const db = (0, database_1.getDb)();
    return [...db.audioFiles]
        .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
}
