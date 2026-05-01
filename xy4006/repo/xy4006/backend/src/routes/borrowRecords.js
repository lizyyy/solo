const express = require('express');
const { v4: uuidv4 } = require('uuid');
const store = require('../store');

const router = express.Router();

router.get('/', (req, res) => {
  try {
    const { status, supplyId, view } = req.query;
    let records = store.readBorrowRecords();
    const supplies = store.readSupplies();
    
    if (status) {
      records = records.filter(r => r.status === status);
    }
    
    if (supplyId) {
      records = records.filter(r => r.supplyId === supplyId);
    }
    
    if (view) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString().split('T')[0];
      
      if (view === 'overdue') {
        records = records.filter(r => {
          if (r.status === 'returned') return false;
          const expectedReturn = new Date(r.expectedReturnDate);
          expectedReturn.setHours(0, 0, 0, 0);
          return expectedReturn < today;
        });
      } else if (view === 'today') {
        records = records.filter(r => {
          if (r.status === 'returned') return false;
          return r.expectedReturnDate === todayStr;
        });
      } else if (view === 'active') {
        records = records.filter(r => r.status !== 'returned');
      }
    }
    
    const recordsWithSupplyName = records.map(r => {
      const supply = supplies.find(s => s.id === r.supplyId);
      return {
        ...r,
        supplyName: supply ? supply.name : '已删除物资',
        supplyCategory: supply ? supply.category : ''
      };
    });
    
    recordsWithSupplyName.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    res.json({
      success: true,
      data: recordsWithSupplyName
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '获取借用记录失败',
      message: error.message
    });
  }
});

router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const records = store.readBorrowRecords();
    const supplies = store.readSupplies();
    const record = records.find(r => r.id === id);
    
    if (!record) {
      return res.status(404).json({
        success: false,
        error: '借用记录不存在'
      });
    }
    
    const supply = supplies.find(s => s.id === record.supplyId);
    const recordWithSupply = {
      ...record,
      supplyName: supply ? supply.name : '已删除物资',
      supplyCategory: supply ? supply.category : ''
    };
    
    res.json({
      success: true,
      data: recordWithSupply
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '获取借用记录详情失败',
      message: error.message
    });
  }
});

router.post('/', (req, res) => {
  try {
    const { supplyId, quantity, borrower, phone, expectedReturnDate } = req.body;
    
    if (!supplyId || !quantity || !borrower || !phone || !expectedReturnDate) {
      return res.status(400).json({
        success: false,
        error: '请填写所有必填项：物资、数量、借用人、手机号、预计归还日期'
      });
    }
    
    const qty = Number(quantity);
    if (qty <= 0) {
      return res.status(400).json({
        success: false,
        error: '借用数量必须大于0'
      });
    }
    
    const supplies = store.readSupplies();
    const supply = supplies.find(s => s.id === supplyId);
    
    if (!supply) {
      return res.status(404).json({
        success: false,
        error: '物资不存在'
      });
    }
    
    if (supply.availableQuantity < qty) {
      return res.status(400).json({
        success: false,
        error: `可借数量不足，当前可借：${supply.availableQuantity}，您需要：${qty}`
      });
    }
    
    const records = store.readBorrowRecords();
    
    const newRecord = {
      id: uuidv4(),
      supplyId: supplyId,
      quantity: qty,
      borrower: borrower.trim(),
      phone: phone.trim(),
      expectedReturnDate: expectedReturnDate,
      status: 'borrowed',
      returnedQuantity: 0,
      returnHistory: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    const supplyIndex = supplies.findIndex(s => s.id === supplyId);
    supplies[supplyIndex].availableQuantity -= qty;
    supplies[supplyIndex].updatedAt = new Date().toISOString();
    
    records.push(newRecord);
    store.writeBorrowRecords(records);
    store.writeSupplies(supplies);
    
    res.status(201).json({
      success: true,
      data: {
        ...newRecord,
        supplyName: supply.name,
        supplyCategory: supply.category
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '创建借用记录失败',
      message: error.message
    });
  }
});

router.post('/:id/return', (req, res) => {
  try {
    const { id } = req.params;
    const { returnQuantity, remark } = req.body;
    
    if (!returnQuantity) {
      return res.status(400).json({
        success: false,
        error: '请填写归还数量'
      });
    }
    
    const returnQty = Number(returnQuantity);
    if (returnQty <= 0) {
      return res.status(400).json({
        success: false,
        error: '归还数量必须大于0'
      });
    }
    
    const records = store.readBorrowRecords();
    const recordIndex = records.findIndex(r => r.id === id);
    
    if (recordIndex === -1) {
      return res.status(404).json({
        success: false,
        error: '借用记录不存在'
      });
    }
    
    const record = records[recordIndex];
    
    if (record.status === 'returned') {
      return res.status(400).json({
        success: false,
        error: '该借用记录已全部归还'
      });
    }
    
    const remainingToReturn = record.quantity - record.returnedQuantity;
    if (returnQty > remainingToReturn) {
      return res.status(400).json({
        success: false,
        error: `归还数量不能超过未归还数量：${remainingToReturn}`
      });
    }
    
    const supplies = store.readSupplies();
    const supplyIndex = supplies.findIndex(s => s.id === record.supplyId);
    
    if (supplyIndex !== -1) {
      supplies[supplyIndex].availableQuantity += returnQty;
      supplies[supplyIndex].updatedAt = new Date().toISOString();
    }
    
    record.returnedQuantity += returnQty;
    record.returnHistory = record.returnHistory || [];
    record.returnHistory.push({
      quantity: returnQty,
      remark: remark || '',
      returnedAt: new Date().toISOString()
    });
    
    if (record.returnedQuantity === record.quantity) {
      record.status = 'returned';
    }
    
    record.updatedAt = new Date().toISOString();
    records[recordIndex] = record;
    
    store.writeBorrowRecords(records);
    store.writeSupplies(supplies);
    
    const supply = supplies.find(s => s.id === record.supplyId);
    const recordWithSupply = {
      ...record,
      supplyName: supply ? supply.name : '已删除物资',
      supplyCategory: supply ? supply.category : ''
    };
    
    res.json({
      success: true,
      data: recordWithSupply
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '归还操作失败',
      message: error.message
    });
  }
});

module.exports = router;
