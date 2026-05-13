const { RemedyTask, ReturnVisitSurvey, LowScoreReason, sequelize } = require('../models');
const LogService = require('./logService');
const dayjs = require('dayjs');

class TaskService {
  static BLOCK_RULES = {
    SAME_CUSTOMER_30_DAYS: 'same_customer_30_days',
    SCORE_TOO_LOW: 'score_too_low',
    NEED_REVIEW: 'need_review',
    DUPLICATE_TASK: 'duplicate_task'
  };

  static async createTask(surveyId, operator) {
    const survey = await ReturnVisitSurvey.findByPk(surveyId);
    if (!survey) {
      throw new Error('问卷不存在');
    }

    const blockResult = await this.checkBlockRules(survey);
    if (blockResult.blocked) {
      const task = await RemedyTask.create({
        surveyId,
        taskNo: this.generateTaskNo(),
        status: 'blocked',
        blockedReason: blockResult.reason,
        blockedRule: blockResult.rule
      });

      await survey.update({ status: 'blocked' });

      await LogService.createLog(
        'task',
        task.id,
        'block',
        operator,
        null,
        task.toJSON(),
        `任务被规则拦截: ${blockResult.reason}`
      );

      return {
        task,
        blocked: true,
        reason: blockResult.reason,
        rule: blockResult.rule
      };
    }

    const duplicateCheck = await this.checkDuplicateTask(surveyId);
    if (duplicateCheck) {
      const task = await RemedyTask.create({
        surveyId,
        taskNo: this.generateTaskNo(),
        status: 'blocked',
        blockedReason: '该问卷已有未完成的补救任务',
        blockedRule: this.BLOCK_RULES.DUPLICATE_TASK
      });

      await LogService.createLog(
        'task',
        task.id,
        'block',
        operator,
        null,
        task.toJSON(),
        '重复提交任务被拦截'
      );

      return {
        task,
        blocked: true,
        reason: '该问卷已有未完成的补救任务',
        rule: this.BLOCK_RULES.DUPLICATE_TASK,
        isDuplicate: true
      };
    }

    const lowScoreReason = await LowScoreReason.findByPk(survey.lowScoreReasonId);
    const needReview = lowScoreReason?.needReview || false;

    const task = await RemedyTask.create({
      surveyId,
      taskNo: this.generateTaskNo(),
      assignee: operator,
      departmentId: survey.departmentId,
      priority: survey.score <= 3 ? 'urgent' : survey.score <= 5 ? 'high' : 'medium',
      status: needReview ? 'pending' : 'assigned',
      needReview,
      deadline: dayjs().add(3, 'day').toDate()
    });

    await survey.update({ 
      status: needReview ? 'reviewing' : 'processing' 
    });

    await LogService.createLog(
      'task',
      task.id,
      'create',
      operator,
      null,
      task.toJSON(),
      needReview ? '创建任务，待人工复核' : '创建任务并派单'
    );

    return {
      task,
      blocked: false,
      needReview
    };
  }

  static async checkBlockRules(survey) {
    if (survey.score <= 2) {
      return {
        blocked: true,
        rule: this.BLOCK_RULES.SCORE_TOO_LOW,
        reason: '评分过低(≤2分)，需主管特殊处理'
      };
    }

    const thirtyDaysAgo = dayjs().subtract(30, 'day').toDate();
    const recentTasks = await RemedyTask.count({
      include: [{
        association: 'survey',
        where: { phone: survey.phone }
      }],
      where: {
        createdAt: { [require('sequelize').Op.gte]: thirtyDaysAgo },
        status: { [require('sequelize').Op.ne]: 'blocked' }
      }
    });

    if (recentTasks >= 2) {
      return {
        blocked: true,
        rule: this.BLOCK_RULES.SAME_CUSTOMER_30_DAYS,
        reason: '该客户30天内已有多次低分记录，需重点关注'
      };
    }

    return { blocked: false };
  }

  static async checkDuplicateTask(surveyId) {
    const count = await RemedyTask.count({
      where: {
        surveyId,
        status: { [require('sequelize').Op.in]: ['pending', 'assigned', 'processing'] }
      }
    });
    return count > 0;
  }

  static generateTaskNo() {
    return `RD${dayjs().format('YYYYMMDDHHmmss')}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
  }

  static async completeTask(taskId, remedyResult, operator) {
    const task = await RemedyTask.findByPk(taskId);
    if (!task) {
      throw new Error('任务不存在');
    }

    const beforeValue = task.toJSON();

    await task.update({
      status: 'completed',
      remedyResult,
      completedTime: new Date()
    });

    const survey = await ReturnVisitSurvey.findByPk(task.surveyId);
    if (survey) {
      await survey.update({ status: 'completed' });
    }

    await LogService.createLog(
      'task',
      taskId,
      'complete',
      operator,
      beforeValue,
      task.toJSON(),
      '完成补救任务'
    );

    return task;
  }

  static async reviewTask(taskId, reviewResult, reviewRemark, operator) {
    const task = await RemedyTask.findByPk(taskId);
    if (!task) {
      throw new Error('任务不存在');
    }

    const beforeValue = task.toJSON();

    if (reviewResult === 'pass') {
      await task.update({
        status: 'assigned',
        reviewedBy: operator,
        reviewTime: new Date(),
        reviewResult,
        reviewRemark,
        needReview: false
      });

      const survey = await ReturnVisitSurvey.findByPk(task.surveyId);
      if (survey) {
        await survey.update({ status: 'processing' });
      }
    } else {
      await task.update({
        status: 'cancelled',
        reviewedBy: operator,
        reviewTime: new Date(),
        reviewResult,
        reviewRemark
      });

      const survey = await ReturnVisitSurvey.findByPk(task.surveyId);
      if (survey) {
        await survey.update({ status: 'completed' });
      }
    }

    await LogService.createLog(
      'task',
      taskId,
      'review',
      operator,
      beforeValue,
      task.toJSON(),
      `复核${reviewResult === 'pass' ? '通过' : '驳回'}`
    );

    return task;
  }

  static async getTaskList(params = {}) {
    const { page = 1, pageSize = 20, status, assignee, startDate, endDate } = params;
    const where = {};

    if (status) where.status = status;
    if (assignee) where.assignee = assignee;
    if (startDate && endDate) {
      where.createdAt = { [require('sequelize').Op.between]: [startDate, endDate] };
    }

    const { count, rows } = await RemedyTask.findAndCountAll({
      where,
      include: [{ association: 'survey', include: ['lowScoreReason', 'department'] }],
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

module.exports = TaskService;
