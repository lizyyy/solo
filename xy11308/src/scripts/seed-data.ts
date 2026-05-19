import 'reflect-metadata';
import { AppDataSource } from '../database/data-source';
import { Elder, ChronicDisease } from '../entities/Elder';
import { Meal, MealType } from '../entities/Meal';
import { AssignmentStatus } from '../entities/MealAssignment';
import { DeliveryStatus } from '../entities/Delivery';
import { SatisfactionLevel } from '../entities/FollowUp';
import { CanteenService } from '../services/canteen-service';
import { AuditContext } from '../services/audit-service';
import { ChangeReason } from '../entities/MealChange';

const adminContext: AuditContext = {
  operator: '系统管理员',
  operatorRole: 'admin'
};

async function seedData() {
  console.log('开始初始化测试数据...');

  const elders = [
    {
      name: '张大爷',
      phone: '13800138001',
      address: '幸福小区1号楼',
      roomNumber: '101',
      allergies: ['海鲜', '花生'],
      chronicDiseases: [ChronicDisease.DIABETES, ChronicDisease.HYPERTENSION],
      dietaryRestrictions: ['辛辣'],
      notes: '血糖偏高，需要严格控糖'
    },
    {
      name: '李奶奶',
      phone: '13800138002',
      address: '幸福小区1号楼',
      roomNumber: '202',
      allergies: [],
      chronicDiseases: [ChronicDisease.HEART_DISEASE],
      dietaryRestrictions: ['油腻'],
      notes: '心脏病，饮食清淡'
    },
    {
      name: '王爷爷',
      phone: '13800138003',
      address: '幸福小区2号楼',
      roomNumber: '303',
      allergies: ['芒果'],
      chronicDiseases: [ChronicDisease.GOUT],
      dietaryRestrictions: ['高嘌呤'],
      notes: '痛风患者'
    },
    {
      name: '赵奶奶',
      phone: '13800138004',
      address: '幸福小区2号楼',
      roomNumber: '404',
      allergies: [],
      chronicDiseases: [],
      dietaryRestrictions: [],
      notes: '身体健康，无特殊要求'
    },
    {
      name: '刘大爷',
      phone: '13800138005',
      address: '幸福小区3号楼',
      roomNumber: '505',
      allergies: ['牛奶', '鸡蛋'],
      chronicDiseases: [ChronicDisease.DIABETES, ChronicDisease.KIDNEY_DISEASE],
      dietaryRestrictions: ['高蛋白'],
      notes: '糖尿病合并肾病，需要特殊配餐'
    }
  ];

  const meals = [
    {
      name: '清淡素菜套餐',
      date: new Date(),
      type: MealType.LUNCH,
      ingredients: ['青菜', '豆腐', '米饭'],
      allergens: [],
      isDiabetesFriendly: true,
      isLowSalt: true,
      isLowSugar: true,
      isLowPurine: true,
      description: '适合糖尿病人和高血压患者'
    },
    {
      name: '海鲜套餐',
      date: new Date(),
      type: MealType.LUNCH,
      ingredients: ['虾', '鱼', '米饭', '花生'],
      allergens: ['海鲜', '花生'],
      isDiabetesFriendly: false,
      isLowSalt: false,
      isLowSugar: false,
      isLowPurine: false,
      description: '普通套餐，含海鲜和花生'
    },
    {
      name: '营养早餐A',
      date: new Date(),
      type: MealType.BREAKFAST,
      ingredients: ['鸡蛋', '牛奶', '面包'],
      allergens: ['鸡蛋', '牛奶'],
      isDiabetesFriendly: false,
      isLowSalt: true,
      isLowSugar: false,
      isLowPurine: true,
      description: '含蛋奶的早餐'
    },
    {
      name: '糖尿病友好午餐',
      date: new Date(),
      type: MealType.LUNCH,
      ingredients: ['杂粮饭', '鸡胸肉', '蔬菜'],
      allergens: [],
      isDiabetesFriendly: true,
      isLowSalt: true,
      isLowSugar: true,
      isLowPurine: true,
      description: '专门为糖尿病人设计的午餐'
    },
    {
      name: '痛风友好晚餐',
      date: new Date(),
      type: MealType.DINNER,
      ingredients: ['蔬菜', '鸡蛋', '面条'],
      allergens: ['鸡蛋'],
      isDiabetesFriendly: true,
      isLowSalt: true,
      isLowSugar: true,
      isLowPurine: true,
      description: '低嘌呤，适合痛风患者'
    }
  ];

  const elderRepository = AppDataSource.getRepository(Elder);
  const mealRepository = AppDataSource.getRepository(Meal);

  const savedElders = await elderRepository.save(
    elders.map(e => elderRepository.create({
      ...e,
      createdBy: adminContext.operator,
      createdByRole: adminContext.operatorRole
    }))
  );
  console.log(`已创建 ${savedElders.length} 位老人`);

  const savedMeals = await mealRepository.save(
    meals.map(m => mealRepository.create({
      ...m,
      createdBy: adminContext.operator,
      createdByRole: adminContext.operatorRole
    }))
  );
  console.log(`已创建 ${savedMeals.length} 份餐食`);

  console.log('');
  console.log('=== 测试配餐规则 ===');

  const testCases = [
    { elderName: '张大爷', mealName: '清淡素菜套餐', expected: '通过' },
    { elderName: '张大爷', mealName: '海鲜套餐', expected: '拦截（糖尿病禁忌+过敏源）' },
    { elderName: '刘大爷', mealName: '营养早餐A', expected: '拦截（牛奶鸡蛋过敏+糖尿病）' },
    { elderName: '刘大爷', mealName: '糖尿病友好午餐', expected: '通过' },
    { elderName: '王爷爷', mealName: '痛风友好晚餐', expected: '通过' },
    { elderName: '王爷爷', mealName: '海鲜套餐', expected: '警告（高嘌呤不适合痛风）' }
  ];

  for (const testCase of testCases) {
    const elder = savedElders.find(e => e.name === testCase.elderName);
    const meal = savedMeals.find(m => m.name === testCase.mealName);
    
    if (elder && meal) {
      const result = await CanteenService.checkMealConflict(elder.id, meal.id);
      const status = result.overallPassed ? '✅ 通过' : '❌ 拦截';
      const reasons = result.hasBlocks ? result.blockReasons.join('; ') : (result.hasWarnings ? result.warningReasons.join('; ') : '无冲突');
      console.log(`${status} ${testCase.elderName} + ${testCase.mealName}: ${reasons}`);
    }
  }

  console.log('');
  console.log('=== 创建实际配餐记录 ===');
  
  const assignments = [];
  const validPairs = [
    { elderName: '张大爷', mealName: '清淡素菜套餐' },
    { elderName: '李奶奶', mealName: '清淡素菜套餐' },
    { elderName: '王爷爷', mealName: '痛风友好晚餐' },
    { elderName: '赵奶奶', mealName: '海鲜套餐' },
    { elderName: '刘大爷', mealName: '糖尿病友好午餐' }
  ];

  for (const pair of validPairs) {
    const elder = savedElders.find(e => e.name === pair.elderName);
    const meal = savedMeals.find(m => m.name === pair.mealName);
    if (elder && meal) {
      const assignment = await CanteenService.assignMeal(
        { elderId: elder.id, mealId: meal.id, notes: '测试配餐' },
        adminContext
      );
      assignments.push(assignment);
      console.log(`✅ ${pair.elderName} 配餐成功: ${pair.mealName}`);
    }
  }

  console.log('');
  console.log('=== 测试改餐功能 ===');
  
  const zhaoElder = savedElders.find(e => e.name === '赵奶奶');
  const zhaoAssignment = assignments.find(a => a.elderId === zhaoElder?.id);
  const newMeal = savedMeals.find(m => m.name === '糖尿病友好午餐');
  
  if (zhaoAssignment && newMeal) {
    const change = await CanteenService.changeMeal(
      {
        assignmentId: zhaoAssignment.id,
        newMealId: newMeal.id,
        reason: ChangeReason.DIETARY_REQUEST,
        reasonDetails: '赵奶奶希望尝试更健康的餐食'
      },
      adminContext
    );
    console.log(`✅ 改餐成功: 赵奶奶的餐食已变更为 ${newMeal.name}`);
  }

  console.log('');
  console.log('=== 测试配送功能 ===');
  
  const deliveryAssignment = assignments[0];
  if (deliveryAssignment) {
    const delivery = await CanteenService.updateDelivery(
      {
        assignmentId: deliveryAssignment.id,
        status: DeliveryStatus.DELIVERED,
        deliveryPerson: '配送员小王',
        actualDeliveryTime: new Date(),
        recipientName: '张大爷本人',
        notes: '配送顺利'
      },
      adminContext
    );
    console.log(`✅ 配送记录已更新，状态: ${delivery.status}`);
  }

  console.log('');
  console.log('=== 测试回访功能 ===');
  
  if (deliveryAssignment) {
    const followUp = await CanteenService.createFollowUp(
      {
        assignmentId: deliveryAssignment.id,
        satisfaction: SatisfactionLevel.SATISFIED,
        mealQualityOk: true,
        temperatureOk: true,
        deliveryTimeOk: true,
        complaints: [],
        suggestions: [],
        notes: '张大爷对今天的餐食很满意'
      },
      adminContext
    );
    console.log(`✅ 回访记录已创建，满意度: ${followUp.satisfaction}`);
  }

  console.log('');
  console.log('=== 测试批量配餐 ===');
  
  const batchItems = savedElders.slice(0, 3).map(elder => ({
    elderId: elder.id,
    mealId: savedMeals[3].id,
    notes: '批量配餐'
  }));

  console.log(`准备批量配餐 ${batchItems.length} 份`);

  console.log('');
  console.log('🎉 测试数据初始化完成！');
  console.log('');
  console.log('=== 可用测试账号 ===');
  console.log('操作人: 系统管理员, 角色: admin');
  console.log('操作人: 张三, 角色: staff');
  console.log('操作人: 李四, 角色: manager');
}

AppDataSource.initialize()
  .then(() => seedData())
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('初始化失败:', error);
    process.exit(1);
  });