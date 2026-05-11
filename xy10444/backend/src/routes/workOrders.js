const express = require('express');
const router = express.Router();
const WorkOrder = require('../models/WorkOrder');
const Material = require('../models/Material');
const Settlement = require('../models/Settlement');

router.get('/', async (req, res) => {
  try {
    const { status, repairCategory, search } = req.query;
    const query = {};
    
    if (status && status !== '全部') {
      query.status = status;
    }
    
    if (repairCategory && repairCategory !== '全部') {
      query.repairCategory = repairCategory;
    }
    
    if (search) {
      query.$or = [
        { orderNumber: { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } },
        { technician: { $regex: search, $options: 'i' } }
      ];
    }
    
    const workOrders = await WorkOrder.find(query).sort({ createdAt: -1 });
    res.json({ success: true, data: workOrders });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const workOrder = new WorkOrder(req.body);
    const savedWorkOrder = await workOrder.save();
    res.status(201).json({ success: true, data: savedWorkOrder });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const workOrder = await WorkOrder.findById(req.params.id);
    if (!workOrder) {
      return res.status(404).json({ success: false, message: '工单不存在' });
    }
    
    const materialsWithBalance = workOrder.materials.map(m => ({
      ...m.toObject(),
      balance: m.quantityTaken - m.quantityUsed - m.quantityReturned
    }));
    
    const totalAmount = workOrder.materials.reduce((sum, m) => {
      return sum + (m.quantityUsed * m.unitPrice);
    }, 0);
    
    const settlement = await Settlement.findOne({ workOrderId: workOrder._id });
    
    res.json({
      success: true,
      data: {
        ...workOrder.toObject(),
        materials: materialsWithBalance,
        totalAmount,
        hasSettlement: !!settlement
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const workOrder = await WorkOrder.findById(req.params.id);
    if (!workOrder) {
      return res.status(404).json({ success: false, message: '工单不存在' });
    }
    
    Object.assign(workOrder, req.body);
    const savedWorkOrder = await workOrder.save();
    res.json({ success: true, data: savedWorkOrder });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.post('/:id/take-materials', async (req, res) => {
  const session = await WorkOrder.startSession();
  session.startTransaction();
  
  try {
    const { materials } = req.body;
    const workOrder = await WorkOrder.findById(req.params.id).session(session);
    
    if (!workOrder) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: '工单不存在' });
    }
    
    for (const item of materials) {
      const material = await Material.findById(item.materialId).session(session);
      if (!material) {
        await session.abortTransaction();
        return res.status(400).json({ success: false, message: `材料 ${item.materialId} 不存在` });
      }
      
      if (material.stock < item.quantityTaken) {
        await session.abortTransaction();
        return res.status(400).json({ 
          success: false, 
          message: `材料 ${material.name} 库存不足，当前库存: ${material.stock}，需要: ${item.quantityTaken}` 
        });
      }
      
      material.stock -= item.quantityTaken;
      await material.save({ session });
      
      const existingMaterial = workOrder.materials.find(
        m => m.materialId.toString() === item.materialId
      );
      
      if (existingMaterial) {
        existingMaterial.quantityTaken += item.quantityTaken;
      } else {
        workOrder.materials.push({
          materialId: item.materialId,
          materialName: material.name,
          unit: material.unit,
          unitPrice: material.unitPrice,
          quantityTaken: item.quantityTaken
        });
      }
    }
    
    workOrder.status = '处理中';
    await workOrder.save({ session });
    
    await session.commitTransaction();
    res.json({ success: true, data: workOrder });
  } catch (error) {
    await session.abortTransaction();
    res.status(400).json({ success: false, message: error.message });
  } finally {
    session.endSession();
  }
});

router.post('/:id/consume-materials', async (req, res) => {
  try {
    const { materials } = req.body;
    const workOrder = await WorkOrder.findById(req.params.id);
    
    if (!workOrder) {
      return res.status(404).json({ success: false, message: '工单不存在' });
    }
    
    for (const item of materials) {
      const existingMaterial = workOrder.materials.find(
        m => m.materialId.toString() === item.materialId
      );
      
      if (!existingMaterial) {
        return res.status(400).json({ 
          success: false, 
          message: `未找到领用的材料 ${item.materialId}` 
        });
      }
      
      const available = existingMaterial.quantityTaken - existingMaterial.quantityUsed - existingMaterial.quantityReturned;
      if (item.quantityUsed > available) {
        return res.status(400).json({ 
          success: false, 
          message: `材料 ${existingMaterial.materialName} 可用数量不足，可用: ${available}，尝试消耗: ${item.quantityUsed}` 
        });
      }
      
      if (item.quantityUsed < 0) {
        return res.status(400).json({ 
          success: false, 
          message: `材料 ${existingMaterial.materialName} 消耗数量不能为负数` 
        });
      }
      
      existingMaterial.quantityUsed = item.quantityUsed;
    }
    
    await workOrder.save();
    res.json({ success: true, data: workOrder });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.post('/:id/return-materials', async (req, res) => {
  const session = await WorkOrder.startSession();
  session.startTransaction();
  
  try {
    const { materials } = req.body;
    const workOrder = await WorkOrder.findById(req.params.id).session(session);
    
    if (!workOrder) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: '工单不存在' });
    }
    
    for (const item of materials) {
      const existingMaterial = workOrder.materials.find(
        m => m.materialId.toString() === item.materialId
      );
      
      if (!existingMaterial) {
        await session.abortTransaction();
        return res.status(400).json({ 
          success: false, 
          message: `未找到领用的材料 ${item.materialId}` 
        });
      }
      
      const maxReturnable = existingMaterial.quantityTaken - existingMaterial.quantityUsed - existingMaterial.quantityReturned;
      
      if (item.quantityReturned > maxReturnable) {
        await session.abortTransaction();
        return res.status(400).json({ 
          success: false, 
          message: `材料 ${existingMaterial.materialName} 退回数量超过剩余量，最多可退: ${maxReturnable}，尝试退回: ${item.quantityReturned}` 
        });
      }
      
      if (item.quantityReturned < 0) {
        await session.abortTransaction();
        return res.status(400).json({ 
          success: false, 
          message: `材料 ${existingMaterial.materialName} 退回数量不能为负数` 
        });
      }
      
      existingMaterial.quantityReturned += item.quantityReturned;
      
      const material = await Material.findById(item.materialId).session(session);
      if (material) {
        material.stock += item.quantityReturned;
        await material.save({ session });
      }
    }
    
    await workOrder.save({ session });
    await session.commitTransaction();
    res.json({ success: true, data: workOrder });
  } catch (error) {
    await session.abortTransaction();
    res.status(400).json({ success: false, message: error.message });
  } finally {
    session.endSession();
  }
});

router.post('/:id/confirm', async (req, res) => {
  try {
    const { confirmedBy } = req.body;
    const workOrder = await WorkOrder.findById(req.params.id);
    
    if (!workOrder) {
      return res.status(404).json({ success: false, message: '工单不存在' });
    }
    
    if (workOrder.ownerConfirmed) {
      return res.status(400).json({ success: false, message: '工单已确认，无需重复确认' });
    }
    
    workOrder.ownerConfirmed = true;
    workOrder.confirmedBy = confirmedBy || '业主';
    workOrder.confirmedAt = new Date();
    workOrder.status = '待确认';
    
    await workOrder.save();
    res.json({ success: true, data: workOrder, message: '业主确认成功' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.post('/:id/settle', async (req, res) => {
  try {
    const workOrder = await WorkOrder.findById(req.params.id);
    
    if (!workOrder) {
      return res.status(404).json({ success: false, message: '工单不存在' });
    }
    
    if (!workOrder.ownerConfirmed) {
      return res.status(400).json({ success: false, message: '业主确认前不能结算' });
    }
    
    if (workOrder.settled) {
      return res.status(400).json({ success: false, message: '工单已结算，重复核销不增加费用' });
    }
    
    const materialsToSettle = workOrder.materials.filter(m => m.quantityUsed > 0);
    
    if (materialsToSettle.length === 0) {
      workOrder.settled = true;
      workOrder.settledAt = new Date();
      workOrder.status = '已完成';
      workOrder.settlementType = '无需结算';
      await workOrder.save();
      return res.json({ 
        success: true, 
        data: workOrder, 
        message: '无消耗材料，直接完成',
        settlement: null
      });
    }
    
    const settlementType = workOrder.repairCategory === '公共区域' 
      ? '公共维修基金' 
      : '业主付费';
    
    const items = materialsToSettle.map(m => ({
      materialId: m.materialId,
      materialName: m.materialName,
      unit: m.unit,
      unitPrice: m.unitPrice,
      quantityUsed: m.quantityUsed,
      amount: m.quantityUsed * m.unitPrice
    }));
    
    const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);
    
    const settlement = new Settlement({
      workOrderId: workOrder._id,
      workOrderNumber: workOrder.orderNumber,
      repairCategory: workOrder.repairCategory,
      repairType: workOrder.repairType,
      location: workOrder.location,
      technician: workOrder.technician,
      houseNumber: workOrder.houseNumber,
      settlementType,
      items,
      totalAmount
    });
    
    await settlement.save();
    
    workOrder.settled = true;
    workOrder.settledAt = new Date();
    workOrder.status = '已完成';
    workOrder.settlementType = settlementType;
    await workOrder.save();
    
    res.json({ 
      success: true, 
      data: workOrder, 
      settlement,
      message: '结算成功'
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.get('/:id/settlement', async (req, res) => {
  try {
    const settlement = await Settlement.findOne({ workOrderId: req.params.id });
    res.json({ success: true, data: settlement });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
