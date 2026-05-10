const { getDb } = require('../db/database');
const { generateId, formatDate } = require('../utils/generators');
const businessRules = require('../utils/rules');

const photoService = {
    getNextVersion(reportId, photoType) {
        const db = getDb();
        const latest = db.prepare(`
            SELECT MAX(version) as max_version FROM photo_versions 
            WHERE report_id = ? AND photo_type = ?
        `).get(reportId, photoType);
        
        return (latest.max_version || 0) + 1;
    },

    uploadPhoto(reportId, photoType, fileInfo, uploader, description) {
        const db = getDb();
        const report = db.prepare('SELECT * FROM reports WHERE id = ?').get(reportId);
        
        if (!report) {
            throw new Error('报案不存在');
        }
        
        if (!businessRules.validatePhotoType(photoType)) {
            throw new Error(`无效的照片类型: ${photoType}`);
        }

        const version = this.getNextVersion(reportId, photoType);
        const now = formatDate();

        const transaction = db.transaction(() => {
            db.prepare(`
                UPDATE photo_versions SET is_active = 0 WHERE report_id = ? AND photo_type = ? AND is_active = 1
            `).run(reportId, photoType);
            
            const photo = {
                id: generateId(),
                report_id: reportId,
                photo_type: photoType,
                version: version,
                file_path: fileInfo.file_path,
                file_name: fileInfo.file_name,
                upload_time: now,
                uploader: uploader,
                description: description || '',
                is_active: 1,
                created_at: now
            };

            db.prepare(`
                INSERT INTO photo_versions (
                    id, report_id, photo_type, version, file_path, file_name, upload_time, uploader, description, is_active, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(photo.id, photo.report_id, photo.photo_type, photo.version, photo.file_path, photo.file_name, photo.upload_time, photo.uploader, photo.description, photo.is_active, photo.created_at);
        });
        
        transaction();

        return this.getPhotosByReportId(reportId);
    },

    getPhotosByReportId(reportId, includeInactive = false) {
        const db = getDb();
        if (includeInactive) {
            return db.prepare('SELECT * FROM photo_versions WHERE report_id = ? ORDER BY photo_type, version').all(reportId);
        }
        return db.prepare('SELECT * FROM photo_versions WHERE report_id = ? AND is_active = 1 ORDER BY photo_type, version').all(reportId);
    },

    getAllPhotosByReportId(reportId) {
        return this.getPhotosByReportId(reportId, true);
    },

    getPhotoHistory(reportId, photoType, version) {
        const db = getDb();
        return db.prepare(`
            SELECT * FROM photo_versions 
            WHERE report_id = ? AND photo_type = ? AND version = ?
        `).get(reportId, photoType, version);
    },

    rollbackToVersion(reportId, photoType, targetVersion) {
        const db = getDb();
        const report = db.prepare('SELECT * FROM reports WHERE id = ?').get(reportId);
        
        if (!report) {
            throw new Error('报案不存在');
        }
        
        const targetPhoto = db.prepare(`
            SELECT * FROM photo_versions 
            WHERE report_id = ? AND photo_type = ? AND version = ?
        `).get(reportId, photoType, targetVersion);
        
        if (!targetPhoto) {
            throw new Error(`找不到版本 ${targetVersion} 的照片`);
        }
        
        const transaction = db.transaction(() => {
            db.prepare(`
                UPDATE photo_versions SET is_active = 0 
                WHERE report_id = ? AND photo_type = ?
            `).run(reportId, photoType);
            
            db.prepare(`
                UPDATE photo_versions SET is_active = 1 
                WHERE report_id = ? AND photo_type = ? AND version = ?
            `).run(reportId, photoType, targetVersion);
        });
        
        transaction();

        return this.getPhotosByReportId(reportId);
    }
};

module.exports = photoService;
