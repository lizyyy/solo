const { ReturnVisitSurvey, LowScoreReason, Department } = require('../models');
const LogService = require('./logService');

class SurveyService {
  static LOW_SCORE_THRESHOLD = 6;

  static async createSurvey(data, operator) {
    const isLowScore = data.score <= this.LOW_SCORE_THRESHOLD;
    
    const survey = await ReturnVisitSurvey.create({
      ...data,
      isLowScore,
      status: isLowScore ? 'pending' : 'completed'
    });

    await LogService.createLog(
      'survey',
      survey.id,
      'create',
      operator,
      null,
      survey.toJSON(),
      '创建回访问卷'
    );

    if (isLowScore) {
      await this.validateLowScore(survey.id, operator);
    }

    return survey;
  }

  static async validateLowScore(surveyId, operator) {
    const survey = await ReturnVisitSurvey.findByPk(surveyId);
    if (!survey) {
      throw new Error('问卷不存在');
    }

    const errors = [];

    if (!survey.lowScoreReasonId) {
      errors.push('未选择低分原因');
    } else {
      const reason = await LowScoreReason.findByPk(survey.lowScoreReasonId);
      if (!reason || !reason.enabled) {
        errors.push('低分原因无效或已禁用');
      }
    }

    if (!survey.departmentId) {
      errors.push('未指定责任部门');
    } else {
      const dept = await Department.findByPk(survey.departmentId);
      if (!dept || !dept.enabled) {
        errors.push('责任部门无效或已禁用');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  static async updateSurvey(id, data, operator) {
    const survey = await ReturnVisitSurvey.findByPk(id);
    if (!survey) {
      throw new Error('问卷不存在');
    }

    const beforeValue = survey.toJSON();
    const changedFields = [];

    for (const key of Object.keys(data)) {
      if (survey[key] !== data[key]) {
        changedFields.push(key);
      }
    }

    await survey.update(data);

    if (data.score !== undefined) {
      const isLowScore = data.score <= this.LOW_SCORE_THRESHOLD;
      await survey.update({ isLowScore });
    }

    await LogService.createLog(
      'survey',
      id,
      'update',
      operator,
      beforeValue,
      survey.toJSON(),
      '更新回访问卷',
      changedFields
    );

    return survey;
  }

  static async getSurveyDetail(id) {
    return await ReturnVisitSurvey.findByPk(id, {
      include: [
        { association: 'lowScoreReason' },
        { association: 'department' },
        { association: 'tasks' },
        { association: 'revisitResults' }
      ]
    });
  }

  static async getSurveyList(params = {}) {
    const { page = 1, pageSize = 20, status, isLowScore, startDate, endDate } = params;
    const where = {};

    if (status) where.status = status;
    if (isLowScore !== undefined) where.isLowScore = isLowScore;
    if (startDate && endDate) {
      where.surveyTime = { [require('sequelize').Op.between]: [startDate, endDate] };
    }

    const { count, rows } = await ReturnVisitSurvey.findAndCountAll({
      where,
      include: ['lowScoreReason', 'department'],
      order: [['createdAt', 'DESC']],
      limit: pageSize,
      offset: (page - 1) * pageSize
    });

    return {
      list: rows,
      total: count,
      page,
      pageSize
    };
  }
}

module.exports = SurveyService;
