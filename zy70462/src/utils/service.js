const {
  BatchRepository,
  MaterialRepository,
  ValidationResultRepository,
  CandidateListRepository
} = require('../database/db');
const { calculateContentHash, generateContentSummary } = require('./hash');
const { validateMaterial, requiresManualConfirm } = require('./validator');
const { ensureDatabase } = require('./database');

async function withDatabase(fn) {
  await ensureDatabase();
  return fn();
}

class ValidationService {
  static async createBatch(batchName, operator, riskType = null, notes = null) {
    return withDatabase(() => 
      BatchRepository.create(batchName, operator, riskType, notes)
    );
  }

  static async submitBatch(batchId, materials, operator) {
    return withDatabase(async () => {
      const results = [];
      const duplicates = [];
      const conflicts = [];

      for (const material of materials) {
        const fileHash = calculateContentHash(material.content || JSON.stringify(material));
        const existingMaterial = await MaterialRepository.getByHash(fileHash);

        if (existingMaterial) {
          const existingResults = await ValidationResultRepository.getByMaterialId(existingMaterial.id);
          
          if (existingResults.length > 0) {
            const latestResult = existingResults[existingResults.length - 1];
            
            if (latestResult.status === 'success') {
              duplicates.push({
                material,
                existingMaterial,
                existingResult: latestResult,
                action: 'reuse',
                message: '内容相同，复用旧验证结论（成功）'
              });
              continue;
            } else {
              conflicts.push({
                material,
                existingMaterial,
                existingResult: latestResult,
                message: '内容相同但旧结论为失败，请人工确认'
              });
            }
          }
        }

        const fileSummary = generateContentSummary(material.fileName, material.content || '');
        const materialId = await MaterialRepository.create(
          batchId,
          material.fileName,
          fileHash,
          fileSummary,
          material.materialType || 'general',
          material.downloadUrl
        );

        const validationResult = validateMaterial(material);
        const needManualConfirm = requiresManualConfirm(material.materialType, material.fileName);

        await ValidationResultRepository.create(
          materialId,
          batchId,
          validationResult.status,
          validationResult.riskLevel,
          validationResult.failureReason,
          validationResult.findings,
          operator,
          needManualConfirm
        );

        results.push({
          materialId,
          fileName: material.fileName,
          ...validationResult,
          requiresManualConfirm: needManualConfirm
        });
      }

      await BatchRepository.updateStatus(batchId, 'completed');

      return {
        validated: results,
        reused: duplicates,
        conflicts: conflicts
      };
    });
  }

  static async generateCandidateList(batchId, actionType, createdBy) {
    return withDatabase(async () => {
      const validationResults = await ValidationResultRepository.getByBatchId(batchId);
      const candidates = [];

      for (const result of validationResults) {
        if (actionType === 'cleanup' && result.status === 'failure') {
          candidates.push({
            resultId: result.id,
            fileName: result.file_name,
            fileSummary: result.file_summary,
            riskLevel: result.risk_level,
            failureReason: result.failure_reason
          });
        } else if (actionType === 'rollback' && result.status === 'success') {
          candidates.push({
            resultId: result.id,
            fileName: result.file_name,
            fileSummary: result.file_summary,
            riskLevel: result.risk_level
          });
        }
      }

      const candidateListId = await CandidateListRepository.create(
        batchId,
        actionType,
        candidates,
        createdBy
      );

      return {
        id: candidateListId,
        actionType,
        candidates,
        count: candidates.length
      };
    });
  }

  static async executeCandidateList(candidateListId) {
    return withDatabase(async () => {
      const candidateList = await CandidateListRepository.getById(candidateListId);
      
      if (!candidateList) {
        throw new Error('候选清单不存在');
      }
      
      if (candidateList.executed) {
        throw new Error('候选清单已执行');
      }

      await CandidateListRepository.markExecuted(candidateListId);

      return {
        success: true,
        executedAt: Date.now(),
        actionType: candidateList.action_type,
        count: candidateList.candidates.length
      };
    });
  }

  static async queryHistory(filters = {}) {
    return withDatabase(async () => {
      const batches = await BatchRepository.getAll(filters);
      const results = [];

      for (const batch of batches) {
        const materials = await MaterialRepository.getByBatchId(batch.id);
        const validationResults = await ValidationResultRepository.getByBatchId(batch.id);
        
        const successCount = validationResults.filter(r => r.status === 'success').length;
        const failureCount = validationResults.filter(r => r.status === 'failure').length;

        results.push({
          batch,
          materials: materials.length,
          results: {
            total: validationResults.length,
            success: successCount,
            failure: failureCount,
            details: validationResults
          }
        });
      }

      return results;
    });
  }

  static async queryByFileSummary(keyword) {
    return withDatabase(async () => {
      const materials = await MaterialRepository.getBySummary(keyword);
      const results = [];

      for (const material of materials) {
        const validationResults = await ValidationResultRepository.getByMaterialId(material.id);
        results.push({
          material,
          validationResults
        });
      }

      return results;
    });
  }

  static async getPendingManualConfirm() {
    return withDatabase(() => 
      ValidationResultRepository.getPendingManualConfirm()
    );
  }

  static async confirmManual(resultId, confirmedBy) {
    return withDatabase(async () => {
      await ValidationResultRepository.confirmManual(resultId, confirmedBy);
      return { success: true };
    });
  }

  static async getBatchDetail(batchId) {
    return withDatabase(async () => {
      const batch = await BatchRepository.getById(batchId);
      if (!batch) return null;

      const materials = await MaterialRepository.getByBatchId(batchId);
      const results = await ValidationResultRepository.getByBatchId(batchId);
      const candidateLists = await CandidateListRepository.getByBatchId(batchId);

      return {
        batch,
        materials,
        results,
        candidateLists
      };
    });
  }

  static async getCandidateList(candidateListId) {
    return withDatabase(() => 
      CandidateListRepository.getById(candidateListId)
    );
  }
}

module.exports = ValidationService;
