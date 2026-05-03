const { ChoreTask, Flatmate, PointAdjustment } = require('../models');
const { ChoreService } = require('../services');
const { wrapAsync, AppError } = require('../middlewares');
const { ERROR_CODES, STATUS_MAP } = require('../config/constants');

class ChoreController {
  static getAll = wrapAsync(async (req, res, next) => {
    const { 
      status, 
      category, 
      assigned_to, 
      is_recurring,
      include_completed = false,
      days_ahead,
      limit = 20, 
      offset = 0 
    } = req.query;
    
    const whereClause = {};
    
    if (status) {
      whereClause.status = status;
    } else if (!include_completed) {
      // 默认不包含已完成和已跳过的任务
      whereClause.status = {
        $notIn: [STATUS_MAP.CHORE.COMPLETED, STATUS_MAP.CHORE.SKIPPED],
      };
    }
    
    if (category) {
      whereClause.category = category;
    }
    
    if (assigned_to) {
      whereClause.assigned_to_id = assigned_to;
    }
    
    if (is_recurring !== undefined) {
      whereClause.is_recurring = is_recurring === 'true';
    }
    
    const tasks = await ChoreTask.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Flatmate,
          as: 'assignedTo',
          attributes: ['id', 'name'],
        },
        {
          model: Flatmate,
          as: 'completedBy',
          attributes: ['id', 'name'],
        },
      ],
      order: [
        ['due_date', 'ASC'],
        ['priority', 'DESC'],
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
    
    // 计算统计数据
    const activeTasks = await ChoreTask.findAll({
      where: {
        status: {
          $notIn: [STATUS_MAP.CHORE.COMPLETED, STATUS_MAP.CHORE.SKIPPED],
        },
      },
    });
    
    let pendingCount = 0;
    let inProgressCount = 0;
    let overdueCount = 0;
    const now = new Date();
    
    for (const task of activeTasks) {
      switch (task.status) {
        case STATUS_MAP.CHORE.PENDING:
          pendingCount++;
          // 检查是否逾期
          if (task.due_date && task.due_date < now) {
            overdueCount++;
          }
          break;
        case STATUS_MAP.CHORE.IN_PROGRESS:
          inProgressCount++;
          break;
      }
    }
    
    res.json({
      success: true,
      data: {
        tasks: tasks.rows,
        total: tasks.count,
        stats: {
          pending_count: pendingCount,
          in_progress_count: inProgressCount,
          overdue_count: overdueCount,
        },
        limit: parseInt(limit),
        offset: parseInt(offset),
      },
    });
  });

  static getById = wrapAsync(async (req, res, next) => {
    const { id } = req.params;
    
    try {
      const task = await ChoreService.getTaskWithDetails(id);
      
      res.json({
        success: true,
        data: {
          task,
        },
      });
    } catch (error) {
      if (error.code === ERROR_CODES.CHORE_NOT_FOUND) {
        return next(new AppError(error.message, 404, error.code));
      }
      next(error);
    }
  });

  static create = wrapAsync(async (req, res, next) => {
    const creatorId = req.headers['x-user-id'] || 1;
    
    try {
      const task = await ChoreService.createTask(req.body, parseInt(creatorId));
      
      res.status(201).json({
        success: true,
        data: {
          task,
        },
        message: '任务创建成功',
      });
    } catch (error) {
      if (error.code) {
        return next(new AppError(error.message, 400, error.code));
      }
      next(error);
    }
  });

  static update = wrapAsync(async (req, res, next) => {
    const { id } = req.params;
    const { 
      title, 
      description, 
      category, 
      assigned_to_id,
      points_reward,
      points_penalty,
      priority,
      due_date,
      notes 
    } = req.body;
    
    const task = await ChoreTask.findOne({
      where: { id },
    });
    
    if (!task) {
      return next(new AppError('任务不存在', 404, ERROR_CODES.CHORE_NOT_FOUND));
    }
    
    // 已完成的任务不允许修改
    if (task.status === STATUS_MAP.CHORE.COMPLETED) {
      return next(new AppError('任务已完成，无法修改', 400, ERROR_CODES.CHORE_ALREADY_COMPLETED));
    }
    
    await task.update({
      title,
      description,
      category,
      assigned_to_id,
      points_reward,
      points_penalty,
      priority,
      due_date,
      notes,
    });
    
    res.json({
      success: true,
      data: {
        task,
      },
      message: '任务更新成功',
    });
  });

  static complete = wrapAsync(async (req, res, next) => {
    const { id } = req.params;
    const completerId = req.headers['x-user-id'] || 1;
    
    try {
      const result = await ChoreService.completeTask(
        parseInt(id),
        parseInt(completerId),
        req.body
      );
      
      res.json({
        success: true,
        data: {
          task: result.task,
          points_earned: result.points_earned,
        },
        message: `任务完成，获得 ${result.points_earned} 积分`,
      });
    } catch (error) {
      if (error.code) {
        const statusCode = error.code === ERROR_CODES.CHORE_NOT_FOUND ? 404 : 400;
        return next(new AppError(error.message, statusCode, error.code));
      }
      next(error);
    }
  });

  static miss = wrapAsync(async (req, res, next) => {
    const { id } = req.params;
    
    try {
      const result = await ChoreService.missTask(parseInt(id));
      
      res.json({
        success: true,
        data: {
          task: result.task,
          points_deducted: result.points_deducted,
        },
        message: `任务标记为爽约，扣除 ${result.points_deducted} 积分`,
      });
    } catch (error) {
      if (error.code) {
        const statusCode = error.code === ERROR_CODES.CHORE_NOT_FOUND ? 404 : 400;
        return next(new AppError(error.message, statusCode, error.code));
      }
      next(error);
    }
  });

  static skip = wrapAsync(async (req, res, next) => {
    const { id } = req.params;
    const { reason } = req.body;
    const skipperId = req.headers['x-user-id'] || 1;
    
    try {
      const task = await ChoreService.skipTask(
        parseInt(id),
        reason,
        parseInt(skipperId)
      );
      
      res.json({
        success: true,
        data: {
          task,
        },
        message: '任务已跳过',
      });
    } catch (error) {
      if (error.code) {
        const statusCode = error.code === ERROR_CODES.CHORE_NOT_FOUND ? 404 : 400;
        return next(new AppError(error.message, statusCode, error.code));
      }
      next(error);
    }
  });

  static getUpcoming = wrapAsync(async (req, res, next) => {
    const { flatmate_id, days_ahead = 7, include_completed = false } = req.query;
    const userId = flatmate_id || req.headers['x-user-id'];
    
    try {
      const result = await ChoreService.getUpcomingTasks(
        userId ? parseInt(userId) : null,
        {
          daysAhead: parseInt(days_ahead),
          includeCompleted: include_completed === 'true',
        }
      );
      
      res.json({
        success: true,
        data: {
          ...result,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  static getMyTasks = wrapAsync(async (req, res, next) => {
    const userId = req.headers['x-user-id'] || 1;
    const { status, category, limit = 20, offset = 0 } = req.query;
    
    const whereClause = {
      assigned_to_id: parseInt(userId),
    };
    
    if (status) {
      whereClause.status = status;
    }
    
    if (category) {
      whereClause.category = category;
    }
    
    const tasks = await ChoreTask.findAndCountAll({
      where: whereClause,
      order: [
        ['due_date', 'ASC'],
        ['priority', 'DESC'],
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
    
    // 计算统计
    const pendingTasks = await ChoreTask.findAll({
      where: {
        assigned_to_id: parseInt(userId),
        status: STATUS_MAP.CHORE.PENDING,
      },
    });
    
    const completedTasks = await ChoreTask.findAll({
      where: {
        assigned_to_id: parseInt(userId),
        status: STATUS_MAP.CHORE.COMPLETED,
      },
    });
    
    let totalPointsEarned = 0;
    for (const task of completedTasks) {
      totalPointsEarned += task.points_reward;
    }
    
    res.json({
      success: true,
      data: {
        tasks: tasks.rows,
        total: tasks.count,
        stats: {
          pending_count: pendingTasks.length,
          completed_count: completedTasks.length,
          total_points_earned: totalPointsEarned,
        },
        limit: parseInt(limit),
        offset: parseInt(offset),
      },
    });
  });

  static checkOverdue = wrapAsync(async (req, res, next) => {
    try {
      const result = await ChoreService.checkAndMarkOverdueTasks();
      
      res.json({
        success: true,
        data: {
          result,
        },
        message: result.tasks_marked_as_missed > 0 
          ? `已标记 ${result.tasks_marked_as_missed} 个过期任务为爽约` 
          : '没有过期任务需要处理',
      });
    } catch (error) {
      next(error);
    }
  });
}

module.exports = ChoreController;
