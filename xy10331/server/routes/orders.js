const express = require('express');
const router = express.Router();
const multer = require('multer');
const XLSX = require('xlsx');
const { readData, writeData, generateId, generateOrderNumber, calculateDays, isOverdue } = require('../utils/dataHandler');

const EQUIPMENT_FILE = 'equipment.json';
const ORDERS_FILE = 'orders.json';

const STATUS = {
  PENDING: '待支付押金',
  BORROWED: '已借出',
  OVERDUE: '已逾期',
  RETURNED_PARTIAL: '部分归还',
  COMPLETED: '已完成',
  CANCELLED: '已取消'
};

const FEE_TYPES = {
  RENTAL: '租赁费',
  CLEANING: '清洗费',
  DAMAGE: '损坏赔偿',
  LOST: '遗失赔偿',
  OVERDUE: '逾期费',
  DEPOSIT_SHORTAGE: '押金补收'
};

router.get('/', (req, res) => {
  try {
    const orders = readData(ORDERS_FILE);
    const { status, customerName, orderNumber } = req.query;
    
    let filtered = orders;
    
    if (status) {
      filtered = filtered.filter(o => o.status === status);
    }
    
    if (customerName) {
      filtered = filtered.filter(o => 
        o.customerName && o.customerName.toLowerCase().includes(customerName.toLowerCase())
      );
    }
    
    if (orderNumber) {
      filtered = filtered.filter(o => 
        o.orderNumber && o.orderNumber.toLowerCase().includes(orderNumber.toLowerCase())
      );
    }
    
    filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    res.json({
      success: true,
      data: filtered
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取订单列表失败',
      error: error.message
    });
  }
});

router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const orders = readData(ORDERS_FILE);
    const order = orders.find(o => o.id === id || o.orderNumber === id);
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: '订单不存在'
      });
    }
    
    if (isOverdue(order.dueDate) && order.status === STATUS.BORROWED) {
      order.status = STATUS.OVERDUE;
      writeData(ORDERS_FILE, orders);
    }
    
    res.json({
      success: true,
      data: order
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取订单详情失败',
      error: error.message
    });
  }
});

router.post('/', (req, res) => {
  try {
    const { 
      customerName, 
      phone, 
      equipmentId, 
      rentalDays, 
      actualDeposit,
      startDate,
      endDate
    } = req.body;
    
    if (!customerName || !phone || !equipmentId) {
      return res.status(400).json({
        success: false,
        message: '请填写客户信息和选择装备套装'
      });
    }
    
    const equipment = readData(EQUIPMENT_FILE);
    const orders = readData(ORDERS_FILE);
    
    const equipmentItem = equipment.find(e => e.id === equipmentId);
    
    if (!equipmentItem) {
      return res.status(404).json({
        success: false,
        message: '装备套装不存在'
      });
    }
    
    if (equipmentItem.stock < 1) {
      return res.status(400).json({
        success: false,
        message: '该装备套装库存不足'
      });
    }
    
    const rentalStart = startDate || new Date().toISOString().split('T')[0];
    const rentalEnd = endDate || (() => {
      const date = new Date();
      date.setDate(date.getDate() + (rentalDays || 1));
      return date.toISOString().split('T')[0];
    })();
    
    const actualRentalDays = rentalDays || calculateDays(rentalStart, rentalEnd) || 1;
    const totalRentalFee = equipmentItem.totalRentalFee * actualRentalDays;
    const requiredDeposit = equipmentItem.totalDeposit;
    
    const depositStatus = actualDeposit >= requiredDeposit ? '足额' : '不足';
    const depositShortage = Math.max(0, requiredDeposit - (actualDeposit || 0));
    
    const orderItems = equipmentItem.items.map(item => ({
      ...item,
      status: '未归还',
      returnedQuantity: 0
    }));
    
    const newOrder = {
      id: generateId(),
      orderNumber: generateOrderNumber(),
      customerName,
      phone,
      equipmentId,
      equipmentName: equipmentItem.name,
      items: orderItems,
      rentalDays: actualRentalDays,
      rentalStart,
      rentalEnd,
      dueDate: rentalEnd,
      totalRentalFee,
      requiredDeposit,
      actualDeposit: actualDeposit || 0,
      depositStatus,
      depositShortage,
      status: (actualDeposit || 0) > 0 ? STATUS.BORROWED : STATUS.PENDING,
      fees: [],
      totalFees: 0,
      refundAmount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    if (depositStatus === '不足') {
      newOrder.fees.push({
        id: generateId(),
        type: FEE_TYPES.DEPOSIT_SHORTAGE,
        amount: depositShortage,
        reason: `押金不足，需补交 ${depositShortage} 元`,
        createdAt: new Date().toISOString()
      });
    }
    
    if ((actualDeposit || 0) > 0) {
      equipmentItem.stock -= 1;
      writeData(EQUIPMENT_FILE, equipment);
    }
    
    orders.push(newOrder);
    writeData(ORDERS_FILE, orders);
    
    res.json({
      success: true,
      message: depositStatus === '不足' ? '订单创建成功，但押金不足' : '订单创建成功',
      data: newOrder
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '创建订单失败',
      error: error.message
    });
  }
});

router.post('/:id/return', (req, res) => {
  try {
    const { id } = req.params;
    const { returnedItems, fees, notes } = req.body;
    
    const orders = readData(ORDERS_FILE);
    const equipment = readData(EQUIPMENT_FILE);
    
    const orderIndex = orders.findIndex(o => o.id === id || o.orderNumber === id);
    
    if (orderIndex === -1) {
      return res.status(404).json({
        success: false,
        message: '订单不存在'
      });
    }
    
    const order = orders[orderIndex];
    
    if (order.status === STATUS.COMPLETED) {
      return res.status(400).json({
        success: false,
        message: '该订单已完成，请勿重复归还'
      });
    }
    
    const equipmentItem = equipment.find(e => e.id === order.equipmentId);
    
    const overdue = isOverdue(order.dueDate);
    let overdueDays = 0;
    let overdueFee = 0;
    
    if (overdue) {
      overdueDays = Math.ceil((new Date() - new Date(order.dueDate)) / (1000 * 60 * 60 * 24));
      overdueFee = order.totalRentalFee / order.rentalDays * overdueDays * 1.5;
    }
    
    let allItemsReturned = true;
    const newFees = [];
    
    order.items = order.items.map((item, index) => {
      const returnedInfo = returnedItems?.[index];
      const returned = returnedInfo?.returned === true;
      const returnedQuantity = returned ? (returnedInfo.quantity || item.quantity) : item.returnedQuantity || 0;
      
      if (returned && returnedQuantity > 0) {
        if (returnedInfo.cleaningNeeded) {
          newFees.push({
            id: generateId(),
            type: FEE_TYPES.CLEANING,
            amount: returnedInfo.cleaningFee || 20,
            reason: `${item.name} 需要清洗`,
            itemName: item.name,
            createdAt: new Date().toISOString()
          });
        }
        
        if (returnedInfo.damaged) {
          newFees.push({
            id: generateId(),
            type: FEE_TYPES.DAMAGE,
            amount: returnedInfo.damageFee || item.deposit * 0.3,
            reason: `${item.name} 损坏：${returnedInfo.damageDescription || '未说明'}`,
            itemName: item.name,
            createdAt: new Date().toISOString()
          });
        }
      }
      
      const notReturned = item.quantity - returnedQuantity;
      if (notReturned > 0) {
        allItemsReturned = false;
      }
      
      return {
        ...item,
        status: returned ? (notReturned > 0 ? '部分归还' : '已归还') : item.status,
        returnedQuantity
      };
    });
    
    if (fees && fees.length > 0) {
      fees.forEach(fee => {
        newFees.push({
          id: generateId(),
          type: fee.type,
          amount: fee.amount,
          reason: fee.reason,
          itemName: fee.itemName,
          createdAt: new Date().toISOString()
        });
      });
    }
    
    if (overdueFee > 0) {
      newFees.push({
        id: generateId(),
        type: FEE_TYPES.OVERDUE,
        amount: overdueFee,
        reason: `订单逾期 ${overdueDays} 天`,
        createdAt: new Date().toISOString()
      });
    }
    
    newFees.forEach(fee => {
      order.fees.push(fee);
    });
    
    order.totalFees = order.fees.reduce((sum, fee) => sum + fee.amount, 0);
    
    const totalDeductions = order.totalRentalFee + order.totalFees;
    order.refundAmount = Math.max(0, order.actualDeposit - totalDeductions);
    
    if (allItemsReturned) {
      order.status = STATUS.COMPLETED;
      order.returnDate = new Date().toISOString();
      if (equipmentItem) {
        equipmentItem.stock += 1;
        writeData(EQUIPMENT_FILE, equipment);
      }
    } else {
      order.status = STATUS.RETURNED_PARTIAL;
      order.partialReturnDate = new Date().toISOString();
      const notReturnedItems = order.items.filter(item => item.quantity > item.returnedQuantity);
      notReturnedItems.forEach(item => {
        const notReturnedQty = item.quantity - item.returnedQuantity;
        if (notReturnedQty > 0) {
          order.fees.push({
            id: generateId(),
            type: FEE_TYPES.LOST,
            amount: item.deposit * notReturnedQty,
            reason: `${item.name} 未归还，数量：${notReturnedQty}`,
            itemName: item.name,
            createdAt: new Date().toISOString()
          });
        }
      });
      order.totalFees = order.fees.reduce((sum, fee) => sum + fee.amount, 0);
      order.refundAmount = Math.max(0, order.actualDeposit - (order.totalRentalFee + order.totalFees));
    }
    
    order.notes = notes;
    order.updatedAt = new Date().toISOString();
    
    writeData(ORDERS_FILE, orders);
    
    res.json({
      success: true,
      message: allItemsReturned ? '归还验收完成' : '部分归还已记录',
      data: order
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '归还验收失败',
      error: error.message
    });
  }
});

router.post('/:id/complete-return', (req, res) => {
  try {
    const { id } = req.params;
    const { returnedItems, fees, notes } = req.body;
    
    const orders = readData(ORDERS_FILE);
    const equipment = readData(EQUIPMENT_FILE);
    
    const orderIndex = orders.findIndex(o => o.id === id || o.orderNumber === id);
    
    if (orderIndex === -1) {
      return res.status(404).json({
        success: false,
        message: '订单不存在'
      });
    }
    
    const order = orders[orderIndex];
    
    if (order.status === STATUS.COMPLETED) {
      return res.status(400).json({
        success: false,
        message: '该订单已完成，请勿重复归还'
      });
    }
    
    const equipmentItem = equipment.find(e => e.id === order.equipmentId);
    
    const newFees = [];
    
    if (returnedItems) {
      order.items = order.items.map((item, index) => {
        const returnedInfo = returnedItems[index];
        const returned = returnedInfo?.returned === true;
        const returnedQuantity = returned ? (returnedInfo.quantity || item.quantity) : item.returnedQuantity || 0;
        
        if (returned && returnedQuantity > 0) {
          if (returnedInfo.cleaningNeeded) {
            newFees.push({
              id: generateId(),
              type: FEE_TYPES.CLEANING,
              amount: returnedInfo.cleaningFee || 20,
              reason: `${item.name} 需要清洗`,
              itemName: item.name,
              createdAt: new Date().toISOString()
            });
          }
          
          if (returnedInfo.damaged) {
            newFees.push({
              id: generateId(),
              type: FEE_TYPES.DAMAGE,
              amount: returnedInfo.damageFee || item.deposit * 0.3,
              reason: `${item.name} 损坏：${returnedInfo.damageDescription || '未说明'}`,
              itemName: item.name,
              createdAt: new Date().toISOString()
            });
          }
        }
        
        return {
          ...item,
          status: '已归还',
          returnedQuantity: item.quantity
        };
      });
    }
    
    if (fees && fees.length > 0) {
      fees.forEach(fee => {
        newFees.push({
          id: generateId(),
          type: fee.type,
          amount: fee.amount,
          reason: fee.reason,
          itemName: fee.itemName,
          createdAt: new Date().toISOString()
        });
      });
    }
    
    newFees.forEach(fee => {
      order.fees.push(fee);
    });
    
    order.totalFees = order.fees.reduce((sum, fee) => sum + fee.amount, 0);
    
    const totalDeductions = order.totalRentalFee + order.totalFees;
    order.refundAmount = Math.max(0, order.actualDeposit - totalDeductions);
    
    order.status = STATUS.COMPLETED;
    order.returnDate = new Date().toISOString();
    order.notes = notes;
    order.updatedAt = new Date().toISOString();
    
    if (equipmentItem) {
      equipmentItem.stock += 1;
      writeData(EQUIPMENT_FILE, equipment);
    }
    
    writeData(ORDERS_FILE, orders);
    
    res.json({
      success: true,
      message: '订单已完成',
      data: order
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '完成订单失败',
      error: error.message
    });
  }
});

router.put('/:id/deposit', (req, res) => {
  try {
    const { id } = req.params;
    const { additionalDeposit } = req.body;
    
    if (!additionalDeposit || additionalDeposit <= 0) {
      return res.status(400).json({
        success: false,
        message: '请输入有效的补交押金金额'
      });
    }
    
    const orders = readData(ORDERS_FILE);
    const equipment = readData(EQUIPMENT_FILE);
    
    const orderIndex = orders.findIndex(o => o.id === id || o.orderNumber === id);
    
    if (orderIndex === -1) {
      return res.status(404).json({
        success: false,
        message: '订单不存在'
      });
    }
    
    const order = orders[orderIndex];
    
    const previousDeposit = order.actualDeposit;
    order.actualDeposit += additionalDeposit;
    
    if (previousDeposit === 0 && order.actualDeposit > 0) {
      const equipmentItem = equipment.find(e => e.id === order.equipmentId);
      if (equipmentItem && equipmentItem.stock > 0) {
        equipmentItem.stock -= 1;
        order.status = STATUS.BORROWED;
        writeData(EQUIPMENT_FILE, equipment);
      }
    }
    
    order.depositStatus = order.actualDeposit >= order.requiredDeposit ? '足额' : '不足';
    order.depositShortage = Math.max(0, order.requiredDeposit - order.actualDeposit);
    
    order.fees.push({
      id: generateId(),
      type: FEE_TYPES.DEPOSIT_SHORTAGE,
      amount: -additionalDeposit,
      reason: `补交押金 ${additionalDeposit} 元`,
      createdAt: new Date().toISOString()
    });
    
    order.totalFees = order.fees.reduce((sum, fee) => sum + fee.amount, 0);
    order.updatedAt = new Date().toISOString();
    
    writeData(ORDERS_FILE, orders);
    
    res.json({
      success: true,
      message: `已补交押金 ${additionalDeposit} 元`,
      data: order
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '补交押金失败',
      error: error.message
    });
  }
});

router.get('/export/statement', (req, res) => {
  try {
    const orders = readData(ORDERS_FILE);
    const { startDate, endDate } = req.query;
    
    let filtered = orders;
    
    if (startDate) {
      filtered = filtered.filter(o => new Date(o.createdAt) >= new Date(startDate));
    }
    
    if (endDate) {
      filtered = filtered.filter(o => new Date(o.createdAt) <= new Date(endDate));
    }
    
    const statementData = [];
    
    filtered.forEach(order => {
      const row = {
        '订单号': order.orderNumber,
        '客户姓名': order.customerName,
        '联系电话': order.phone,
        '装备套装': order.equipmentName,
        '租赁天数': order.rentalDays,
        '开始日期': order.rentalStart,
        '结束日期': order.rentalEnd,
        '租赁费': order.totalRentalFee,
        '应交押金': order.requiredDeposit,
        '实交押金': order.actualDeposit,
        '押金状态': order.depositStatus,
        '订单状态': order.status,
        '总扣费': order.totalFees,
        '退还押金': order.refundAmount,
        '创建时间': order.createdAt,
        '归还时间': order.returnDate || ''
      };
      
      order.fees.forEach((fee, index) => {
        statementData.push({
          ...row,
          '扣费类型': fee.type,
          '扣费金额': fee.amount,
          '扣费原因': fee.reason,
          '扣费时间': fee.createdAt
        });
      });
      
      if (order.fees.length === 0) {
        statementData.push({
          ...row,
          '扣费类型': '',
          '扣费金额': '',
          '扣费原因': '',
          '扣费时间': ''
        });
      }
    });
    
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(statementData);
    XLSX.utils.book_append_sheet(wb, ws, '对账明细');
    
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=对账单_${new Date().toISOString().split('T')[0]}.xlsx`);
    
    res.send(buffer);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '导出对账单失败',
      error: error.message
    });
  }
});

const storage = multer.memoryStorage();
const upload = multer({ storage });

router.post('/import', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: '请上传文件'
      });
    }
    
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);
    
    const orders = readData(ORDERS_FILE);
    const equipment = readData(EQUIPMENT_FILE);
    
    const results = {
      success: [],
      partial: [],
      failed: []
    };
    
    data.forEach((row, index) => {
      try {
        const { 
          '客户姓名': customerName,
          '联系电话': phone,
          '装备套装': equipmentName,
          '租赁天数': rentalDays,
          '实际押金': actualDeposit,
          '开始日期': startDate,
          '结束日期': endDate
        } = row;
        
        if (!customerName || !phone || !equipmentName) {
          results.failed.push({
            row: index + 2,
            message: '缺少必要字段：客户姓名、联系电话、装备套装',
            data: row
          });
          return;
        }
        
        const equipmentItem = equipment.find(e => e.name === equipmentName);
        
        if (!equipmentItem) {
          results.failed.push({
            row: index + 2,
            message: `装备套装「${equipmentName}」不存在`,
            data: row
          });
          return;
        }
        
        if (equipmentItem.stock < 1) {
          results.partial.push({
            row: index + 2,
            message: `装备套装「${equipmentName}」库存不足，已跳过`,
            data: row
          });
          return;
        }
        
        const rentalStart = startDate || new Date().toISOString().split('T')[0];
        const rentalEnd = endDate || (() => {
          const date = new Date();
          date.setDate(date.getDate() + (rentalDays || 1));
          return date.toISOString().split('T')[0];
        })();
        
        const actualRentalDays = rentalDays || calculateDays(rentalStart, rentalEnd) || 1;
        const totalRentalFee = equipmentItem.totalRentalFee * actualRentalDays;
        const requiredDeposit = equipmentItem.totalDeposit;
        const deposit = parseFloat(actualDeposit) || 0;
        const depositStatus = deposit >= requiredDeposit ? '足额' : '不足';
        const depositShortage = Math.max(0, requiredDeposit - deposit);
        
        const orderItems = equipmentItem.items.map(item => ({
          ...item,
          status: '未归还',
          returnedQuantity: 0
        }));
        
        const newOrder = {
          id: generateId(),
          orderNumber: generateOrderNumber(),
          customerName,
          phone,
          equipmentId: equipmentItem.id,
          equipmentName: equipmentItem.name,
          items: orderItems,
          rentalDays: actualRentalDays,
          rentalStart,
          rentalEnd,
          dueDate: rentalEnd,
          totalRentalFee,
          requiredDeposit,
          actualDeposit: deposit,
          depositStatus,
          depositShortage,
          status: deposit > 0 ? STATUS.BORROWED : STATUS.PENDING,
          fees: [],
          totalFees: 0,
          refundAmount: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        
        if (depositStatus === '不足') {
          newOrder.fees.push({
            id: generateId(),
            type: FEE_TYPES.DEPOSIT_SHORTAGE,
            amount: depositShortage,
            reason: `押金不足，需补交 ${depositShortage} 元`,
            createdAt: new Date().toISOString()
          });
        }
        
        if (deposit > 0) {
          equipmentItem.stock -= 1;
        }
        
        orders.push(newOrder);
        
        results.success.push({
          row: index + 2,
          orderNumber: newOrder.orderNumber,
          message: '导入成功'
        });
      } catch (error) {
        results.failed.push({
          row: index + 2,
          message: `导入失败：${error.message}`,
          data: row
        });
      }
    });
    
    writeData(EQUIPMENT_FILE, equipment);
    writeData(ORDERS_FILE, orders);
    
    const total = data.length;
    const successCount = results.success.length;
    const partialCount = results.partial.length;
    const failedCount = results.failed.length;
    
    let message = `共 ${total} 条数据：成功 ${successCount} 条`;
    if (partialCount > 0) message += `，部分成功 ${partialCount} 条`;
    if (failedCount > 0) message += `，失败 ${failedCount} 条`;
    
    res.json({
      success: true,
      message,
      total,
      successCount,
      partialCount,
      failedCount,
      results
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '导入失败',
      error: error.message
    });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const orders = readData(ORDERS_FILE);
    const equipment = readData(EQUIPMENT_FILE);
    
    const orderIndex = orders.findIndex(o => o.id === id || o.orderNumber === id);
    
    if (orderIndex === -1) {
      return res.status(404).json({
        success: false,
        message: '订单不存在'
      });
    }
    
    const order = orders[orderIndex];
    
    if (order.status === STATUS.BORROWED || order.status === STATUS.OVERDUE) {
      return res.status(400).json({
        success: false,
        message: '只能删除待支付或已完成的订单'
      });
    }
    
    if (order.status === STATUS.BORROWED || order.status === STATUS.OVERDUE) {
      const equipmentItem = equipment.find(e => e.id === order.equipmentId);
      if (equipmentItem) {
        equipmentItem.stock += 1;
        writeData(EQUIPMENT_FILE, equipment);
      }
    }
    
    orders.splice(orderIndex, 1);
    writeData(ORDERS_FILE, orders);
    
    res.json({
      success: true,
      message: '订单删除成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '删除订单失败',
      error: error.message
    });
  }
});

module.exports = router;
