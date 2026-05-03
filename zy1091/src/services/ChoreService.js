const { Op } = require('sequelize');
const moment = require('moment');
const {
  ChoreTask,
  Flatmate,
  PointAdjustment,
  Notification,
  Dispute,
} = require('../models');
const {
  STATUS_MAP,
  POINTS_CONFIG,
  ERROR_CODES,
  NOTIFICATION_TYPES,
} = require('../config/constants');

class ChoreService {
  static async createTask(taskData, creatorId, options = {}) {
    const transaction = options.transaction || await ChoreTask.sequelize.transaction();
    
    try {
      // 1. 验证数据
      await this.validateTaskData(taskData);
      
      // 2. 创建任务
      const task = await ChoreTask.create(
        {
          title: taskData.title,
          description: taskData.description,
          category: taskData.category || 'other',
          assigned_to_id: taskData.assigned_to_id || null,
          points_reward: taskData.points_reward || 10,
          points_penalty: taskData.points_penalty || 5,
          status: STATUS_MAP.CHORE.PENDING,
          priority: taskData.priority || 'medium',
          due_date: taskData.due_date || null,
          is_recurring: taskData.is_recurring || false,
          recurrence_pattern: taskData.recurrence_pattern || null,
          recurrence_days: taskData.recurrence_days ? JSON.stringify(taskData.recurrence_days) : null,
          parent_task_id: null,
          notes: taskData.notes || null,
        },
        { transaction }
      );
      
      // 3. 如果是周期性任务，生成第一个周期的任务实例
      if (task.is_recurring) {
        await this.generateRecurringTasks(task, creatorId, transaction);
      }
      
      // 4. 发送通知给被分配人
      if (task.assigned_to_id) {
        await this.sendTaskAssignedNotifications(task, transaction);
      }
      
      if (!options.transaction) {
        await transaction.commit();
      }
      
      return task;
    } catch (error) {
      if (!options.transaction) {
        await transaction.rollback();
      }
      throw error;
    }
  }

  static async validateTaskData(taskData) {
    if (!taskData.title || taskData.title.trim() === '') {
      throw { code: ERROR_CODES.INVALID_INPUT, message: '任务标题不能为空' };
    }
    
    if (taskData.points_reward !== undefined && taskData.points_reward < 0) {
      throw { code: ERROR_CODES.INVALID_INPUT, message: '奖励积分不能为负数' };
    }
    
    if (taskData.points_penalty !== undefined && taskData.points_penalty < 0) {
      throw { code: ERROR_CODES.INVALID_INPUT, message: '惩罚积分不能为负数' };
    }
    
    if (taskData.due_date) {
      const dueDate = moment(taskData.due_date);
      if (dueDate.isBefore(moment().startOf('day'))) {
        throw { code: ERROR_CODES.INVALID_INPUT, message: '截止日期不能早于今天' };
      }
    }
    
    if (taskData.is_recurring) {
      if (!taskData.recurrence_pattern) {
        throw { code: ERROR_CODES.INVALID_INPUT, message: '周期性任务需要指定周期模式' };
      }
      
      const validPatterns = ['daily', 'weekly', 'biweekly', 'monthly'];
      if (!validPatterns.includes(taskData.recurrence_pattern)) {
        throw { code: ERROR_CODES.INVALID_INPUT, message: '无效的周期模式' };
      }
    }
  }

  static async generateRecurringTasks(parentTask, creatorId, transaction) {
    // 根据周期模式生成未来的任务
    // 这里只生成接下来7天/1周/1个月的任务
    
    const now = moment();
    let futureTasks = [];
    const recurrenceDays = parentTask.recurrence_days ? JSON.parse(parentTask.recurrence_days) : [];
    
    switch (parentTask.recurrence_pattern) {
      case 'daily':
        // 每天生成，生成接下来7天
        for (let i = 1; i <= 7; i++) {
          const dueDate = now.clone().add(i, 'days');
          futureTasks.push({
            parent_task_id: parentTask.id,
            due_date: dueDate.toDate(),
          });
        }
        break;
        
      case 'weekly':
        // 每周指定日期
        if (recurrenceDays.length > 0) {
          // 找到下一个符合的日期
          for (let i = 1; i <= 14; i++) {
            const date = now.clone().add(i, 'days');
            const dayName = this.getDayName(date.day());
            
            if (recurrenceDays.includes(dayName)) {
              futureTasks.push({
                parent_task_id: parentTask.id,
                due_date: date.toDate(),
              });
              
              if (futureTasks.length >= 4) break; // 最多生成4个
            }
          }
        }
        break;
        
      case 'biweekly':
        // 每两周
        for (let i = 1; i <= 28; i++) {
          const date = now.clone().add(i, 'days');
          const dayName = this.getDayName(date.day());
          
          if (recurrenceDays.includes(dayName) && i % 14 === 0) {
            futureTasks.push({
              parent_task_id: parentTask.id,
              due_date: date.toDate(),
            });
            break;
          }
        }
        break;
        
      case 'monthly':
        // 每月同一天
        const nextMonth = now.clone().add(1, 'months');
        futureTasks.push({
          parent_task_id: parentTask.id,
          due_date: nextMonth.toDate(),
        });
        break;
    }
    
    // 创建子任务
    for (const taskData of futureTasks) {
      await ChoreTask.create(
        {
          title: parentTask.title,
          description: parentTask.description,
          category: parentTask.category,
          assigned_to_id: parentTask.assigned_to_id,
          points_reward: parentTask.points_reward,
          points_penalty: parentTask.points_penalty,
          status: STATUS_MAP.CHORE.PENDING,
          priority: parentTask.priority,
          due_date: taskData.due_date,
          is_recurring: false,
          parent_task_id: taskData.parent_task_id,
          notes: `周期性任务，来源于: ${parentTask.id}`,
        },
        { transaction }
      );
    }
  }

  static getDayName(dayIndex) {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[dayIndex];
  }

  static async completeTask(taskId, completerId, completionData = {}, options = {}) {
    const transaction = options.transaction || await ChoreTask.sequelize.transaction();
    
    try {
      const task = await ChoreTask.findOne({
        where: { id: taskId },
        include: [
          { model: Flatmate, as: 'assignedTo' },
        ],
        transaction,
      });
      
      if (!task) {
        throw { code: ERROR_CODES.CHORE_NOT_FOUND, message: '任务不存在' };
      }
      
      if (task.status === STATUS_MAP.CHORE.COMPLETED) {
        throw { code: ERROR_CODES.CHORE_ALREADY_COMPLETED, message: '任务已完成' };
      }
      
      if (task.status === STATUS_MAP.CHORE.SKIPPED) {
        throw { code: ERROR_CODES.INVALID_INPUT, message: '任务已被跳过，无法完成' };
      }
      
      // 更新任务状态
      await task.update(
        {
          status: STATUS_MAP.CHORE.COMPLETED,
          completed_at: moment().toDate(),
          completed_by_id: completerId,
          proof_image_url: completionData.proof_image_url || null,
        },
        { transaction }
      );
      
      // 奖励积分
      const flatmateId = task.assigned_to_id || completerId;
      const flatmate = await Flatmate.findOne({
        where: { id: flatmateId },
        transaction,
      });
      
      if (flatmate) {
        const oldPoints = flatmate.points;
        const newPoints = oldPoints + task.points_reward;
        
        // 创建积分调整记录
        await PointAdjustment.create(
          {
            flatmate_id: flatmateId,
            task_id: task.id,
            adjustment_type: 'reward',
            points: task.points_reward,
            balance_before: oldPoints,
            balance_after: newPoints,
            monetary_value: (task.points_reward * POINTS_CONFIG.EXCHANGE_RATE).toFixed(2),
            reason: `完成家务任务: "${task.title}"，获得奖励积分`,
            is_system_generated: true,
          },
          { transaction }
        );
        
        // 更新室友积分
        await flatmate.update(
          { points: newPoints },
          { transaction }
        );
      }
      
      // 发送通知
      await this.sendTaskCompletedNotifications(task, flatmateId, transaction);
      
      if (!options.transaction) {
        await transaction.commit();
      }
      
      return {
        task,
        points_earned: task.points_reward,
      };
    } catch (error) {
      if (!options.transaction) {
        await transaction.rollback();
      }
      throw error;
    }
  }

  static async missTask(taskId, options = {}) {
    const transaction = options.transaction || await ChoreTask.sequelize.transaction();
    
    try {
      const task = await ChoreTask.findOne({
        where: { id: taskId },
        include: [
          { model: Flatmate, as: 'assignedTo' },
        ],
        transaction,
      });
      
      if (!task) {
        throw { code: ERROR_CODES.CHORE_NOT_FOUND, message: '任务不存在' };
      }
      
      if (task.status !== STATUS_MAP.CHORE.PENDING && 
          task.status !== STATUS_MAP.CHORE.IN_PROGRESS) {
        throw { code: ERROR_CODES.INVALID_INPUT, message: '任务状态不允许标记为爽约' };
      }
      
      // 更新任务状态
      await task.update(
        {
          status: STATUS_MAP.CHORE.MISSED,
        },
        { transaction }
      );
      
      // 惩罚积分（如果有分配人）
      if (task.assigned_to_id) {
        const flatmate = await Flatmate.findOne({
          where: { id: task.assigned_to_id },
          transaction,
        });
        
        if (flatmate) {
          const oldPoints = flatmate.points;
          const newPoints = Math.max(0, oldPoints - task.points_penalty);
          
          // 创建积分调整记录
          await PointAdjustment.create(
            {
              flatmate_id: task.assigned_to_id,
              task_id: task.id,
              adjustment_type: 'penalty',
              points: -task.points_penalty,
              balance_before: oldPoints,
              balance_after: newPoints,
              monetary_value: (task.points_penalty * POINTS_CONFIG.EXCHANGE_RATE).toFixed(2),
              reason: `爽约家务任务: "${task.title}"，扣除积分`,
              is_system_generated: true,
            },
            { transaction }
          );
          
          // 更新室友积分
          await flatmate.update(
            { points: newPoints },
            { transaction }
          );
        }
      }
      
      // 发送通知
      if (task.assigned_to_id) {
        await this.sendTaskMissedNotifications(task, transaction);
      }
      
      if (!options.transaction) {
        await transaction.commit();
      }
      
      return {
        task,
        points_deducted: task.points_penalty,
      };
    } catch (error) {
      if (!options.transaction) {
        await transaction.rollback();
      }
      throw error;
    }
  }

  static async skipTask(taskId, skipReason, skipperId, options = {}) {
    const transaction = options.transaction || await ChoreTask.sequelize.transaction();
    
    try {
      const task = await ChoreTask.findOne({
        where: { id: taskId },
        transaction,
      });
      
      if (!task) {
        throw { code: ERROR_CODES.CHORE_NOT_FOUND, message: '任务不存在' };
      }
      
      if (task.status === STATUS_MAP.CHORE.COMPLETED || 
          task.status === STATUS_MAP.CHORE.MISSED) {
        throw { code: ERROR_CODES.INVALID_INPUT, message: '任务已完成或已爽约，无法跳过' };
      }
      
      // 更新任务状态
      await task.update(
        {
          status: STATUS_MAP.CHORE.SKIPPED,
          notes: skipReason || task.notes,
        },
        { transaction }
      );
      
      if (!options.transaction) {
        await transaction.commit();
      }
      
      return task;
    } catch (error) {
      if (!options.transaction) {
        await transaction.rollback();
      }
      throw error;
    }
  }

  static async getTaskWithDetails(taskId) {
    const task = await ChoreTask.findOne({
      where: { id: taskId },
      include: [
        {
          model: Flatmate,
          as: 'assignedTo',
          attributes: ['id', 'name', 'email'],
        },
        {
          model: Flatmate,
          as: 'completedBy',
          attributes: ['id', 'name'],
        },
        {
          model: PointAdjustment,
          as: 'pointAdjustments',
          include: [
            {
              model: Flatmate,
              as: 'flatmate',
              attributes: ['id', 'name'],
            },
          ],
        },
        {
          model: Dispute,
          as: 'disputes',
          include: [
            {
              model: Flatmate,
              as: 'raisedBy',
              attributes: ['id', 'name'],
            },
          ],
        },
        {
          model: ChoreTask,
          as: 'parentTask',
          attributes: ['id', 'title', 'is_recurring'],
        },
      ],
    });
    
    if (!task) {
      throw { code: ERROR_CODES.CHORE_NOT_FOUND, message: '任务不存在' };
    }
    
    return task;
  }

  static async getUpcomingTasks(flatmateId = null, options = {}) {
    const { daysAhead = 7, includeCompleted = false } = options;
    
    const whereClause = {};
    
    if (flatmateId) {
      whereClause.assigned_to_id = flatmateId;
    }
    
    if (!includeCompleted) {
      whereClause.status = {
        [Op.in]: [STATUS_MAP.CHORE.PENDING, STATUS_MAP.CHORE.IN_PROGRESS],
      };
    }
    
    const startDate = moment().startOf('day').toDate();
    const endDate = moment().add(daysAhead, 'days').endOf('day').toDate();
    
    whereClause.due_date = {
      [Op.between]: [startDate, endDate],
    };
    
    const tasks = await ChoreTask.findAll({
      where: whereClause,
      include: [
        {
          model: Flatmate,
          as: 'assignedTo',
          attributes: ['id', 'name'],
        },
      ],
      order: [
        ['due_date', 'ASC'],
        ['priority', 'DESC'],
      ],
    });
    
    // 按日期分组
    const groupedTasks = {};
    for (const task of tasks) {
      const dateKey = moment(task.due_date).format('YYYY-MM-DD');
      if (!groupedTasks[dateKey]) {
        groupedTasks[dateKey] = [];
      }
      groupedTasks[dateKey].push(task);
    }
    
    return {
      total_count: tasks.length,
      days_ahead: daysAhead,
      grouped_tasks: groupedTasks,
      flat_tasks: tasks,
    };
  }

  static async sendTaskAssignedNotifications(task, transaction) {
    await Notification.create(
      {
        recipient_id: task.assigned_to_id,
        notification_type: NOTIFICATION_TYPES.CHORE_ASSIGNED,
        title: `新任务分配: ${task.title}`,
        content: `您有一个新的家务任务，截止日期: ${task.due_date || '未设置'}，完成可获得 ${task.points_reward} 积分`,
        is_read: false,
        is_urgent: task.priority === 'high',
        task_id: task.id,
        action_url: `/tasks/${task.id}`,
      },
      { transaction }
    );
  }

  static async sendTaskCompletedNotifications(task, flatmateId, transaction) {
    await Notification.create(
      {
        recipient_id: flatmateId,
        notification_type: NOTIFICATION_TYPES.POINT_EARNED,
        title: `任务完成，获得积分!`,
        content: `您完成了家务任务 "${task.title}"，获得了 ${task.points_reward} 积分`,
        is_read: false,
        is_urgent: false,
        task_id: task.id,
      },
      { transaction }
    );
  }

  static async sendTaskMissedNotifications(task, transaction) {
    await Notification.create(
      {
        recipient_id: task.assigned_to_id,
        notification_type: NOTIFICATION_TYPES.POINT_DEDUCTED,
        title: `任务爽约，扣除积分`,
        content: `您未能按时完成家务任务 "${task.title}"，扣除了 ${task.points_penalty} 积分`,
        is_read: false,
        is_urgent: true,
        task_id: task.id,
      },
      { transaction }
    );
  }

  static async checkAndMarkOverdueTasks() {
    const transaction = await ChoreTask.sequelize.transaction();
    
    try {
      const now = moment();
      
      // 找到所有过期的待处理任务
      const overdueTasks = await ChoreTask.findAll({
        where: {
          status: {
            [Op.in]: [STATUS_MAP.CHORE.PENDING, STATUS_MAP.CHORE.IN_PROGRESS],
          },
          due_date: {
            [Op.lt]: now.toDate(),
          },
        },
        include: [
          { model: Flatmate, as: 'assignedTo' },
        ],
        transaction,
      });
      
      let markedCount = 0;
      
      for (const task of overdueTasks) {
        // 标记为爽约
        try {
          await this.missTask(task.id, { transaction });
          markedCount++;
        } catch (error) {
          console.error(`处理过期任务失败: ${task.id}`, error);
        }
      }
      
      await transaction.commit();
      
      return {
        total_overdue_tasks_found: overdueTasks.length,
        tasks_marked_as_missed: markedCount,
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
}

module.exports = ChoreService;
