const express = require('express');
const store = require('../store');

const router = express.Router();

router.get('/', (req, res) => {
  try {
    const supplies = store.readSupplies();
    const records = store.readBorrowRecords();
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];
    
    let overdueCount = 0;
    let todayDueCount = 0;
    let lowStockItems = [];
    let activeBorrowCount = 0;
    
    records.forEach(r => {
      if (r.status === 'returned') return;
      
      activeBorrowCount++;
      
      const expectedReturn = new Date(r.expectedReturnDate);
      expectedReturn.setHours(0, 0, 0, 0);
      
      if (expectedReturn < today) {
        overdueCount++;
      }
      
      if (r.expectedReturnDate === todayStr) {
        todayDueCount++;
      }
    });
    
    supplies.forEach(s => {
      if (s.availableQuantity <= 0) {
        lowStockItems.push({
          id: s.id,
          name: s.name,
          category: s.category,
          totalQuantity: s.totalQuantity,
          availableQuantity: s.availableQuantity,
          status: 'out_of_stock'
        });
      } else if (s.availableQuantity <= 2) {
        lowStockItems.push({
          id: s.id,
          name: s.name,
          category: s.category,
          totalQuantity: s.totalQuantity,
          availableQuantity: s.availableQuantity,
          status: 'low_stock'
        });
      }
    });
    
    const categories = [...new Set(supplies.map(s => s.category))];
    
    res.json({
      success: true,
      data: {
        overview: {
          totalSupplies: supplies.length,
          totalCategories: categories.length,
          activeBorrowCount,
          overdueCount,
          todayDueCount
        },
        lowStockItems,
        categories
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '获取统计数据失败',
      message: error.message
    });
  }
});

module.exports = router;
