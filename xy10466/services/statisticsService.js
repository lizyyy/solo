const { Op, fn, col, literal } = require('sequelize');
const { Complaint, Compensation, FollowUp, Order, OrderItem } = require('../models/associations');

class StatisticsService {
  static async getReasonRanking(startDate, endDate) {
    const whereClause = {};
    if (startDate && endDate) {
      whereClause.createdAt = {
        [Op.between]: [new Date(startDate), new Date(endDate)]
      };
    }

    const reasonStats = await Complaint.findAll({
      attributes: [
        'reasonCategory',
        [fn('COUNT', col('id')), 'count'],
        [fn('ROUND', literal('COUNT(*) * 100.0 / (SELECT COUNT(*) FROM Complaints)'), 2), 'percentage']
      ],
      where: whereClause,
      group: ['reasonCategory'],
      order: [[literal('count'), 'DESC']]
    });

    const reasonMap = {
      'dish_issue': '菜品问题',
      'missing_item': '漏餐',
      'delivery_delay': '配送延迟',
      'package_damage': '包装破损',
      'other': '其他'
    };

    return reasonStats.map(stat => ({
      reason: reasonMap[stat.reasonCategory] || stat.reasonCategory,
      reasonCode: stat.reasonCategory,
      count: parseInt(stat.dataValues.count),
      percentage: parseFloat(stat.dataValues.percentage)
    }));
  }

  static async getCompensationStatistics(startDate, endDate) {
    const whereClause = {
      status: { [Op.in]: ['approved', 'executed'] }
    };
    if (startDate && endDate) {
      whereClause.createdAt = {
        [Op.between]: [new Date(startDate), new Date(endDate)]
      };
    }

    const totalStats = await Compensation.findAll({
      attributes: [
        [fn('SUM', col('amount')), 'totalAmount'],
        [fn('COUNT', col('id')), 'totalCount'],
        [fn('AVG', col('amount')), 'averageAmount']
      ],
      where: whereClause
    });

    const byTypeStats = await Compensation.findAll({
      attributes: [
        'type',
        [fn('SUM', col('amount')), 'totalAmount'],
        [fn('COUNT', col('id')), 'count']
      ],
      where: whereClause,
      group: ['type'],
      order: [[literal('totalAmount'), 'DESC']]
    });

    const byResponsibilityStats = await Compensation.findAll({
      attributes: [
        'responsibility',
        [fn('SUM', col('amount')), 'totalAmount'],
        [fn('COUNT', col('id')), 'count']
      ],
      where: whereClause,
      group: ['responsibility'],
      order: [[literal('totalAmount'), 'DESC']]
    });

    const typeMap = {
      'refund': '退款',
      'coupon': '优惠券',
      'discount': '折扣',
      'apology': '道歉',
      'none': '无补偿'
    };

    const responsibilityMap = {
      'restaurant': '门店',
      'rider': '骑手',
      'platform': '平台',
      'customer': '客户',
      'unknown': '未知'
    };

    return {
      summary: {
        totalAmount: parseFloat(totalStats[0]?.dataValues.totalAmount || 0),
        totalCount: parseInt(totalStats[0]?.dataValues.totalCount || 0),
        averageAmount: parseFloat(totalStats[0]?.dataValues.averageAmount || 0)
      },
      byType: byTypeStats.map(stat => ({
        type: typeMap[stat.type] || stat.type,
        typeCode: stat.type,
        totalAmount: parseFloat(stat.dataValues.totalAmount || 0),
        count: parseInt(stat.dataValues.count)
      })),
      byResponsibility: byResponsibilityStats.map(stat => ({
        responsibility: responsibilityMap[stat.responsibility] || stat.responsibility,
        responsibilityCode: stat.responsibility,
        totalAmount: parseFloat(stat.dataValues.totalAmount || 0),
        count: parseInt(stat.dataValues.count)
      }))
    };
  }

  static async getUnfollowedUpList(startDate, endDate) {
    const whereClause = {
      status: { [Op.ne]: 'closed' }
    };
    if (startDate && endDate) {
      whereClause.createdAt = {
        [Op.between]: [new Date(startDate), new Date(endDate)]
      };
    }

    const unfollowedComplaints = await Complaint.findAll({
      where: whereClause,
      include: [
        {
          model: Order,
          attributes: ['id', 'customerId', 'totalAmount', 'orderTime']
        },
        {
          model: FollowUp,
          required: false
        }
      ],
      order: [['createdAt', 'ASC']]
    });

    const result = [];
    for (const complaint of unfollowedComplaints) {
      const followUps = complaint.FollowUps || [];
      const hasCompletedFollowUp = followUps.some(f => f.isCompleted);
      const latestFollowUp = followUps.length > 0 
        ? followUps.sort((a, b) => new Date(b.followUpTime) - new Date(a.followUpTime))[0]
        : null;

      if (!hasCompletedFollowUp) {
        result.push({
          complaintId: complaint.id,
          orderId: complaint.orderId,
          customerId: complaint.Order?.customerId,
          complaintContent: complaint.complaintContent,
          reasonCategory: complaint.reasonCategory,
          complaintTime: complaint.complaintTime,
          status: complaint.status,
          latestFollowUpTime: latestFollowUp?.followUpTime || null,
          nextFollowUpTime: latestFollowUp?.nextFollowUpTime || complaint.createdAt,
          daysSinceComplaint: Math.floor((new Date() - new Date(complaint.createdAt)) / (1000 * 60 * 60 * 24))
        });
      }
    }

    return result;
  }

  static async getDishImprovementSuggestions(startDate, endDate) {
    const whereClause = {
      reasonCategory: { [Op.in]: ['dish_issue', 'missing_item'] }
    };
    if (startDate && endDate) {
      whereClause.createdAt = {
        [Op.between]: [new Date(startDate), new Date(endDate)]
      };
    }

    const dishComplaints = await Complaint.findAll({
      where: whereClause,
      include: [
        {
          model: Order,
          include: [OrderItem]
        }
      ]
    });

    const dishIssueMap = new Map();
    const missingDishMap = new Map();

    for (const complaint of dishComplaints) {
      const orderItems = complaint.Order?.OrderItems || [];
      
      if (complaint.reasonCategory === 'dish_issue') {
        const affectedItems = complaint.affectedItems || [];
        if (affectedItems.length > 0) {
          for (const item of affectedItems) {
            const key = item.dishId || item.dishName;
            if (!dishIssueMap.has(key)) {
              dishIssueMap.set(key, {
                dishId: item.dishId,
                dishName: item.dishName,
                issueCount: 0,
                issues: []
              });
            }
            const dishData = dishIssueMap.get(key);
            dishData.issueCount++;
            if (complaint.reasonDetail && !dishData.issues.includes(complaint.reasonDetail)) {
              dishData.issues.push(complaint.reasonDetail);
            }
          }
        } else {
          for (const item of orderItems) {
            const key = item.dishId;
            if (!dishIssueMap.has(key)) {
              dishIssueMap.set(key, {
                dishId: item.dishId,
                dishName: item.dishName,
                issueCount: 0,
                issues: []
              });
            }
            const dishData = dishIssueMap.get(key);
            dishData.issueCount++;
            if (complaint.reasonDetail && !dishData.issues.includes(complaint.reasonDetail)) {
              dishData.issues.push(complaint.reasonDetail);
            }
          }
        }
      }

      if (complaint.reasonCategory === 'missing_item') {
        const affectedItems = complaint.affectedItems || [];
        for (const item of affectedItems) {
          const key = item.dishId || item.dishName;
          if (!missingDishMap.has(key)) {
            missingDishMap.set(key, {
              dishId: item.dishId,
              dishName: item.dishName,
              missingCount: 0
            });
          }
          missingDishMap.get(key).missingCount++;
        }
      }
    }

    const dishIssues = Array.from(dishIssueMap.values())
      .sort((a, b) => b.issueCount - a.issueCount)
      .slice(0, 10);

    const missingDishes = Array.from(missingDishMap.values())
      .sort((a, b) => b.missingCount - a.missingCount)
      .slice(0, 10);

    const suggestions = [];
    
    if (dishIssues.length > 0) {
      suggestions.push({
        category: '菜品质量改进',
        priority: 'high',
        description: '以下菜品收到多次质量投诉，建议重点关注：',
        details: dishIssues.map(dish => ({
          dishName: dish.dishName,
          issueCount: dish.issueCount,
          commonIssues: dish.issues.slice(0, 3)
        }))
      });
    }

    if (missingDishes.length > 0) {
      suggestions.push({
        category: '出餐流程优化',
        priority: 'medium',
        description: '以下菜品漏餐频率较高，建议优化出餐核对流程：',
        details: missingDishes.map(dish => ({
          dishName: dish.dishName,
          missingCount: dish.missingCount
        }))
      });
    }

    if (suggestions.length === 0) {
      suggestions.push({
        category: '整体评价',
        priority: 'low',
        description: '近期菜品相关投诉较少，继续保持良好的菜品质量和出餐流程。',
        details: []
      });
    }

    return suggestions;
  }

  static async getClosedComplaintsCount(startDate, endDate) {
    const whereClause = {
      status: 'closed'
    };
    if (startDate && endDate) {
      whereClause.updatedAt = {
        [Op.between]: [new Date(startDate), new Date(endDate)]
      };
    }

    const closedComplaints = await Complaint.findAll({
      where: whereClause,
      include: [
        {
          model: FollowUp,
          required: true,
          where: { isCompleted: true }
        }
      ]
    });

    return {
      total: closedComplaints.length,
      details: closedComplaints.map(c => ({
        complaintId: c.id,
        orderId: c.orderId,
        closedAt: c.updatedAt,
        reasonCategory: c.reasonCategory
      }))
    };
  }
}

module.exports = StatisticsService;
