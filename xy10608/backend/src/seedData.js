
const { generateId, getCurrentTime } = require('./utils');

// 样例数据：操作员
const operators = ['张三', '李四', '王五', '赵六', '钱七'];

// 样例数据：过敏原类型
const allergenTypes = ['小麦', '花生', '牛奶', '鸡蛋', '海鲜', '坚果'];

// 样例数据：门店
const stores = [
  { id: 'store001', name: '上海静安店' },
  { id: 'store002', name: '北京朝阳店' },
  { id: 'store003', name: '深圳南山店' }
];

// 样例数据：菜单配方
const menuRecipes = [
  {
    menu_name: '招牌红烧肉',
    menu_code: 'HM001',
    category: '热菜',
    description: '经典红烧肉，肥而不腻',
    items: [
      { ingredient_code: 'PORK001', ingredient_name: '五花肉', quantity: 500, unit: 'g', is_optional: 0 },
      { ingredient_code: 'SOY001', ingredient_name: '酱油', quantity: 30, unit: 'ml', is_optional: 0 },
      { ingredient_code: 'SUG001', ingredient_name: '冰糖', quantity: 20, unit: 'g', is_optional: 0 }
    ]
  },
  {
    menu_name: '清炒时蔬',
    menu_code: 'HS002',
    category: '热菜',
    description: '新鲜时令蔬菜炒制',
    items: [
      { ingredient_code: 'VEG001', ingredient_name: '青菜', quantity: 300, unit: 'g', is_optional: 0 },
      { ingredient_code: 'OIL001', ingredient_name: '食用油', quantity: 15, unit: 'ml', is_optional: 0 },
      { ingredient_code: 'GAR001', ingredient_name: '大蒜', quantity: 10, unit: 'g', is_optional: 1 }
    ]
  },
  {
    menu_name: '宫保鸡丁',
    menu_code: 'CH003',
    category: '热菜',
    description: '经典川菜，鸡肉丁配花生米',
    items: [
      { ingredient_code: 'CHK001', ingredient_name: '鸡胸肉', quantity: 400, unit: 'g', is_optional: 0 },
      { ingredient_code: 'PEA001', ingredient_name: '花生米', quantity: 50, unit: 'g', is_optional: 0 },
      { ingredient_code: 'PEP001', ingredient_name: '干辣椒', quantity: 10, unit: 'g', is_optional: 0 }
    ]
  }
];

// 样例数据：食材批次
const ingredientBatches = [
  {
    ingredient_code: 'PORK001',
    ingredient_name: '五花肉',
    batch_number: 'B20240501001',
    supplier: '中粮集团',
    production_date: '2024-05-01',
    expiry_date: '2024-05-08',
    quantity: 1000,
    unit: 'kg',
    allergens: ''
  },
  {
    ingredient_code: 'PEA001',
    ingredient_name: '花生米',
    batch_number: 'B20240501002',
    supplier: '山东花生公司',
    production_date: '2024-05-01',
    expiry_date: '2024-12-31',
    quantity: 500,
    unit: 'kg',
    allergens: '花生',
    status: 'allergic'
  },
  {
    ingredient_code: 'VEG001',
    ingredient_name: '青菜',
    batch_number: 'B20240502001',
    supplier: '本地蔬菜基地',
    production_date: '2024-05-02',
    expiry_date: '2024-05-05',
    quantity: 300,
    unit: 'kg',
    allergens: '',
    status: 'expiring'
  },
  {
    ingredient_code: 'CHK001',
    ingredient_name: '鸡胸肉',
    batch_number: 'B20240502002',
    supplier: '正大集团',
    production_date: '2024-05-02',
    expiry_date: '2024-05-15',
    quantity: 800,
    unit: 'kg',
    allergens: ''
  }
];

// 样例数据：替代料确认
const substitutionConfirmations = [
  {
    original_ingredient_code: 'PORK001',
    original_ingredient_name: '五花肉',
    substitute_ingredient_code: 'PORK002',
    substitute_ingredient_name: '瘦猪肉',
    reason: '五花肉库存不足，临时用瘦猪肉替代',
    status: 'approved',
    approved_by: '王五',
    approved_at: getCurrentTime()
  },
  {
    original_ingredient_code: 'PEA001',
    original_ingredient_name: '花生米',
    substitute_ingredient_code: 'CAS001',
    substitute_ingredient_name: '腰果',
    reason: '存在花生过敏原风险，使用腰果替代',
    status: 'pending'
  },
  {
    original_ingredient_code: 'VEG001',
    original_ingredient_name: '青菜',
    substitute_ingredient_code: 'VEG002',
    substitute_ingredient_name: '油麦菜',
    reason: '青菜批次即将过期，使用油麦菜替代',
    status: 'rejected',
    approved_by: '赵六',
    approved_at: getCurrentTime()
  }
];

// 样例数据：过敏原限制
const allergenRestrictions = [
  {
    store_id: 'store001',
    store_name: '上海静安店',
    allergen_type: '花生',
    restriction_level: '严格禁止',
    effective_date: '2024-05-01',
    expiry_date: '2024-12-31',
    is_active: 1
  },
  {
    store_id: 'store003',
    store_name: '深圳南山店',
    allergen_type: '海鲜',
    restriction_level: '需标识',
    effective_date: '2024-04-01',
    expiry_date: '2024-06-30',
    is_active: 1
  }
];

// 样例数据：退料验收
const returnAcceptances = [
  {
    return_number: 'RT20240503001',
    store_id: 'store002',
    store_name: '北京朝阳店',
    ingredient_code: 'VEG001',
    ingredient_name: '青菜',
    batch_number: 'B20240502001',
    returned_quantity: 20,
    accepted_quantity: 15,
    unit: 'kg',
    reason: '部分青菜发黄变质',
    status: 'approved',
    inspected_by: '钱七',
    inspected_at: getCurrentTime()
  },
  {
    return_number: 'RT20240503002',
    store_id: 'store001',
    store_name: '上海静安店',
    ingredient_code: 'PORK001',
    ingredient_name: '五花肉',
    batch_number: 'B20240501001',
    returned_quantity: 10,
    unit: 'kg',
    reason: '肉质新鲜度不够',
    status: 'pending'
  }
];

// 样例数据：门店成本（模拟正常和拦截两种情况）
const storeCosts = [
  {
    transaction_id: 'TXN001',
    store_id: 'store001',
    store_name: '上海静安店',
    menu_code: 'HM001',
    menu_name: '招牌红烧肉',
    ingredient_code: 'PORK002',
    ingredient_name: '瘦猪肉',
    quantity: 5,
    unit: 'kg',
    unit_price: 35,
    total_cost: 175,
    cost_type: 'normal',
    created_by: '张三'
  },
  {
    transaction_id: 'TXN002',
    store_id: 'store003',
    store_name: '深圳南山店',
    menu_code: 'CH003',
    menu_name: '宫保鸡丁',
    ingredient_code: 'PEA001',
    ingredient_name: '花生米',
    quantity: 2,
    unit: 'kg',
    unit_price: 25,
    total_cost: 50,
    cost_type: 'blocked',
    created_by: '李四'
  },
  {
    transaction_id: 'TXN003',
    store_id: 'store002',
    store_name: '北京朝阳店',
    menu_code: 'HS002',
    menu_name: '清炒时蔬',
    ingredient_code: 'VEG002',
    ingredient_name: '油麦菜',
    quantity: 10,
    unit: 'kg',
    unit_price: 8,
    total_cost: 80,
    cost_type: 'revised',
    created_by: '王五'
  }
];

// 初始化样例数据
function seedData(db) {
  const now = getCurrentTime();
  const operator = operators[0];
  
  try {
    db.prepare('BEGIN').run();
    
    // 检查是否已有数据
    const recipeCount = db.prepare('SELECT COUNT(*) as count FROM menu_recipes').get().count;
    if (recipeCount > 0) {
      console.log('数据库已有数据，跳过初始化');
      db.prepare('COMMIT').run();
      return;
    }
    
    // 插入菜单配方
    const insertRecipeStmt = db.prepare(`
      INSERT INTO menu_recipes 
      (id, menu_name, menu_code, category, description, status, version, created_by, created_at, updated_at) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertRecipeItemStmt = db.prepare(`
      INSERT INTO menu_recipe_items 
      (id, recipe_id, ingredient_code, ingredient_name, quantity, unit, is_optional) 
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    for (const recipe of menuRecipes) {
      const recipeId = generateId();
      insertRecipeStmt.run(
        recipeId,
        recipe.menu_name,
        recipe.menu_code,
        recipe.category,
        recipe.description,
        'approved',
        1,
        operator,
        now,
        now
      );
      
      for (const item of recipe.items) {
        insertRecipeItemStmt.run(
          generateId(),
          recipeId,
          item.ingredient_code,
          item.ingredient_name,
          item.quantity,
          item.unit,
          item.is_optional
        );
      }
    }
    
    // 插入食材批次
    const insertBatchStmt = db.prepare(`
      INSERT INTO ingredient_batches 
      (id, ingredient_code, ingredient_name, batch_number, supplier, production_date, expiry_date, 
       quantity, unit, allergens, status, created_by, created_at, updated_at) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    for (const batch of ingredientBatches) {
      insertBatchStmt.run(
        generateId(),
        batch.ingredient_code,
        batch.ingredient_name,
        batch.batch_number,
        batch.supplier,
        batch.production_date,
        batch.expiry_date,
        batch.quantity,
        batch.unit,
        batch.allergens,
        batch.status || 'available',
        operator,
        now,
        now
      );
    }
    
    // 插入替代料确认
    const insertSubstitutionStmt = db.prepare(`
      INSERT INTO substitution_confirmations 
      (id, original_ingredient_code, original_ingredient_name, substitute_ingredient_code, 
       substitute_ingredient_name, recipe_id, menu_name, reason, status, approved_by, 
       approved_at, created_by, created_at, updated_at) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    for (const sub of substitutionConfirmations) {
      insertSubstitutionStmt.run(
        generateId(),
        sub.original_ingredient_code,
        sub.original_ingredient_name,
        sub.substitute_ingredient_code,
        sub.substitute_ingredient_name,
        sub.recipe_id || null,
        sub.menu_name || null,
        sub.reason,
        sub.status,
        sub.approved_by || null,
        sub.approved_at || null,
        operator,
        now,
        now
      );
    }
    
    // 插入过敏原限制
    const insertAllergenStmt = db.prepare(`
      INSERT INTO allergen_restrictions 
      (id, store_id, store_name, allergen_type, restriction_level, effective_date, 
       expiry_date, is_active, created_by, created_at, updated_at) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    for (const restriction of allergenRestrictions) {
      insertAllergenStmt.run(
        generateId(),
        restriction.store_id,
        restriction.store_name,
        restriction.allergen_type,
        restriction.restriction_level,
        restriction.effective_date,
        restriction.expiry_date,
        restriction.is_active,
        operator,
        now,
        now
      );
    }
    
    // 插入退料验收
    const insertReturnStmt = db.prepare(`
      INSERT INTO return_acceptances 
      (id, return_number, store_id, store_name, ingredient_code, ingredient_name, 
       batch_number, returned_quantity, accepted_quantity, unit, reason, status, 
       inspected_by, inspected_at, created_by, created_at, updated_at) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    for (const ret of returnAcceptances) {
      insertReturnStmt.run(
        generateId(),
        ret.return_number,
        ret.store_id,
        ret.store_name,
        ret.ingredient_code,
        ret.ingredient_name,
        ret.batch_number,
        ret.returned_quantity,
        ret.accepted_quantity || null,
        ret.unit,
        ret.reason,
        ret.status,
        ret.inspected_by || null,
        ret.inspected_at || null,
        operator,
        now,
        now
      );
    }
    
    // 插入门店成本
    const insertCostStmt = db.prepare(`
      INSERT INTO store_costs 
      (id, transaction_id, store_id, store_name, menu_code, menu_name, ingredient_code, 
       ingredient_name, quantity, unit, unit_price, total_cost, cost_type, created_by, created_at) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    for (const cost of storeCosts) {
      insertCostStmt.run(
        generateId(),
        cost.transaction_id,
        cost.store_id,
        cost.store_name,
        cost.menu_code,
        cost.menu_name,
        cost.ingredient_code,
        cost.ingredient_name,
        cost.quantity,
        cost.unit,
        cost.unit_price,
        cost.total_cost,
        cost.cost_type,
        cost.created_by,
        now
      );
    }
    
    db.prepare('COMMIT').run();
    console.log('样例数据初始化完成');
  } catch (error) {
    db.prepare('ROLLBACK').run();
    console.error('样例数据初始化失败:', error);
    throw error;
  }
}

module.exports = { seedData, operators, stores, allergenTypes };
