"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentService = void 0;
const uuid_1 = require("uuid");
const classifier_1 = require("./classifier");
class DocumentService {
    constructor(db) {
        this.db = db;
    }
    async createBatch(createdBy, description) {
        const batchId = (0, uuid_1.v4)();
        const batchNumber = `BATCH-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        await this.db.run(`INSERT INTO batches (id, batch_number, created_by, description)
       VALUES (?, ?, ?, ?)`, [batchId, batchNumber, createdBy, description || null]);
        return this.db.get('SELECT * FROM batches WHERE id = ?', [batchId]);
    }
    async getBatch(batchId) {
        return this.db.get('SELECT * FROM batches WHERE id = ?', [batchId]);
    }
    async getAllBatches() {
        return this.db.all('SELECT * FROM batches ORDER BY created_at DESC');
    }
    async registerMaterial(batchId, materialData, processedBy) {
        const batch = await this.getBatch(batchId);
        if (!batch) {
            throw new Error('批次不存在');
        }
        const materialId = (0, uuid_1.v4)();
        const originalData = JSON.stringify(materialData);
        await this.db.run(`INSERT INTO materials (id, batch_id, document_number, case_number, document_type, 
                              borrower, borrow_date, return_date, original_data, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
            materialId,
            batchId,
            materialData.document_number || null,
            materialData.case_number || null,
            materialData.document_type || null,
            materialData.borrower || null,
            materialData.borrow_date || null,
            materialData.return_date || null,
            originalData,
            'pending'
        ]);
        await this.db.run('UPDATE batches SET total_materials = total_materials + 1 WHERE id = ?', [batchId]);
        return this.processMaterial(materialId, processedBy);
    }
    async processMaterial(materialId, processedBy) {
        const material = await this.db.get('SELECT * FROM materials WHERE id = ?', [materialId]);
        if (!material) {
            throw new Error('材料不存在');
        }
        const classification = (0, classifier_1.classifyMaterial)(material);
        await this.db.run(`UPDATE materials 
       SET status = ?, status_reason = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`, [classification.status, classification.reason, materialId]);
        await this.db.run(`INSERT INTO processing_trails (id, material_id, previous_status, new_status, 
                                      status_reason, processed_by, note)
       VALUES (?, ?, ?, ?, ?, ?, ?)`, [
            (0, uuid_1.v4)(),
            materialId,
            material.status,
            classification.status,
            classification.reason,
            processedBy,
            classification.followUpAction
        ]);
        return {
            material: await this.db.get('SELECT * FROM materials WHERE id = ?', [materialId]),
            classification
        };
    }
    async recalculateBatch(batchId, processedBy) {
        const materials = await this.db.all('SELECT id FROM materials WHERE batch_id = ?', [batchId]);
        const results = [];
        for (const material of materials) {
            const result = await this.processMaterial(material.id, processedBy);
            results.push(result);
        }
        return {
            batchId,
            processedCount: materials.length,
            results
        };
    }
    async getMaterial(materialId) {
        return this.db.get('SELECT * FROM materials WHERE id = ?', [materialId]);
    }
    async getMaterialsByBatch(batchId) {
        return this.db.all('SELECT * FROM materials WHERE batch_id = ? ORDER BY created_at DESC', [batchId]);
    }
    async getProcessingTrails(materialId) {
        return this.db.all(`SELECT * FROM processing_trails 
       WHERE material_id = ? 
       ORDER BY processed_at DESC`, [materialId]);
    }
    async updateMaterialStatus(materialId, newStatus, statusReason, modifiedBy, changeReason) {
        const material = await this.db.get('SELECT * FROM materials WHERE id = ?', [materialId]);
        if (!material) {
            throw new Error('材料不存在');
        }
        const oldStatus = material.status;
        await this.db.run(`INSERT INTO audit_logs (id, material_id, field_name, old_value, new_value, 
                               modified_by, change_reason)
       VALUES (?, ?, ?, ?, ?, ?, ?)`, [
            (0, uuid_1.v4)(),
            materialId,
            'status',
            oldStatus,
            newStatus,
            modifiedBy,
            changeReason
        ]);
        await this.db.run(`UPDATE materials 
       SET status = ?, status_reason = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`, [newStatus, statusReason, materialId]);
        await this.db.run(`INSERT INTO processing_trails (id, material_id, previous_status, new_status, 
                                      status_reason, processed_by, note)
       VALUES (?, ?, ?, ?, ?, ?, ?)`, [
            (0, uuid_1.v4)(),
            materialId,
            oldStatus,
            newStatus,
            statusReason,
            modifiedBy,
            `人工修改状态: ${changeReason}`
        ]);
        return this.db.get('SELECT * FROM materials WHERE id = ?', [materialId]);
    }
    async getAuditLogs(materialId) {
        return this.db.all(`SELECT * FROM audit_logs 
       WHERE material_id = ? 
       ORDER BY modified_at DESC`, [materialId]);
    }
    async getMaterialTrail(materialId) {
        const material = await this.getMaterial(materialId);
        if (!material) {
            throw new Error('材料不存在');
        }
        const processingTrails = await this.getProcessingTrails(materialId);
        const auditLogs = await this.getAuditLogs(materialId);
        let originalData = null;
        try {
            originalData = JSON.parse(material.original_data);
        }
        catch (e) {
            originalData = material.original_data;
        }
        return {
            material,
            originalData,
            processingTrails,
            auditLogs,
            fieldTrace: {
                document_number: {
                    original: originalData?.document_number,
                    current: material.document_number
                },
                case_number: {
                    original: originalData?.case_number,
                    current: material.case_number
                },
                borrower: {
                    original: originalData?.borrower,
                    current: material.borrower
                },
                borrow_date: {
                    original: originalData?.borrow_date,
                    current: material.borrow_date
                },
                return_date: {
                    original: originalData?.return_date,
                    current: material.return_date
                },
                status: {
                    original: 'pending',
                    current: material.status
                }
            }
        };
    }
    async getStatistics() {
        const stats = await this.db.get(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'normal' THEN 1 ELSE 0 END) as normal,
        SUM(CASE WHEN status = 'needs_supplement' THEN 1 ELSE 0 END) as needs_supplement,
        SUM(CASE WHEN status = 'blocked' THEN 1 ELSE 0 END) as blocked,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending
      FROM materials
    `);
        const batchStats = await this.db.get(`
      SELECT COUNT(*) as total_batches
      FROM batches
    `);
        return {
            materials: stats,
            batches: batchStats
        };
    }
}
exports.DocumentService = DocumentService;
