const express = require('express');
const router = express.Router();
const Prescription = require('../models/Prescription');
const Pet = require('../models/Pet');
const Medicine = require('../models/Medicine');
const Inventory = require('../models/Inventory');
const AuditLog = require('../models/AuditLog');
const { validatePrescriptionItem, checkContraindications, processBatch } = require('../utils/validation');

router.post('/', async (req, res) => {
  try {
    const { petId, doctor, diagnosis, items } = req.body;
    
    const pet = await Pet.findById(petId);
    if (!pet) {
      return res.status(404).json({
        success: false,
        message: '宠物不存在',
        reason: '未找到对应的宠物信息'
      });
    }
    
    const medicineIds = items.map(item => item.medicineId);
    const medicines = await Medicine.findByIds(medicineIds);
    
    if (medicines.length !== medicineIds.length) {
      const foundIds = medicines.map(m => m.id);
      const missingIds = medicineIds.filter(id => !foundIds.includes(id));
      return res.status(400).json({
        success: false,
        message: '部分药品不存在',
        reason: `药品ID ${missingIds.join(', ')} 不存在`
      });
    }
    
    const contraResult = checkContraindications(medicines);
    if (!contraResult.passed) {
      return res.status(400).json({
        success: false,
        message: '存在禁忌药品组合',
        reason: contraResult.reason,
        data: contraResult.data
      });
    }
    
    const validatedItems = [];
    const errors = [];
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const medicine = medicines.find(m => m.id === item.medicineId);
      const inventory = await Inventory.findById(item.inventoryId);
      
      if (!inventory) {
        errors.push(`第 ${i + 1} 项药品库存不存在`);
        continue;
      }
      
      const validation = await validatePrescriptionItem(item, medicine, inventory, pet.weight);
      
      if (!validation.passed) {
        errors.push(`第 ${i + 1} 项药品: ${validation.reasons}`);
        continue;
      }
      
      validatedItems.push({
        ...item,
        totalDosage: validation.totalDosage,
        checkReason: validation.reasons
      });
    }
    
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: '处方校验失败',
        reason: errors.join('; '),
        data: { errors }
      });
    }
    
    const prescription = await Prescription.create(
      { petId, doctor, diagnosis, status: 'pending' },
      validatedItems
    );
    
    await AuditLog.create({
      type: 'prescription',
      targetId: prescription.id,
      action: 'create',
      operator: doctor,
      reason: '处方创建成功，校验通过',
      newValue: prescription
    });
    
    res.json({
      success: true,
      message: '处方创建成功，校验通过',
      data: prescription,
      reason: `禁忌检查: ${contraResult.reason}; 共 ${validatedItems.length} 项药品校验通过`
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: '处方创建失败',
      error: error.message,
      reason: error.message
    });
  }
});

router.post('/batch', async (req, res) => {
  try {
    const { prescriptions } = req.body;
    
    const results = [];
    let successCount = 0;
    let failCount = 0;
    
    for (let i = 0; i < prescriptions.length; i++) {
      try {
        const presc = prescriptions[i];
        const pet = await Pet.findById(presc.petId);
        
        if (!pet) {
          results.push({
            index: i,
            success: false,
            reason: '宠物不存在'
          });
          failCount++;
          continue;
        }
        
        const medicineIds = presc.items.map(item => item.medicineId);
        const medicines = await Medicine.findByIds(medicineIds);
        
        if (medicines.length !== medicineIds.length) {
          results.push({
            index: i,
            success: false,
            reason: '部分药品不存在'
          });
          failCount++;
          continue;
        }
        
        const contraResult = checkContraindications(medicines);
        if (!contraResult.passed) {
          results.push({
            index: i,
            success: false,
            reason: contraResult.reason
          });
          failCount++;
          continue;
        }
        
        const validatedItems = [];
        let hasError = false;
        
        for (const item of presc.items) {
          const medicine = medicines.find(m => m.id === item.medicineId);
          const inventory = await Inventory.findById(item.inventoryId);
          
          if (!inventory) {
            hasError = true;
            break;
          }
          
          const validation = await validatePrescriptionItem(item, medicine, inventory, pet.weight);
          
          if (!validation.passed) {
            hasError = true;
            break;
          }
          
          validatedItems.push({
            ...item,
            totalDosage: validation.totalDosage,
            checkReason: validation.reasons
          });
        }
        
        if (hasError) {
          results.push({
            index: i,
            success: false,
            reason: '处方项校验失败'
          });
          failCount++;
          continue;
        }
        
        const prescription = await Prescription.create(
          { petId: presc.petId, doctor: presc.doctor, diagnosis: presc.diagnosis },
          validatedItems
        );
        
        results.push({
          index: i,
          success: true,
          id: prescription.id,
          reason: '创建成功'
        });
        successCount++;
      } catch (error) {
        results.push({
          index: i,
          success: false,
          error: error.message,
          reason: `处理异常: ${error.message}`
        });
        failCount++;
      }
    }
    
    res.json({
      success: failCount === 0,
      message: failCount === 0 ? '批量创建成功' : `批量创建完成，成功 ${successCount} 条，失败 ${failCount} 条`,
      data: {
        successCount,
        failCount,
        results
      }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: '批量操作失败',
      error: error.message
    });
  }
});

router.get('/', async (req, res) => {
  try {
    const prescriptions = await Prescription.findAll();
    res.json({
      success: true,
      message: '获取处方列表成功',
      data: prescriptions
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: '获取处方列表失败',
      error: error.message
    });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const prescription = await Prescription.findById(req.params.id);
    if (!prescription) {
      return res.status(404).json({
        success: false,
        message: '处方不存在',
        reason: '未找到该处方'
      });
    }
    res.json({
      success: true,
      message: '获取处方成功',
      data: prescription
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: '获取处方失败',
      error: error.message
    });
  }
});

router.post('/:id/review', async (req, res) => {
  try {
    const { reviewer, action, comments } = req.body;
    const prescription = await Prescription.findById(req.params.id);
    
    if (!prescription) {
      return res.status(404).json({
        success: false,
        message: '处方不存在',
        reason: '未找到该处方'
      });
    }
    
    const oldStatus = prescription.status;
    const result = await Prescription.review(req.params.id, reviewer, action, comments);
    
    await AuditLog.create({
      type: 'prescription',
      targetId: parseInt(req.params.id),
      action: action === 'approve' ? 'approve' : 'reject',
      operator: reviewer,
      reason: comments,
      oldValue: { status: oldStatus },
      newValue: { status: action === 'approve' ? 'approved' : 'rejected' }
    });
    
    res.json({
      success: true,
      message: action === 'approve' ? '处方审核通过' : '处方已驳回',
      data: result,
      reason: comments
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: '审核操作失败',
      error: error.message,
      reason: error.message
    });
  }
});

module.exports = router;
