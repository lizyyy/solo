const express = require('express');
const router = express.Router();
const orderService = require('../services/orderService');

router.get('/users', async (req, res) => {
  try {
    const users = await orderService.getAllUsers();
    res.json({
      success: true,
      data: users,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.get('/courses', async (req, res) => {
  try {
    const courses = await orderService.getAllCourses();
    res.json({
      success: true,
      data: courses,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.get('/coupons', async (req, res) => {
  try {
    const coupons = await orderService.getAllCoupons();
    res.json({
      success: true,
      data: coupons,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.get('/group-buys', async (req, res) => {
  try {
    const groupBuys = await orderService.getAllGroupBuys();
    res.json({
      success: true,
      data: groupBuys,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.get('/statistics', async (req, res) => {
  try {
    const stats = await orderService.getStatistics();
    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.get('/report/orders', async (req, res) => {
  try {
    const { status, userId } = req.query;
    
    const orders = await orderService.getAllOrders({
      status,
      userId,
    });
    
    const simplifiedOrders = orders.map(order => ({
      orderNo: order.order_no,
      userName: order.user?.name,
      courseName: order.course?.name,
      originalPrice: order.original_price,
      finalPrice: order.final_price,
      totalDiscount: order.original_price - order.final_price,
      status: order.status,
      isOldStudent: order.is_old_student,
      hasCoupon: !!order.coupon_id,
      hasGroupBuy: !!order.group_buy_id,
      createdAt: order.created_at,
      customerExplanation: order.discount_details?.customerExplanation,
    }));
    
    res.json({
      success: true,
      data: {
        total: simplifiedOrders.length,
        orders: simplifiedOrders,
        exportTime: new Date().toISOString(),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;
