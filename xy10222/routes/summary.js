const express = require('express');
const router = express.Router();
const petService = require('../services/petService');
const medicationPlanService = require('../services/medicationPlanService');
const executionReceiptService = require('../services/executionReceiptService');

router.get('/today', (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const pets = petService.getAllPets();
    const summary = [];

    pets.forEach(pet => {
      const plans = medicationPlanService.getMedicationPlansByPetId(pet.id);
      const activePlans = plans.filter(p => p.status === 'active');
      const receipts = executionReceiptService.getExecutionReceiptsByPetId(pet.id);
      const todayReceipts = receipts.filter(r => r.executionTime.startsWith(today));

      const petSummary = {
        petId: pet.id,
        petName: pet.name,
        petSpecies: pet.species,
        petBreed: pet.breed,
        activePlansCount: activePlans.length,
        todayExecutions: todayReceipts.length,
        plans: activePlans.map(plan => {
          const planReceipts = receipts.filter(r => r.planId === plan.id);
          const todayPlanReceipts = planReceipts.filter(r => r.executionTime.startsWith(today));
          
          return {
            planId: plan.id,
            medicationName: plan.medicationName,
            dosage: plan.dosage,
            frequency: plan.frequency,
            fastingInstructions: plan.fastingInstructions,
            todayExecutions: todayPlanReceipts.length,
            totalExecutions: planReceipts.length,
            progressCount: plan.progress.length,
            hasCorrections: !!plan.corrections && plan.corrections.length > 0
          };
        })
      };

      summary.push(petSummary);
    });

    res.json({
      date: today,
      totalPets: pets.length,
      totalActivePlans: summary.reduce((sum, p) => sum + p.activePlansCount, 0),
      totalTodayExecutions: summary.reduce((sum, p) => sum + p.todayExecutions, 0),
      summary
    });
  } catch (error) {
    res.status(400).json({
      error: '获取今日汇总失败',
      message: error.message
    });
  }
});

router.get('/pet/:petId', (req, res) => {
  try {
    const pet = petService.getPetById(req.params.petId);
    if (!pet) {
      return res.status(404).json({
        error: '未找到宠物',
        message: `找不到 ID 为 "${req.params.petId}" 的宠物`
      });
    }

    const plans = medicationPlanService.getMedicationPlansByPetId(pet.id);
    const receipts = executionReceiptService.getExecutionReceiptsByPetId(pet.id);

    const plansWithDetails = plans.map(plan => {
      const planReceipts = receipts.filter(r => r.planId === plan.id);
      const varianceCount = planReceipts.filter(r => r.dosageVariance).length;
      const correctionCount = (plan.corrections || []).length;

      return {
        ...plan,
        executionCount: planReceipts.length,
        varianceCount,
        correctionCount,
        latestExecution: planReceipts.length > 0 ? 
          planReceipts.sort((a, b) => new Date(b.executionTime) - new Date(a.executionTime))[0] : null
      };
    });

    res.json({
      pet,
      totalPlans: plans.length,
      activePlans: plans.filter(p => p.status === 'active').length,
      withdrawnPlans: plans.filter(p => p.status === 'withdrawn').length,
      totalExecutions: receipts.length,
      plans: plansWithDetails,
      receipts: receipts.sort((a, b) => new Date(b.executionTime) - new Date(a.executionTime))
    });
  } catch (error) {
    res.status(400).json({
      error: '获取宠物汇总失败',
      message: error.message
    });
  }
});

router.get('/dashboard', (req, res) => {
  try {
    const pets = petService.getAllPets();
    const allPlans = [];
    const allReceipts = [];

    pets.forEach(pet => {
      const plans = medicationPlanService.getMedicationPlansByPetId(pet.id);
      const receipts = executionReceiptService.getExecutionReceiptsByPetId(pet.id);
      allPlans.push(...plans);
      allReceipts.push(...receipts);
    });

    const activePlans = allPlans.filter(p => p.status === 'active');
    const withdrawnPlans = allPlans.filter(p => p.status === 'withdrawn');
    const plansWithCorrections = allPlans.filter(p => p.corrections && p.corrections.length > 0);
    const receiptsWithVariance = allReceipts.filter(r => r.dosageVariance);

    const today = new Date().toISOString().split('T')[0];
    const todayReceipts = allReceipts.filter(r => r.executionTime.startsWith(today));

    res.json({
      overview: {
        totalPets: pets.length,
        totalPlans: allPlans.length,
        activePlans: activePlans.length,
        withdrawnPlans: withdrawnPlans.length,
        totalExecutions: allReceipts.length,
        todayExecutions: todayReceipts.length,
        plansWithCorrections: plansWithCorrections.length,
        executionsWithVariance: receiptsWithVariance.length
      },
      alerts: {
        doseVariances: receiptsWithVariance.map(r => ({
          petId: r.petId,
          planId: r.planId,
          receiptId: r.id,
          planned: r.dosageVariance.planned,
          actual: r.dosageVariance.actual,
          variance: r.dosageVariance.variance,
          executionTime: r.executionTime
        })),
        corrections: plansWithCorrections.map(p => ({
          petId: p.petId,
          planId: p.id,
          correctionCount: p.corrections.length,
          latestCorrection: p.corrections[p.corrections.length - 1]
        }))
      }
    });
  } catch (error) {
    res.status(400).json({
      error: '获取仪表盘数据失败',
      message: error.message
    });
  }
});

module.exports = router;
