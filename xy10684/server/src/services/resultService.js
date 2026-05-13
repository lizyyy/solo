const { RevisitResult, ReturnVisitSurvey, RemedyTask } = require('../models');
const LogService = require('./logService');

class ResultService {
  static async createResult(data, operator) {
    const { surveyId, taskId, revisitResult, newScore, customerFeedback, modifyReason } = data;

    const survey = await ReturnVisitSurvey.findByPk(surveyId);
    if (!survey) {
      throw new Error('问卷不存在');
    }

    const affectedRecords = await this.findAffectedRecords(surveyId, operator);

    const result = await RevisitResult.create({
      surveyId,
      taskId,
      revisitTime: new Date(),
      revisitResult,
      newScore,
      customerFeedback,
      handledBy: operator,
      modifyReason,
      affectedRecords: JSON.stringify(affectedRecords)
    });

    if (newScore !== undefined) {
      const beforeValue = survey.toJSON();
      await survey.update({ score: newScore });
      
      await LogService.createLog(
        'survey',
        surveyId,
        'update',
        operator,
        beforeValue,
        survey.toJSON(),
        `复访结果更新评分: ${newScore}`,
        ['score']
      );
    }

    await LogService.createLog(
      'result',
      result.id,
      'create',
      operator,
      null,
      result.toJSON(),
      '创建复访结果'
    );

    return result;
  }

  static async findAffectedRecords(surveyId, operator) {
    const survey = await ReturnVisitSurvey.findByPk(surveyId);
    if (!survey) return [];

    const affected = [];

    const tasks = await RemedyTask.findAll({
      where: { surveyId, status: { [require('sequelize').Op.ne]: 'blocked' } }
    });

    tasks.forEach(task => {
      affected.push({
        type: 'task',
        id: task.id,
        taskNo: task.taskNo,
        status: task.status,
        assignee: task.assignee
      });
    });

    const prevResults = await RevisitResult.findAll({
      where: { surveyId }
    });

    prevResults.forEach(r => {
      affected.push({
        type: 'result',
        id: r.id,
        result: r.revisitResult,
        handledBy: r.handledBy
      });
    });

    return affected;
  }

  static async getResultList(params = {}) {
    const { page = 1, pageSize = 20, handledBy, startDate, endDate } = params;
    const where = {};

    if (handledBy) where.handledBy = handledBy;
    if (startDate && endDate) {
      where.revisitTime = { [require('sequelize').Op.between]: [startDate, endDate] };
    }

    const { count, rows } = await RevisitResult.findAndCountAll({
      where,
      include: [{ association: 'survey', include: ['lowScoreReason', 'department'] }, 'task'],
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

  static async getResultDetail(id) {
    const result = await RevisitResult.findByPk(id, {
      include: [{ association: 'survey', include: ['lowScoreReason', 'department'] }, 'task']
    });

    if (!result) return null;

    return {
      ...result.toJSON(),
      affectedRecords: result.affectedRecords ? JSON.parse(result.affectedRecords) : []
    };
  }
}

module.exports = ResultService;
