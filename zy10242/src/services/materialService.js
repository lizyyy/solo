const db = require('../models/database');
const { v4: uuidv4 } = require('uuid');
const claimService = require('./claimService');
const path = require('path');
const fs = require('fs');

class MaterialService {
  async addMaterial(claimId, data, operator) {
    return new Promise((resolve, reject) => {
      db.serialize(async () => {
        try {
          const claim = await claimService.getClaimById(claimId);
          if (!claim) throw new Error('案件不存在');
          
          if (claim.status === 'completed') {
            throw new Error('案件已完成，无法添加新材料');
          }

          const now = new Date().toISOString();
          const materialId = uuidv4();
          
          db.get(`
            SELECT MAX(version) as max_version FROM materials 
            WHERE claim_id = ? AND material_code = ?
          `, [claimId, data.material_code], (err, row) => {
            if (err) return reject(err);
            
            const version = (row?.max_version || 0) + 1;
            
            db.run(`
              INSERT INTO materials (
                material_id, claim_id, material_code, material_name, description,
                is_required, status, version, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
              materialId, claimId, data.material_code, data.material_name,
              data.description || '', data.is_required ? 1 : 0, 'pending',
              version, now, now
            ], async (err) => {
              if (err) return reject(err);
              
              await claimService.addAuditLog(
                claimId, materialId, '添加材料', 'material_add',
                operator, `添加材料: ${data.material_name}`
              );
              
              const material = await this.getMaterialById(materialId);
              resolve(material);
            });
          });
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  async getMaterialById(materialId) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM materials WHERE material_id = ?', [materialId], (err, row) => {
        if (err) return reject(err);
        resolve(row);
      });
    });
  }

  async getMaterialsByClaimId(claimId) {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM materials WHERE claim_id = ? ORDER BY material_code, version', [claimId], (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  }

  async getLatestMaterials(claimId) {
    return new Promise((resolve, reject) => {
      db.all(`
        SELECT m.* FROM materials m
        INNER JOIN (
          SELECT claim_id, material_code, MAX(version) as max_version
          FROM materials WHERE claim_id = ?
          GROUP BY claim_id, material_code
        ) latest ON m.claim_id = latest.claim_id 
          AND m.material_code = latest.material_code 
          AND m.version = latest.max_version
        WHERE m.claim_id = ?
        ORDER BY m.material_code
      `, [claimId, claimId], (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  }

  async uploadMaterial(materialId, file, operator) {
    return new Promise((resolve, reject) => {
      db.serialize(async () => {
        try {
          const material = await this.getMaterialById(materialId);
          if (!material) throw new Error('材料不存在');
          
          const claim = await claimService.getClaimById(material.claim_id);
          if (!claim) throw new Error('案件不存在');
          
          if (claim.status === 'completed') {
            throw new Error('案件已完成，无法上传材料');
          }

          if (material.status === 'approved') {
            throw new Error('该材料已审核通过，如需修改请先驳回');
          }

          const now = new Date().toISOString();
          
          db.run(`
            UPDATE materials 
            SET file_path = ?, file_name = ?, file_size = ?, 
                uploaded_at = ?, uploaded_by = ?, status = ?, updated_at = ?
            WHERE material_id = ?
          `, [
            file.path, file.originalname, file.size,
            now, operator, 'submitted', now, materialId
          ], async (err) => {
            if (err) return reject(err);
            
            await claimService.addAuditLog(
              material.claim_id, materialId, '上传材料', 'material_upload',
              operator, `上传材料: ${material.material_name}, 文件名: ${file.originalname}`
            );
            
            const updatedMaterial = await this.getMaterialById(materialId);
            resolve(updatedMaterial);
          });
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  async reuploadMaterial(materialId, file, operator, reason) {
    return new Promise((resolve, reject) => {
      db.serialize(async () => {
        try {
          const oldMaterial = await this.getMaterialById(materialId);
          if (!oldMaterial) throw new Error('材料不存在');
          
          const claim = await claimService.getClaimById(oldMaterial.claim_id);
          if (!claim) throw new Error('案件不存在');
          
          if (claim.status === 'completed') {
            throw new Error('案件已完成，无法重新上传材料');
          }

          const now = new Date().toISOString();
          const newMaterialId = uuidv4();
          const newVersion = oldMaterial.version + 1;

          db.run(`
            INSERT INTO materials (
              material_id, claim_id, material_code, material_name, description,
              is_required, status, version, file_path, file_name, file_size,
              uploaded_at, uploaded_by, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            newMaterialId, oldMaterial.claim_id, oldMaterial.material_code,
            oldMaterial.material_name, oldMaterial.description, oldMaterial.is_required,
            'submitted', newVersion, file.path, file.originalname, file.size,
            now, operator, now, now
          ], async (err) => {
            if (err) return reject(err);
            
            await claimService.addAuditLog(
              oldMaterial.claim_id, newMaterialId, '重新上传材料', 'material_reupload',
              operator, `重新上传材料: ${oldMaterial.material_name}, 原因: ${reason}, 版本: v${newVersion}`,
              oldMaterial.status, 'submitted'
            );
            
            const newMaterial = await this.getMaterialById(newMaterialId);
            resolve(newMaterial);
          });
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  async auditMaterial(materialId, status, operator, remark = '') {
    return new Promise((resolve, reject) => {
      if (!['approved', 'rejected'].includes(status)) {
        return reject(new Error('审核状态只能是 approved 或 rejected'));
      }

      db.serialize(async () => {
        try {
          const material = await this.getMaterialById(materialId);
          if (!material) throw new Error('材料不存在');
          
          if (!material.file_path) {
            throw new Error('材料未上传，无法审核');
          }

          const now = new Date().toISOString();
          const oldStatus = material.status;

          db.run(`
            UPDATE materials SET status = ?, updated_at = ? WHERE material_id = ?
          `, [status, now, materialId], async (err) => {
            if (err) return reject(err);
            
            await claimService.addAuditLog(
              material.claim_id, materialId, 
              status === 'approved' ? '审核通过' : '审核驳回',
              'material_audit', operator, remark, oldStatus, status
            );
            
            await this.checkClaimCompletion(material.claim_id, operator);
            
            const updatedMaterial = await this.getMaterialById(materialId);
            resolve(updatedMaterial);
          });
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  async checkClaimCompletion(claimId, operator) {
    const materials = await this.getLatestMaterials(claimId);
    const requiredMaterials = materials.filter(m => m.is_required);
    const allApproved = requiredMaterials.every(m => m.status === 'approved');
    
    if (allApproved && requiredMaterials.length > 0) {
      await claimService.updateClaimStatus(claimId, 'completed', operator, '所有必填材料已审核通过');
    }
  }

  async deleteMaterial(materialId, operator, reason) {
    return new Promise((resolve, reject) => {
      db.serialize(async () => {
        try {
          const material = await this.getMaterialById(materialId);
          if (!material) {
            const err = new Error('材料不存在');
            err.statusCode = 404;
            throw err;
          }
          
          const claim = await claimService.getClaimById(material.claim_id);
          if (!claim) {
            const err = new Error('案件不存在');
            err.statusCode = 404;
            throw err;
          }
          
          if (claim.status === 'completed') {
            const err = new Error('案件已完成，无法删除材料');
            err.statusCode = 400;
            throw err;
          }

          if (material.is_required) {
            const err = new Error('必填材料不能删除，如需删除请先取消必填属性');
            err.statusCode = 400;
            throw err;
          }

          if (material.file_path && fs.existsSync(material.file_path)) {
            fs.unlinkSync(material.file_path);
          }

          db.run('DELETE FROM materials WHERE material_id = ?', [materialId], async (err) => {
            if (err) return reject(err);
            
            await claimService.addAuditLog(
              material.claim_id, materialId, '删除材料', 'material_delete',
              operator, `删除材料: ${material.material_name}, 原因: ${reason}`
            );
            
            resolve(true);
          });
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  async getMissingMaterials(claimId) {
    const materials = await this.getLatestMaterials(claimId);
    return materials.filter(m => m.is_required && m.status !== 'approved');
  }

  async getMaterialHistory(claimId, materialCode) {
    return new Promise((resolve, reject) => {
      db.all(`
        SELECT * FROM materials 
        WHERE claim_id = ? AND material_code = ? 
        ORDER BY version DESC
      `, [claimId, materialCode], (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  }
}

module.exports = new MaterialService();
