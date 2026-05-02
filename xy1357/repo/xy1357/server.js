const express = require('express');
const cors = require('cors');
const path = require('path');
const Papa = require('papaparse');
const db = require('./database');

const app = express();
const PORT = 3000;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// 订单状态枚举
const ORDER_STATUSES = ['待确认', '已确认', '制作中', '已完成', '已取消'];
const ACTIVE_STATUSES = ['待确认', '已确认', '制作中'];

// 辅助函数：生成订单号
function generateOrderNo() {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `ORD${dateStr}${random}`;
}

// 辅助函数：检查订单是否占用库存
function isOrderConsumingStock(status) {
  return ACTIVE_STATUSES.includes(status);
}

// ========== 商品 API ==========

// 获取所有商品（含配方）
app.get('/api/products', (req, res) => {
  try {
    const products = db.prepare(`
      SELECT * FROM products ORDER BY created_at DESC
    `).all();
    
    for (const product of products) {
      product.recipes = db.prepare(`
        SELECT r.quantity, r.ingredient_id, i.name as ingredient_name, i.unit
        FROM recipes r
        JOIN ingredients i ON r.ingredient_id = i.id
        WHERE r.product_id = ?
      `).all(product.id);
    }
    
    res.json(products);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// 获取单个商品
app.get('/api/products/:id', (req, res) => {
  try {
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    if (!product) {
      return res.status(404).json({ error: '商品不存在' });
    }
    
    product.recipes = db.prepare(`
      SELECT r.quantity, r.ingredient_id, i.name as ingredient_name, i.unit
      FROM recipes r
      JOIN ingredients i ON r.ingredient_id = i.id
      WHERE r.product_id = ?
    `).all(product.id);
    
    res.json(product);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// 创建商品（含配方）
app.post('/api/products', (req, res) => {
  const { name, description, unit, recipes } = req.body;
  
  if (!name || name.trim() === '') {
    return res.status(400).json({ error: '商品名称不能为空' });
  }
  
  const transaction = db.transaction(() => {
    const insertProduct = db.prepare(`
      INSERT INTO products (name, description, unit)
      VALUES (@name, @description, @unit)
    `);
    
    const result = insertProduct.run({ 
      name: name.trim(), 
      description: description || '',
      unit: unit || '个'
    });
    
    const productId = result.lastInsertRowid;
    
    if (recipes && Array.isArray(recipes) && recipes.length > 0) {
      const insertRecipe = db.prepare(`
        INSERT INTO recipes (product_id, ingredient_id, quantity)
        VALUES (@product_id, @ingredient_id, @quantity)
      `);
      
      for (const recipe of recipes) {
        if (recipe.ingredient_id && recipe.quantity > 0) {
          insertRecipe.run({
            product_id: productId,
            ingredient_id: recipe.ingredient_id,
            quantity: recipe.quantity
          });
        }
      }
    }
    
    return productId;
  });
  
  try {
    const productId = transaction();
    res.status(201).json({ id: productId, message: '商品创建成功' });
  } catch (err) {
    console.error(err);
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      res.status(400).json({ error: '商品名称已存在' });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

// 更新商品（含配方）
app.put('/api/products/:id', (req, res) => {
  const { name, description, unit, recipes } = req.body;
  const productId = parseInt(req.params.id);
  
  const transaction = db.transaction(() => {
    // 更新商品基本信息
    if (name) {
      db.prepare(`
        UPDATE products 
        SET name = @name, description = @description, unit = @unit, updated_at = CURRENT_TIMESTAMP
        WHERE id = @id
      `).run({
        id: productId,
        name: name.trim(),
        description: description || '',
        unit: unit || '个'
      });
    }
    
    // 更新配方：先删除再重建
    if (recipes !== undefined) {
      db.prepare('DELETE FROM recipes WHERE product_id = ?').run(productId);
      
      if (Array.isArray(recipes) && recipes.length > 0) {
        const insertRecipe = db.prepare(`
          INSERT INTO recipes (product_id, ingredient_id, quantity)
          VALUES (@product_id, @ingredient_id, @quantity)
        `);
        
        for (const recipe of recipes) {
          if (recipe.ingredient_id && recipe.quantity > 0) {
            insertRecipe.run({
              product_id: productId,
              ingredient_id: recipe.ingredient_id,
              quantity: recipe.quantity
            });
          }
        }
      }
    }
  });
  
  try {
    transaction();
    res.json({ message: '商品更新成功' });
  } catch (err) {
    console.error(err);
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      res.status(400).json({ error: '商品名称已存在' });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

// 删除商品
app.delete('/api/products/:id', (req, res) => {
  try {
    // 检查是否有关联订单
    const orderItems = db.prepare(`
      SELECT COUNT(*) as count FROM order_items WHERE product_id = ?
    `).get(req.params.id);
    
    if (orderItems.count > 0) {
      return res.status(400).json({ error: '该商品有关联订单，无法删除' });
    }
    
    const result = db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
    if (result.changes === 0) {
      return res.status(404).json({ error: '商品不存在' });
    }
    
    res.json({ message: '商品删除成功' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ========== 原料/库存 API ==========

// 获取所有原料
app.get('/api/ingredients', (req, res) => {
  try {
    const ingredients = db.prepare(`
      SELECT * FROM ingredients ORDER BY name
    `).all();
    res.json(ingredients);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// 获取单个原料
app.get('/api/ingredients/:id', (req, res) => {
  try {
    const ingredient = db.prepare('SELECT * FROM ingredients WHERE id = ?').get(req.params.id);
    if (!ingredient) {
      return res.status(404).json({ error: '原料不存在' });
    }
    res.json(ingredient);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// 创建原料
app.post('/api/ingredients', (req, res) => {
  const { name, unit, current_stock, min_stock } = req.body;
  
  if (!name || name.trim() === '') {
    return res.status(400).json({ error: '原料名称不能为空' });
  }
  
  try {
    const result = db.prepare(`
      INSERT INTO ingredients (name, unit, current_stock, min_stock)
      VALUES (@name, @unit, @current_stock, @min_stock)
    `).run({
      name: name.trim(),
      unit: unit || 'g',
      current_stock: parseFloat(current_stock) || 0,
      min_stock: parseFloat(min_stock) || 0
    });
    
    res.status(201).json({ id: result.lastInsertRowid, message: '原料创建成功' });
  } catch (err) {
    console.error(err);
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      res.status(400).json({ error: '原料名称已存在' });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

// 更新原料
app.put('/api/ingredients/:id', (req, res) => {
  const { name, unit, current_stock, min_stock } = req.body;
  
  try {
    const result = db.prepare(`
      UPDATE ingredients 
      SET name = @name, unit = @unit, current_stock = @current_stock, 
          min_stock = @min_stock, updated_at = CURRENT_TIMESTAMP
      WHERE id = @id
    `).run({
      id: req.params.id,
      name: name ? name.trim() : undefined,
      unit: unit || 'g',
      current_stock: current_stock !== undefined ? parseFloat(current_stock) : undefined,
      min_stock: min_stock !== undefined ? parseFloat(min_stock) : undefined
    });
    
    if (result.changes === 0) {
      return res.status(404).json({ error: '原料不存在' });
    }
    
    res.json({ message: '原料更新成功' });
  } catch (err) {
    console.error(err);
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      res.status(400).json({ error: '原料名称已存在' });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

// 删除原料
app.delete('/api/ingredients/:id', (req, res) => {
  try {
    // 检查是否有关联配方
    const recipes = db.prepare(`
      SELECT COUNT(*) as count FROM recipes WHERE ingredient_id = ?
    `).get(req.params.id);
    
    if (recipes.count > 0) {
      return res.status(400).json({ error: '该原料有关联配方，无法删除' });
    }
    
    const result = db.prepare('DELETE FROM ingredients WHERE id = ?').run(req.params.id);
    if (result.changes === 0) {
      return res.status(404).json({ error: '原料不存在' });
    }
    
    res.json({ message: '原料删除成功' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ========== 订单 API ==========

// 获取所有订单（含商品明细）
app.get('/api/orders', (req, res) => {
  try {
    const { status, pickup_date } = req.query;
    
    let query = 'SELECT * FROM orders WHERE 1=1';
    const params = [];
    
    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }
    
    if (pickup_date) {
      query += ' AND pickup_date = ?';
      params.push(pickup_date);
    }
    
    query += ' ORDER BY pickup_date, pickup_time, created_at DESC';
    
    const orders = db.prepare(query).all(...params);
    
    for (const order of orders) {
      order.items = db.prepare(`
        SELECT oi.*, p.name as product_name, p.unit
        FROM order_items oi
        JOIN products p ON oi.product_id = p.id
        WHERE oi.order_id = ?
      `).all(order.id);
    }
    
    res.json(orders);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// 获取单个订单
app.get('/api/orders/:id', (req, res) => {
  try {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    if (!order) {
      return res.status(404).json({ error: '订单不存在' });
    }
    
    order.items = db.prepare(`
      SELECT oi.*, p.name as product_name, p.unit
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ?
    `).all(order.id);
    
    res.json(order);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// 创建订单
app.post('/api/orders', (req, res) => {
  const { customer_name, customer_phone, pickup_date, pickup_time, status, remark, items } = req.body;
  
  // 校验
  const errors = [];
  if (!customer_name || customer_name.trim() === '') {
    errors.push('客户姓名不能为空');
  }
  if (!pickup_date) {
    errors.push('取货日期不能为空');
  }
  if (!pickup_time) {
    errors.push('取货时间不能为空');
  }
  if (!items || !Array.isArray(items) || items.length === 0) {
    errors.push('订单至少需要一个商品');
  }
  
  if (errors.length > 0) {
    return res.status(400).json({ error: errors.join('; ') });
  }
  
  const transaction = db.transaction(() => {
    // 生成订单号
    let orderNo;
    let exists = true;
    while (exists) {
      orderNo = generateOrderNo();
      const check = db.prepare('SELECT id FROM orders WHERE order_no = ?').get(orderNo);
      exists = !!check;
    }
    
    // 计算总金额
    let totalAmount = 0;
    if (items) {
      for (const item of items) {
        totalAmount += (item.unit_price || 0) * (item.quantity || 0);
      }
    }
    
    // 插入订单
    const insertOrder = db.prepare(`
      INSERT INTO orders (order_no, customer_name, customer_phone, pickup_date, pickup_time, status, total_amount, remark)
      VALUES (@order_no, @customer_name, @customer_phone, @pickup_date, @pickup_time, @status, @total_amount, @remark)
    `);
    
    const result = insertOrder.run({
      order_no: orderNo,
      customer_name: customer_name.trim(),
      customer_phone: customer_phone || '',
      pickup_date: pickup_date,
      pickup_time: pickup_time,
      status: status || '待确认',
      total_amount: totalAmount,
      remark: remark || ''
    });
    
    const orderId = result.lastInsertRowid;
    
    // 插入订单明细
    const insertItem = db.prepare(`
      INSERT INTO order_items (order_id, product_id, quantity, unit_price, remark)
      VALUES (@order_id, @product_id, @quantity, @unit_price, @remark)
    `);
    
    for (const item of items) {
      insertItem.run({
        order_id: orderId,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price || 0,
        remark: item.remark || ''
      });
    }
    
    return { orderId, orderNo };
  });
  
  try {
    const result = transaction();
    res.status(201).json({ id: result.orderId, order_no: result.orderNo, message: '订单创建成功' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// 更新订单
app.put('/api/orders/:id', (req, res) => {
  const orderId = parseInt(req.params.id);
  const { customer_name, customer_phone, pickup_date, pickup_time, status, remark, items } = req.body;
  
  const transaction = db.transaction(() => {
    // 获取原订单状态
    const oldOrder = db.prepare('SELECT status FROM orders WHERE id = ?').get(orderId);
    if (!oldOrder) {
      throw new Error('订单不存在');
    }
    
    // 更新订单基本信息
    const updateFields = [];
    const updateParams = {};
    
    if (customer_name !== undefined) {
      updateFields.push('customer_name = @customer_name');
      updateParams.customer_name = customer_name ? customer_name.trim() : '';
    }
    if (customer_phone !== undefined) {
      updateFields.push('customer_phone = @customer_phone');
      updateParams.customer_phone = customer_phone || '';
    }
    if (pickup_date !== undefined) {
      updateFields.push('pickup_date = @pickup_date');
      updateParams.pickup_date = pickup_date;
    }
    if (pickup_time !== undefined) {
      updateFields.push('pickup_time = @pickup_time');
      updateParams.pickup_time = pickup_time;
    }
    if (status !== undefined) {
      if (!ORDER_STATUSES.includes(status)) {
        throw new Error('无效的订单状态');
      }
      updateFields.push('status = @status');
      updateParams.status = status;
    }
    if (remark !== undefined) {
      updateFields.push('remark = @remark');
      updateParams.remark = remark || '';
    }
    
    if (updateFields.length > 0) {
      updateFields.push('updated_at = CURRENT_TIMESTAMP');
      updateParams.id = orderId;
      
      db.prepare(`
        UPDATE orders SET ${updateFields.join(', ')} WHERE id = @id
      `).run(updateParams);
    }
    
    // 更新订单明细
    if (items !== undefined) {
      // 先删除原有明细
      db.prepare('DELETE FROM order_items WHERE order_id = ?').run(orderId);
      
      if (Array.isArray(items) && items.length > 0) {
        const insertItem = db.prepare(`
          INSERT INTO order_items (order_id, product_id, quantity, unit_price, remark)
          VALUES (@order_id, @product_id, @quantity, @unit_price, @remark)
        `);
        
        let totalAmount = 0;
        for (const item of items) {
          insertItem.run({
            order_id: orderId,
            product_id: item.product_id,
            quantity: item.quantity,
            unit_price: item.unit_price || 0,
            remark: item.remark || ''
          });
          totalAmount += (item.unit_price || 0) * (item.quantity || 0);
        }
        
        // 更新总金额
        db.prepare('UPDATE orders SET total_amount = ? WHERE id = ?').run(totalAmount, orderId);
      }
    }
  });
  
  try {
    transaction();
    res.json({ message: '订单更新成功' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// 删除订单
app.delete('/api/orders/:id', (req, res) => {
  try {
    const result = db.prepare('DELETE FROM orders WHERE id = ?').run(req.params.id);
    if (result.changes === 0) {
      return res.status(404).json({ error: '订单不存在' });
    }
    
    res.json({ message: '订单删除成功' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ========== 排产和库存计算 API ==========

// 获取排产列表（按日期和时段）
app.get('/api/schedule', (req, res) => {
  try {
    const { date } = req.query;
    let targetDate = date;
    
    if (!targetDate) {
      targetDate = new Date().toISOString().split('T')[0];
    }
    
    // 获取该日期的所有有效订单
    const orders = db.prepare(`
      SELECT * FROM orders 
      WHERE pickup_date = ? AND status IN ('待确认', '已确认', '制作中')
      ORDER BY pickup_time
    `).all(targetDate);
    
    for (const order of orders) {
      order.items = db.prepare(`
        SELECT oi.*, p.name as product_name, p.unit
        FROM order_items oi
        JOIN products p ON oi.product_id = p.id
        WHERE oi.order_id = ?
      `).all(order.id);
    }
    
    // 按时段分组
    const schedule = {};
    for (const order of orders) {
      if (!schedule[order.pickup_time]) {
        schedule[order.pickup_time] = {
          time: order.pickup_time,
          orders: [],
          total_quantity: 0,
          ingredient_demand: {}
        };
      }
      schedule[order.pickup_time].orders.push(order);
      
      // 统计该时段商品总数
      for (const item of order.items) {
        schedule[order.pickup_time].total_quantity += item.quantity;
      }
    }
    
    // 转换为数组并排序
    const scheduleArray = Object.values(schedule).sort((a, b) => a.time.localeCompare(b.time));
    
    res.json({
      date: targetDate,
      schedule: scheduleArray,
      total_orders: orders.length
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// 计算指定日期的原料需求和缺口
app.get('/api/ingredient-demand', (req, res) => {
  try {
    const { date } = req.query;
    let targetDate = date;
    
    if (!targetDate) {
      targetDate = new Date().toISOString().split('T')[0];
    }
    
    // 获取该日期所有有效订单
    const orders = db.prepare(`
      SELECT id, status FROM orders 
      WHERE pickup_date = ? AND status IN ('待确认', '已确认', '制作中')
    `).all(targetDate);
    
    const orderIds = orders.map(o => o.id);
    
    // 如果没有订单，直接返回当前库存
    if (orderIds.length === 0) {
      const ingredients = db.prepare(`
        SELECT *, current_stock as remaining_stock, 0 as required, 0 as gap
        FROM ingredients
        ORDER BY name
      `).all();
      
      return res.json({
        date: targetDate,
        total_demand: {},
        ingredients: ingredients,
        gaps: [],
        has_gap: false
      });
    }
    
    // 计算每个原料的总需求量
    const demandByIngredient = {};
    
    // 遍历每个订单商品，累加原料需求
    const orderItems = db.prepare(`
      SELECT oi.product_id, oi.quantity
      FROM order_items oi
      WHERE oi.order_id IN (${orderIds.map(() => '?').join(',')})
    `).all(...orderIds);
    
    for (const item of orderItems) {
      // 获取该商品的配方
      const recipes = db.prepare(`
        SELECT r.ingredient_id, r.quantity, i.name as ingredient_name, i.unit, i.current_stock, i.min_stock
        FROM recipes r
        JOIN ingredients i ON r.ingredient_id = i.id
        WHERE r.product_id = ?
      `).all(item.product_id);
      
      for (const recipe of recipes) {
        const ingId = recipe.ingredient_id;
        if (!demandByIngredient[ingId]) {
          demandByIngredient[ingId] = {
            ingredient_id: ingId,
            name: recipe.ingredient_name,
            unit: recipe.unit,
            current_stock: recipe.current_stock,
            min_stock: recipe.min_stock,
            required: 0
          };
        }
        demandByIngredient[ingId].required += recipe.quantity * item.quantity;
      }
    }
    
    // 获取所有原料信息，包括没有需求的
    const allIngredients = db.prepare('SELECT * FROM ingredients ORDER BY name').all();
    
    const ingredientList = allIngredients.map(ing => {
      const demand = demandByIngredient[ing.id];
      const required = demand ? demand.required : 0;
      const remaining = ing.current_stock - required;
      const gap = remaining < 0 ? Math.abs(remaining) : 0;
      
      return {
        ...ing,
        required: required,
        remaining_stock: remaining,
        gap: gap,
        is_insufficient: remaining < 0,
        is_below_min: remaining < (ing.min_stock || 0)
      };
    });
    
    // 找出有缺口的原料
    const gaps = ingredientList.filter(ing => ing.is_insufficient);
    const totalDemand = {};
    for (const ing of ingredientList) {
      if (ing.required > 0) {
        totalDemand[ing.name] = {
          required: ing.required,
          unit: ing.unit
        };
      }
    }
    
    res.json({
      date: targetDate,
      total_demand: totalDemand,
      ingredients: ingredientList,
      gaps: gaps,
      has_gap: gaps.length > 0
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ========== CSV 导入导出 API ==========

// 导出当日排产为 CSV
app.get('/api/export-schedule', (req, res) => {
  try {
    const { date } = req.query;
    let targetDate = date;
    
    if (!targetDate) {
      targetDate = new Date().toISOString().split('T')[0];
    }
    
    const orders = db.prepare(`
      SELECT o.*, 
             oi.product_name, oi.quantity, oi.unit_price, oi.remark as item_remark
      FROM orders o
      LEFT JOIN (
        SELECT oi.order_id, oi.quantity, oi.unit_price, oi.remark, p.name as product_name
        FROM order_items oi
        JOIN products p ON oi.product_id = p.id
      ) oi ON o.id = oi.order_id
      WHERE o.pickup_date = ? AND o.status IN ('待确认', '已确认', '制作中')
      ORDER BY o.pickup_time, o.order_no
    `).all(targetDate);
    
    // 构建CSV数据
    const csvData = [];
    csvData.push(['订单号', '客户姓名', '联系电话', '取货日期', '取货时间', '状态', '商品名称', '数量', '单价', '订单备注', '商品备注']);
    
    for (const order of orders) {
      csvData.push([
        order.order_no,
        order.customer_name,
        order.customer_phone || '',
        order.pickup_date,
        order.pickup_time,
        order.status,
        order.product_name || '',
        order.quantity || '',
        order.unit_price || '',
        order.remark || '',
        order.item_remark || ''
      ]);
    }
    
    const csv = Papa.unparse(csvData);
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=schedule_${targetDate}.csv`);
    res.send('\uFEFF' + csv); // BOM 以支持中文
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// 校验和导入 CSV 订单
app.post('/api/import-orders', (req, res) => {
  try {
    const { csvData, dryRun = true } = req.body;
    
    if (!csvData) {
      return res.status(400).json({ error: '缺少CSV数据' });
    }
    
    // 解析 CSV
    const parseResult = Papa.parse(csvData, {
      header: true,
      skipEmptyLines: true,
      encoding: 'UTF-8'
    });
    
    if (parseResult.errors.length > 0) {
      return res.status(400).json({
        error: 'CSV解析错误',
        details: parseResult.errors
      });
    }
    
    const rows = parseResult.data;
    
    if (rows.length === 0) {
      return res.status(400).json({ error: 'CSV文件中没有数据' });
    }
    
    // 获取商品列表用于校验
    const products = db.prepare('SELECT id, name FROM products').all();
    const productNameMap = {};
    for (const p of products) {
      productNameMap[p.name.trim().toLowerCase()] = { id: p.id, name: p.name };
    }
    
    // 校验每一行
    const validationResults = [];
    const validRows = [];
    
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // 考虑表头
      const errors = [];
      const warnings = [];
      
      // 必需字段检查
      const requiredFields = ['客户姓名', '取货日期', '取货时间', '商品名称', '数量'];
      for (const field of requiredFields) {
        if (!row[field] || String(row[field]).trim() === '') {
          errors.push(`缺少字段：${field}`);
        }
      }
      
      // 检查商品是否存在
      if (row['商品名称'] && row['商品名称'].trim() !== '') {
        const productName = row['商品名称'].trim().toLowerCase();
        if (!productNameMap[productName]) {
          errors.push(`未知商品：${row['商品名称']}`);
        }
      }
      
      // 检查数量是否为正整数
      if (row['数量']) {
        const qty = parseInt(row['数量']);
        if (isNaN(qty) || qty <= 0 || !Number.isInteger(parseFloat(row['数量']))) {
          errors.push(`数量必须是正整数：${row['数量']}`);
        }
      }
      
      // 检查取货日期格式 (YYYY-MM-DD)
      if (row['取货日期']) {
        const dateStr = String(row['取货日期']).trim();
        // 支持多种格式输入，但最终会标准化
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        const altDateRegex1 = /^\d{4}\/\d{2}\/\d{2}$/;
        const altDateRegex2 = /^\d{4}\d{2}\d{2}$/;
        
        if (!dateRegex.test(dateStr) && !altDateRegex1.test(dateStr) && !altDateRegex2.test(dateStr)) {
          errors.push(`取货日期格式错误：${dateStr}，请使用 YYYY-MM-DD 格式`);
        }
      }
      
      // 检查取货时间格式 (HH:MM)
      if (row['取货时间']) {
        const timeStr = String(row['取货时间']).trim();
        const timeRegex = /^\d{1,2}:\d{2}$/;
        
        if (!timeRegex.test(timeStr)) {
          errors.push(`取货时间格式错误：${timeStr}，请使用 HH:MM 格式（如 10:30）`);
        }
      }
      
      // 检查订单状态（可选）
      if (row['状态']) {
        const status = row['状态'].trim();
        if (status && !ORDER_STATUSES.includes(status)) {
          warnings.push(`状态 "${status}" 无效，将使用默认值 "待确认"`);
        }
      }
      
      validationResults.push({
        row: rowNum,
        data: row,
        errors: errors,
        warnings: warnings,
        is_valid: errors.length === 0
      });
      
      if (errors.length === 0) {
        validRows.push({ rowNum, data: row });
      }
    }
    
    // 如果是试运行或者有错误，直接返回校验结果
    if (dryRun || validationResults.some(r => !r.is_valid)) {
      return res.json({
        total_rows: rows.length,
        valid_count: validRows.length,
        invalid_count: rows.length - validRows.length,
        validation_results: validationResults,
        can_import: validRows.length > 0 && !dryRun
      });
    }
    
    // 实际执行导入
    const transaction = db.transaction(() => {
      const insertedOrders = [];
      
      // 处理合并（同一个客户、取货时间的可能需要合并？暂时每行一个订单，或者按客户+日期+时间分组）
      // 简化处理：先按 [客户姓名, 取货日期, 取货时间, 状态, 联系电话, 订单备注] 分组
      
      const orderGroups = {};
      
      for (const { rowNum, data } of validRows) {
        const customerName = data['客户姓名'].trim();
        const phone = data['联系电话'] || '';
        let pickupDate = String(data['取货日期']).trim();
        const pickupTime = String(data['取货时间']).trim();
        const status = data['状态'] ? data['状态'].trim() : '待确认';
        const remark = data['订单备注'] || '';
        const productName = data['商品名称'].trim().toLowerCase();
        const quantity = parseInt(data['数量']);
        const unitPrice = parseFloat(data['单价']) || 0;
        const itemRemark = data['商品备注'] || '';
        
        // 标准化日期
        pickupDate = pickupDate.replace(/\//g, '-');
        if (/^\d{8}$/.test(pickupDate)) {
          pickupDate = pickupDate.slice(0, 4) + '-' + pickupDate.slice(4, 6) + '-' + pickupDate.slice(6, 8);
        }
        
        const groupKey = `${customerName}|${phone}|${pickupDate}|${pickupTime}|${status}|${remark}`;
        
        if (!orderGroups[groupKey]) {
          orderGroups[groupKey] = {
            customerName,
            phone,
            pickupDate,
            pickupTime,
            status: ORDER_STATUSES.includes(status) ? status : '待确认',
            remark,
            items: []
          };
        }
        
        orderGroups[groupKey].items.push({
          productId: productNameMap[productName].id,
          productName: productNameMap[productName].name,
          quantity,
          unitPrice,
          itemRemark
        });
      }
      
      // 插入每组订单
      for (const key in orderGroups) {
        const group = orderGroups[key];
        
        // 生成订单号
        let orderNo;
        let exists = true;
        while (exists) {
          orderNo = generateOrderNo();
          const check = db.prepare('SELECT id FROM orders WHERE order_no = ?').get(orderNo);
          exists = !!check;
        }
        
        // 计算总金额
        let totalAmount = 0;
        for (const item of group.items) {
          totalAmount += item.unitPrice * item.quantity;
        }
        
        // 插入订单
        const insertOrder = db.prepare(`
          INSERT INTO orders (order_no, customer_name, customer_phone, pickup_date, pickup_time, status, total_amount, remark)
          VALUES (@order_no, @customer_name, @customer_phone, @pickup_date, @pickup_time, @status, @total_amount, @remark)
        `);
        
        const result = insertOrder.run({
          order_no: orderNo,
          customer_name: group.customerName,
          customer_phone: group.phone,
          pickup_date: group.pickupDate,
          pickup_time: group.pickupTime,
          status: group.status,
          total_amount: totalAmount,
          remark: group.remark
        });
        
        const orderId = result.lastInsertRowid;
        
        // 插入订单明细
        const insertItem = db.prepare(`
          INSERT INTO order_items (order_id, product_id, quantity, unit_price, remark)
          VALUES (@order_id, @product_id, @quantity, @unit_price, @remark)
        `);
        
        for (const item of group.items) {
          insertItem.run({
            order_id: orderId,
            product_id: item.productId,
            quantity: item.quantity,
            unit_price: item.unitPrice,
            remark: item.itemRemark
          });
        }
        
        insertedOrders.push({
          order_no: orderNo,
          customer_name: group.customerName,
          pickup_date: group.pickupDate,
          pickup_time: group.pickupTime,
          items: group.items.length
        });
      }
      
      return insertedOrders;
    });
    
    try {
      const insertedOrders = transaction();
      res.json({
        total_rows: rows.length,
        imported_count: insertedOrders.length,
        imported_orders: insertedOrders,
        validation_results: validationResults,
        success: true
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '导入失败：' + err.message });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ========== 统计 API ==========

// 获取首页统计数据
app.get('/api/stats', (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    // 今日订单数
    const todayOrders = db.prepare(`
      SELECT COUNT(*) as count FROM orders WHERE pickup_date = ? AND status NOT IN ('已取消')
    `).get(today).count;
    
    // 待处理订单
    const pendingOrders = db.prepare(`
      SELECT COUNT(*) as count FROM orders WHERE status IN ('待确认', '已确认')
    `).get().count;
    
    // 制作中
    const inProgress = db.prepare(`
      SELECT COUNT(*) as count FROM orders WHERE status = '制作中'
    `).get().count;
    
    // 检查库存预警
    const lowStock = db.prepare(`
      SELECT COUNT(*) as count FROM ingredients WHERE current_stock < min_stock
    `).get().count;
    
    // 今日原料需求缺口
    const demandResult = db.prepare(`
      SELECT DISTINCT i.id, i.name, i.current_stock, i.unit
      FROM ingredients i
      JOIN recipes r ON i.id = r.ingredient_id
      JOIN order_items oi ON r.product_id = oi.product_id
      JOIN orders o ON oi.order_id = o.id
      WHERE o.pickup_date = ? AND o.status IN ('待确认', '已确认', '制作中')
    `).all(today);
    
    let hasGap = false;
    if (demandResult.length > 0) {
      // 简单检查：如果有订单，就可能有缺口（实际计算需要复杂逻辑，这里简化）
      hasGap = false; // 让前端调用 /api/ingredient-demand 获取详细信息
    }
    
    res.json({
      today: today,
      today_orders: todayOrders,
      pending_orders: pendingOrders,
      in_progress: inProgress,
      low_stock_alerts: lowStock,
      has_gap: hasGap
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`烘焙工作室预订排产小助手已启动`);
  console.log(`访问地址: http://localhost:${PORT}`);
});
