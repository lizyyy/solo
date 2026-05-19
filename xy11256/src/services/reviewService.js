const hazardModel = require('../models/hazard');
const photoModel = require('../models/photo');
const { validateHazard } = require('../utils/validator');
const { HAZARD_STATUS, HAZARD_STATUS_LABELS } = require('../utils/constants');

class ReviewService {
  async reviewHazardData(hazardCode) {
    const hazard = await hazardModel.findByCode(hazardCode);
    if (!hazard) {
      throw new Error(`隐患不存在: ${hazardCode}`);
    }

    const issues = [];
    const photos = await photoModel.findByHazardCode(hazardCode);

    if (!hazard.responsible_person && hazard.status !== HAZARD_STATUS.CLOSED) {
      issues.push({
        type: 'warning',
        field: 'responsible_person',
        message: '未分配整改责任人'
      });
    }

    if (!hazard.deadline && hazard.status !== HAZARD_STATUS.CLOSED) {
      issues.push({
        type: 'warning',
        field: 'deadline',
        message: '未设置整改期限'
      });
    }

    if (hazard.deadline && hazard.status !== HAZARD_STATUS.CLOSED) {
      const deadline = new Date(hazard.deadline);
      const today = new Date();
      if (deadline < today) {
        issues.push({
          type: 'error',
          field: 'deadline',
          message: `整改已超期 ${Math.ceil((today - deadline) / (1000 * 60 * 60 * 24))} 天`
        });
      }
    }

    const inspectionPhotos = photos.filter(p => p.photo_type === 'inspection');
    if (inspectionPhotos.length === 0) {
      issues.push({
        type: 'warning',
        field: 'photos',
        message: '缺少巡检照片'
      });
    }

    if ([HAZARD_STATUS.REVIEWING, HAZARD_STATUS.CLOSED].includes(hazard.status)) {
      const rectificationPhotos = photos.filter(p => p.photo_type === 'rectification');
      if (rectificationPhotos.length === 0) {
        issues.push({
          type: 'warning',
          field: 'photos',
          message: '缺少整改后照片'
        });
      }

      const reviewPhotos = photos.filter(p => p.photo_type === 'review');
      if (reviewPhotos.length === 0 && hazard.status === HAZARD_STATUS.CLOSED) {
        issues.push({
          type: 'info',
          field: 'photos',
          message: '缺少复查照片'
        });
      }
    }

    if (hazard.status === HAZARD_STATUS.CLOSED && !hazard.review_result) {
      issues.push({
        type: 'error',
        field: 'review_result',
        message: '已闭环隐患缺少复查结果'
      });
    }

    const dataCopy = {
      hazardCode: hazard.hazard_code,
      title: hazard.title,
      description: hazard.description,
      location: hazard.location,
      level: hazard.level,
      discoverDate: new Date(hazard.discover_date),
      discoverer: hazard.discoverer
    };

    const validation = validateHazard(dataCopy);
    if (!validation.isValid) {
      validation.errors.forEach(err => {
        issues.push({
          type: 'error',
          field: err.field,
          message: err.message
        });
      });
    }

    const issueCount = {
      error: issues.filter(i => i.type === 'error').length,
      warning: issues.filter(i => i.type === 'warning').length,
      info: issues.filter(i => i.type === 'info').length
    };

    return {
      hazardCode,
      hazard,
      photos,
      issues,
      issueCount,
      canClose: issueCount.error === 0
    };
  }

  async reviewAllHazards() {
    const hazards = await hazardModel.findAll();
    const results = [];

    for (const hazard of hazards) {
      try {
        const reviewResult = await this.reviewHazardData(hazard.hazard_code);
        results.push(reviewResult);
      } catch (err) {
        results.push({
          hazardCode: hazard.hazard_code,
          error: err.message,
          issues: [{ type: 'error', message: '复核失败' }]
        });
      }
    }

    const stats = {
      total: results.length,
      withErrors: results.filter(r => r.issueCount?.error > 0).length,
      withWarnings: results.filter(r => r.issueCount?.warning > 0).length,
      canClose: results.filter(r => r.canClose).length
    };

    return { results, stats };
  }

  async getHazardDetails(hazardCode) {
    const hazard = await hazardModel.findByCode(hazardCode);
    if (!hazard) {
      throw new Error(`隐患不存在: ${hazardCode}`);
    }

    const photos = await photoModel.findByHazardCode(hazardCode);
    const history = await hazardModel.getStatusHistory(hazardCode);

    return {
      hazard,
      photos,
      history,
      statusLabel: HAZARD_STATUS_LABELS[hazard.status]
    };
  }

  async fixHazard(hazardCode, updates, operator) {
    const hazard = await hazardModel.findByCode(hazardCode);
    if (!hazard) {
      throw new Error(`隐患不存在: ${hazardCode}`);
    }

    const validFields = ['title', 'description', 'location', 'level', 'responsible_person', 'deadline'];
    const updateFields = [];
    const updateValues = [];

    for (const field of validFields) {
      if (updates[field] !== undefined) {
        updateFields.push(`${field} = ?`);
        updateValues.push(updates[field]);
      }
    }

    if (updateFields.length === 0) {
      return { success: false, message: '没有有效更新字段' };
    }

    updateValues.push(hazardCode);

    await hazardModel.run(`
      UPDATE hazards 
      SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE hazard_code = ?
    `, updateValues);

    return { success: true, hazardCode, updatedFields: validFields.filter(f => updates[f] !== undefined) };
  }
}

module.exports = new ReviewService();
