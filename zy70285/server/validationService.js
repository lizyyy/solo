const db = require('./database');
const { v4: uuidv4 } = require('uuid');

function addStatusHistory(entityType, entityId, fromStatus, toStatus, operator, reason) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO status_history (entity_type, entity_id, from_status, to_status, operator, reason, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [entityType, entityId, fromStatus, toStatus, operator, reason, new Date().toISOString()],
      function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      }
    );
  });
}

function addValidation(entityType, entityId, validationType, result, details, errors) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO validations (id, entity_type, entity_id, validation_type, result, details, errors, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [uuidv4(), entityType, entityId, validationType, result, 
       details ? JSON.stringify(details) : null, 
       errors ? JSON.stringify(errors) : null, 
       new Date().toISOString()],
      function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      }
    );
  });
}

function validateStoreProfile(storeId) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM stores WHERE id = ?`, [storeId], async (err, store) => {
      if (err) {
        reject(err);
        return;
      }
      
      if (!store) {
        const result = {
          passed: false,
          score: 0,
          errors: ['门店不存在'],
          details: { storeId },
          suggestions: ['请检查门店ID是否正确', '确认门店档案是否已创建']
        };
        await addValidation('store', storeId, 'profile_validation', 'failed', result, result.errors);
        resolve(result);
        return;
      }

      const errors = [];
      const warnings = [];
      let score = 100;

      if (store.status !== 'active') {
        errors.push(`门店状态为"${store.status}"，不是激活状态`);
        score -= 40;
      }

      if (!store.authorized) {
        errors.push('门店未获得巡店授权');
        score -= 30;
      }

      if (!store.name || store.name.trim() === '') {
        errors.push('门店名称为空');
        score -= 15;
      }

      if (!store.code || store.code.trim() === '') {
        errors.push('门店编码为空');
        score -= 15;
      }

      if (!store.address || store.address.trim() === '') {
        warnings.push('门店地址未填写');
        score -= 5;
      }

      if (!store.manager || store.manager.trim() === '') {
        warnings.push('门店负责人未指定');
        score -= 5;
      }

      const suggestions = [];
      if (store.status !== 'active') {
        suggestions.push('请在门店管理中将门店状态调整为"active"');
      }
      if (!store.authorized) {
        suggestions.push('请在门店管理中开启巡店授权');
      }
      if (warnings.length > 0) {
        suggestions.push('建议补充完整的门店信息');
      }

      const result = {
        passed: errors.length === 0,
        score: Math.max(0, score),
        store: {
          id: store.id,
          name: store.name,
          status: store.status,
          authorized: store.authorized
        },
        errors,
        warnings,
        suggestions,
        currentBlock: errors.length > 0 ? '门店档案验证失败' : null
      };

      await addValidation('store', storeId, 'profile_validation', 
        result.passed ? 'passed' : 'failed', result, errors);
      
      resolve(result);
    });
  });
}

function validateInspectionReliability(inspectionId) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM inspections WHERE id = ?`, [inspectionId], async (err, inspection) => {
      if (err) {
        reject(err);
        return;
      }
      
      if (!inspection) {
        const result = {
          passed: false,
          score: 0,
          errors: ['巡店记录不存在'],
          suggestions: ['请检查巡店记录ID是否正确']
        };
        await addValidation('inspection', inspectionId, 'reliability_validation', 'failed', result, result.errors);
        resolve(result);
        return;
      }

      const errors = [];
      const warnings = [];
      let score = 100;

      const photos = inspection.photos ? JSON.parse(inspection.photos) : [];
      const problems = inspection.problems ? JSON.parse(inspection.problems) : [];

      if (!inspection.inspector || inspection.inspector.trim() === '') {
        errors.push('未指定巡店人');
        score -= 20;
      }

      if (!inspection.inspection_date) {
        errors.push('未填写巡店日期');
        score -= 20;
      }

      if (photos.length === 0) {
        errors.push('巡店记录没有任何现场照片');
        score -= 30;
      }

      if (problems.length === 0) {
        warnings.push('巡店记录未发现任何问题（可能遗漏问题或需要确认）');
        score -= 10;
      }

      const minPhotosPerProblem = 1;
      let missingPhotos = 0;
      problems.forEach(p => {
        if (!p.photos || p.photos.length < minPhotosPerProblem) {
          missingPhotos++;
        }
      });

      if (missingPhotos > 0) {
        errors.push(`有 ${missingPhotos} 个问题缺少佐证照片`);
        score -= 20;
      }

      if (problems.some(p => !p.description || p.description.length < 5)) {
        warnings.push('部分问题描述过于简略（少于5个字）');
        score -= 5;
      }

      const suggestions = [];
      if (photos.length === 0) {
        suggestions.push('请补充巡店现场照片，每个问题至少1张佐证照片');
      }
      if (missingPhotos > 0) {
        suggestions.push('请为缺少照片的问题补充佐证图片');
      }
      if (!inspection.inspector) {
        suggestions.push('请填写巡店人信息');
      }

      const result = {
        passed: errors.length === 0,
        score: Math.max(0, score),
        inspection: {
          id: inspection.id,
          inspector: inspection.inspector,
          photoCount: photos.length,
          problemCount: problems.length
        },
        errors,
        warnings,
        suggestions,
        currentBlock: errors.length > 0 ? '巡店数据可靠性验证失败' : null
      };

      await addValidation('inspection', inspectionId, 'reliability_validation',
        result.passed ? 'passed' : 'failed', result, errors);

      resolve(result);
    });
  });
}

function validateRectificationConsistency(problemId) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM problems WHERE id = ?`, [problemId], (err, problem) => {
      if (err) {
        reject(err);
        return;
      }
      
      if (!problem) {
        const result = {
          passed: false,
          score: 0,
          errors: ['问题记录不存在'],
          suggestions: ['请检查问题ID是否正确']
        };
        addValidation('problem', problemId, 'consistency_validation', 'failed', result, result.errors).then(() => resolve(result));
        return;
      }

      db.all(`SELECT * FROM rectifications WHERE problem_id = ? ORDER BY created_at DESC`, [problemId], (err, rectifications) => {
        if (err) {
          reject(err);
          return;
        }

        db.all(`SELECT * FROM reviews WHERE problem_id = ? ORDER BY created_at DESC`, [problemId], async (err, reviews) => {
          if (err) {
            reject(err);
            return;
          }

          const errors = [];
          const warnings = [];
          let score = 100;
          const originalPhotos = problem.photos ? JSON.parse(problem.photos) : [];

          if (rectifications.length === 0) {
            errors.push('问题尚未提交整改记录');
            score -= 40;
          } else {
            const latestRect = rectifications[0];
            const rectPhotos = latestRect.photos ? JSON.parse(latestRect.photos) : [];

            if (rectPhotos.length === 0) {
              errors.push('整改记录缺少整改后照片');
              score -= 30;
            }

            if (originalPhotos.length > rectPhotos.length) {
              warnings.push(`整改照片数量(${rectPhotos.length})少于原始问题照片(${originalPhotos.length})`);
              score -= 10;
            }

            if (!latestRect.description || latestRect.description.length < 10) {
              warnings.push('整改描述过于简略（少于10个字）');
              score -= 5;
            }

            if (!latestRect.rectifier) {
              warnings.push('整改人未填写');
              score -= 5;
            }
          }

          if (reviews.length === 0) {
            warnings.push('问题尚未提交复查意见');
            score -= 10;
          } else {
            const latestReview = reviews[0];
            if (!latestReview.comments || latestReview.comments.length < 5) {
              warnings.push('复查意见过于简略（少于5个字）');
              score -= 5;
            }
            if (!latestReview.reviewer) {
              warnings.push('复查人未填写');
              score -= 5;
            }
          }

          const suggestions = [];
          if (rectifications.length === 0) {
            suggestions.push('请先提交整改记录');
          } else if (rectifications[0].photos && JSON.parse(rectifications[0].photos).length === 0) {
            suggestions.push('请补充整改后的对比照片');
          }
          if (reviews.length === 0) {
            suggestions.push('整改完成后请提交复查意见');
          }

          const result = {
            passed: errors.length === 0,
            score: Math.max(0, score),
            problem: {
              id: problem.id,
              description: problem.description,
              originalPhotoCount: originalPhotos.length
            },
            rectification: rectifications.length > 0 ? {
              hasPhotos: rectifications[0].photos && JSON.parse(rectifications[0].photos).length > 0,
              rectifier: rectifications[0].rectifier
            } : null,
            review: reviews.length > 0 ? {
              hasComments: reviews[0].comments && reviews[0].comments.length > 0,
              passed: reviews[0].passed
            } : null,
            errors,
            warnings,
            suggestions,
            currentBlock: errors.length > 0 ? '整改数据一致性验证失败' : null
          };

          await addValidation('problem', problemId, 'consistency_validation',
            result.passed ? 'passed' : 'failed', result, errors);

          resolve(result);
        });
      });
    });
  });
}

function getStatusHistory(entityType, entityId) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM status_history 
       WHERE entity_type = ? AND entity_id = ? 
       ORDER BY created_at DESC`,
      [entityType, entityId],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      }
    );
  });
}

function getValidationHistory(entityType, entityId) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM validations 
       WHERE entity_type = ? AND entity_id = ? 
       ORDER BY created_at DESC`,
      [entityType, entityId],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows.map(r => ({
          ...r,
          details: r.details ? JSON.parse(r.details) : null,
          errors: r.errors ? JSON.parse(r.errors) : null
        })));
      }
    );
  });
}

module.exports = {
  validateStoreProfile,
  validateInspectionReliability,
  validateRectificationConsistency,
  addStatusHistory,
  getStatusHistory,
  getValidationHistory
};
