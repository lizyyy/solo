const express = require('express');
const router = express.Router();
const { Order, OrderItem, Delivery, Complaint, Compensation, FollowUp } = require('../models/associations');
const CompensationService = require('../services/compensationService');
const StatisticsService = require('../services/statisticsService');

router.post('/submit', async (req, res) => {
  try {
    const {
      orderId,
      order,
      orderItems,
      delivery,
      complaintContent,
      reasonCategory,
      reasonDetail,
      affectedItems,
      severity
    } = req.body;

    if (!orderId || !complaintContent || !reasonCategory) {
      return res.status(400).json({
        success: false,
        message: '缺少必要参数：orderId, complaintContent, reasonCategory'
      });
    }

    let existingOrder = await Order.findByPk(orderId);
    if (!existingOrder && order) {
      existingOrder = await Order.create({
        id: orderId,
        customerId: order.customerId,
        orderTime: order.orderTime || new Date(),
        totalAmount: order.totalAmount,
        status: order.status || 'completed',
        restaurantOutTime: order.restaurantOutTime,
        expectedDeliveryTime: order.expectedDeliveryTime,
        actualDeliveryTime: order.actualDeliveryTime
      });

      if (orderItems && orderItems.length > 0) {
        for (const item of orderItems) {
          await OrderItem.create({
            orderId,
            dishId: item.dishId,
            dishName: item.dishName,
            quantity: item.quantity || 1,
            price: item.price,
            isMissing: item.isMissing || false
          });
        }
      }

      if (delivery) {
        await Delivery.create({
          orderId,
          riderId: delivery.riderId,
          riderName: delivery.riderName,
          delayReason: delivery.delayReason || 'none',
          delayMinutes: delivery.delayMinutes || 0,
          packageStatus: delivery.packageStatus || 'intact'
        });
      }
    }

    const duplicateCheck = await CompensationService.checkDuplicateComplaint(
      orderId,
      reasonCategory
    );

    if (duplicateCheck.isDuplicate) {
      const duplicateComplaint = await Complaint.create({
        orderId,
        complaintContent,
        reasonCategory,
        reasonDetail,
        affectedItems,
        severity: severity || 'medium',
        status: 'pending',
        isDuplicate: true,
        originalComplaintId: duplicateCheck.originalComplaint.id
      });

      return res.status(200).json({
        success: true,
        message: '检测到重复投诉，已记录并关联到原始投诉',
        data: {
          complaint: duplicateComplaint,
          originalComplaint: duplicateCheck.originalComplaint,
          isDuplicate: true,
          compensationSuggestions: null
        }
      });
    }

    const complaint = await Complaint.create({
      orderId,
      complaintContent,
      reasonCategory,
      reasonDetail,
      affectedItems,
      severity: severity || 'medium',
      status: 'processing'
    });

    const orderData = existingOrder || await Order.findByPk(orderId);
    const deliveryData = await Delivery.findOne({ where: { orderId } });

    const compensationResult = await CompensationService.generateCompensationSuggestion(
      complaint,
      orderData,
      deliveryData
    );

    const compensationRecords = [];
    for (const suggestion of compensationResult.suggestions) {
      const compensation = await CompensationService.createCompensation(
        complaint.id,
        orderId,
        suggestion,
        compensationResult.responsibility
      );
      compensationRecords.push(compensation);
    }

    return res.status(200).json({
      success: true,
      message: '差评录入成功',
      data: {
        complaint,
        hasCompensated: compensationResult.hasCompensated,
        compensationSuggestions: compensationResult.suggestions,
        compensationRecords,
        responsibility: compensationResult.responsibility
      }
    });
  } catch (error) {
    console.error('提交差评出错:', error);
    return res.status(500).json({
      success: false,
      message: '服务器内部错误',
      error: error.message
    });
  }
});

router.post('/:complaintId/followup', async (req, res) => {
  try {
    const { complaintId } = req.params;
    const {
      followUpBy,
      customerResponse,
      responseDetail,
      isCompleted,
      nextFollowUpTime,
      notes,
      closeComplaint
    } = req.body;

    if (!followUpBy || !customerResponse) {
      return res.status(400).json({
        success: false,
        message: '缺少必要参数：followUpBy, customerResponse'
      });
    }

    const complaint = await Complaint.findByPk(complaintId);
    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: '投诉记录不存在'
      });
    }

    const followUp = await FollowUp.create({
      complaintId,
      followUpBy,
      customerResponse,
      responseDetail,
      isCompleted: isCompleted || false,
      nextFollowUpTime: nextFollowUpTime || null,
      notes
    });

    let updatedComplaint = complaint;
    if (closeComplaint && isCompleted) {
      updatedComplaint = await complaint.update({
        status: 'closed'
      });
    }

    return res.status(200).json({
      success: true,
      message: '回访记录保存成功',
      data: {
        followUp,
        complaint: updatedComplaint,
        isClosed: closeComplaint && isCompleted
      }
    });
  } catch (error) {
    console.error('保存回访记录出错:', error);
    return res.status(500).json({
      success: false,
      message: '服务器内部错误',
      error: error.message
    });
  }
});

router.get('/:complaintId', async (req, res) => {
  try {
    const { complaintId } = req.params;

    const complaint = await Complaint.findByPk(complaintId, {
      include: [
        {
          model: Order,
          include: [OrderItem, Delivery]
        },
        {
          model: Compensation
        },
        {
          model: FollowUp,
          order: [['createdAt', 'DESC']]
        }
      ]
    });

    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: '投诉记录不存在'
      });
    }

    return res.status(200).json({
      success: true,
      data: complaint
    });
  } catch (error) {
    console.error('获取投诉详情出错:', error);
    return res.status(500).json({
      success: false,
      message: '服务器内部错误',
      error: error.message
    });
  }
});

router.get('/statistics/reason-ranking', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const reasonRanking = await StatisticsService.getReasonRanking(startDate, endDate);

    return res.status(200).json({
      success: true,
      data: reasonRanking
    });
  } catch (error) {
    console.error('获取差评原因排行出错:', error);
    return res.status(500).json({
      success: false,
      message: '服务器内部错误',
      error: error.message
    });
  }
});

router.get('/statistics/compensation', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const compensationStats = await StatisticsService.getCompensationStatistics(startDate, endDate);

    return res.status(200).json({
      success: true,
      data: compensationStats
    });
  } catch (error) {
    console.error('获取补偿统计出错:', error);
    return res.status(500).json({
      success: false,
      message: '服务器内部错误',
      error: error.message
    });
  }
});

router.get('/statistics/unfollowed-up', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const unfollowedList = await StatisticsService.getUnfollowedUpList(startDate, endDate);

    return res.status(200).json({
      success: true,
      data: {
        count: unfollowedList.length,
        list: unfollowedList
      }
    });
  } catch (error) {
    console.error('获取未回访清单出错:', error);
    return res.status(500).json({
      success: false,
      message: '服务器内部错误',
      error: error.message
    });
  }
});

router.get('/statistics/dish-improvement', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const suggestions = await StatisticsService.getDishImprovementSuggestions(startDate, endDate);

    return res.status(200).json({
      success: true,
      data: suggestions
    });
  } catch (error) {
    console.error('获取菜品改进建议出错:', error);
    return res.status(500).json({
      success: false,
      message: '服务器内部错误',
      error: error.message
    });
  }
});

router.get('/statistics/closed-count', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const closedStats = await StatisticsService.getClosedComplaintsCount(startDate, endDate);

    return res.status(200).json({
      success: true,
      data: closedStats
    });
  } catch (error) {
    console.error('获取已结案统计出错:', error);
    return res.status(500).json({
      success: false,
      message: '服务器内部错误',
      error: error.message
    });
  }
});

router.get('/statistics/overview', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const [reasonRanking, compensationStats, unfollowedList, dishSuggestions, closedStats] = await Promise.all([
      StatisticsService.getReasonRanking(startDate, endDate),
      StatisticsService.getCompensationStatistics(startDate, endDate),
      StatisticsService.getUnfollowedUpList(startDate, endDate),
      StatisticsService.getDishImprovementSuggestions(startDate, endDate),
      StatisticsService.getClosedComplaintsCount(startDate, endDate)
    ]);

    return res.status(200).json({
      success: true,
      data: {
        reasonRanking,
        compensationStatistics: compensationStats,
        unfollowedUp: {
          count: unfollowedList.length,
          list: unfollowedList.slice(0, 10)
        },
        dishImprovementSuggestions: dishSuggestions,
        closedComplaints: closedStats
      }
    });
  } catch (error) {
    console.error('获取统计概览出错:', error);
    return res.status(500).json({
      success: false,
      message: '服务器内部错误',
      error: error.message
    });
  }
});

module.exports = router;
