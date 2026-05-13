
const express = require('express');
const { db } = require('../database');
const { generateId, getCurrentTime, logOperation, logChanges } = require('../utils');

const router = express.Router();

// 获取所有菜单配方
router.get('/', (req, res) => {
  try {
    const recipes = db.prepare(`
      SELECT * FROM menu_recipes ORDER BY created_at DESC
    `).all();
    
    for (const recipe of recipes) {
      recipe.items = db.prepare(`
        SELECT * FROM menu_recipe_items WHERE recipe_id = ?
      `).all(recipe.id);
    }
    
    res.json(recipes);
  } catch (error) {
    console.error('获取菜单配方失败:', error);
    res.status(500).json({ error: '获取菜单配方失败' });
  }
});

// 获取单个菜单配方
router.get('/:id', (req, res) => {
  try {
    const recipe = db.prepare('SELECT * FROM menu_recipes WHERE id = ?').get(req.params.id);
    if (!recipe) {
      return res.status(404).json({ error: '菜单配方不存在' });
    }
    
    recipe.items = db.prepare(`
      SELECT * FROM menu_recipe_items WHERE recipe_id = ?
    `).all(recipe.id);
    
    res.json(recipe);
  } catch (error) {
    console.error('获取菜单配方失败:', error);
    res.status(500).json({ error: '获取菜单配方失败' });
  }
});

// 创建菜单配方
router.post('/', (req, res) => {
  const now = getCurrentTime();
  const operator = req.headers['x-operator'] || 'system';
  const { menu_name, menu_code, category, description, items } = req.body;
  
  if (!menu_name || !menu_code || !category || !items || items.length === 0) {
    return res.status(400).json({ error: '必填参数缺失' });
  }
  
  try {
    db.prepare('BEGIN').run();
    
    const recipeId = generateId();
    
    db.prepare(`
      INSERT INTO menu_recipes 
      (id, menu_name, menu_code, category, description, status, version, created_by, created_at, updated_at) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      recipeId,
      menu_name,
      menu_code,
      category,
      description || '',
      'draft',
      1,
      operator,
      now,
      now
    );
    
    for (const item of items) {
      db.prepare(`
        INSERT INTO menu_recipe_items 
        (id, recipe_id, ingredient_code, ingredient_name, quantity, unit, is_optional) 
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        generateId(),
        recipeId,
        item.ingredient_code,
        item.ingredient_name,
        item.quantity,
        item.unit,
        item.is_optional || 0
      );
    }
    
    logOperation(db, 'CREATE', 'menu_recipes', recipeId, '创建菜单配方', { menu_name, menu_code }, operator);
    
    db.prepare('COMMIT').run();
    res.status(201).json({ id: recipeId, message: '菜单配方创建成功' });
  } catch (error) {
    db.prepare('ROLLBACK').run();
    console.error('创建菜单配方失败:', error);
    if (error.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: '菜单编码已存在' });
    }
    res.status(500).json({ error: '创建菜单配方失败' });
  }
});

// 更新菜单配方
router.put('/:id', (req, res) => {
  const now = getCurrentTime();
  const operator = req.headers['x-operator'] || 'system';
  const { menu_name, category, description, items, status } = req.body;
  
  try {
    const oldRecipe = db.prepare('SELECT * FROM menu_recipes WHERE id = ?').get(req.params.id);
    if (!oldRecipe) {
      return res.status(404).json({ error: '菜单配方不存在' });
    }
    
    db.prepare('BEGIN').run();
    
    // 记录修改历史
    const updatedRecipe = {
      menu_name: menu_name || oldRecipe.menu_name,
      category: category || oldRecipe.category,
      description: description !== undefined ? description : oldRecipe.description,
      status: status || oldRecipe.status,
      version: oldRecipe.version + 1,
      updated_at: now
    };
    
    logChanges(db, 'menu_recipes', req.params.id, oldRecipe, updatedRecipe, operator);
    
    db.prepare(`
      UPDATE menu_recipes 
      SET menu_name = ?, category = ?, description = ?, status = ?, version = ?, updated_at = ? 
      WHERE id = ?
    `).run(
      updatedRecipe.menu_name,
      updatedRecipe.category,
      updatedRecipe.description,
      updatedRecipe.status,
      updatedRecipe.version,
      updatedRecipe.updated_at,
      req.params.id
    );
    
    // 更新配方明细
    if (items) {
      db.prepare('DELETE FROM menu_recipe_items WHERE recipe_id = ?').run(req.params.id);
      for (const item of items) {
        db.prepare(`
          INSERT INTO menu_recipe_items 
          (id, recipe_id, ingredient_code, ingredient_name, quantity, unit, is_optional) 
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          generateId(),
          req.params.id,
          item.ingredient_code,
          item.ingredient_name,
          item.quantity,
          item.unit,
          item.is_optional || 0
        );
      }
    }
    
    logOperation(db, 'UPDATE', 'menu_recipes', req.params.id, '更新菜单配方', { menu_name: updatedRecipe.menu_name }, operator);
    
    db.prepare('COMMIT').run();
    res.json({ message: '菜单配方更新成功' });
  } catch (error) {
    db.prepare('ROLLBACK').run();
    console.error('更新菜单配方失败:', error);
    res.status(500).json({ error: '更新菜单配方失败' });
  }
});

// 删除菜单配方
router.delete('/:id', (req, res) => {
  const operator = req.headers['x-operator'] || 'system';
  
  try {
    const recipe = db.prepare('SELECT * FROM menu_recipes WHERE id = ?').get(req.params.id);
    if (!recipe) {
      return res.status(404).json({ error: '菜单配方不存在' });
    }
    
    db.prepare('BEGIN').run();
    db.prepare('DELETE FROM menu_recipe_items WHERE recipe_id = ?').run(req.params.id);
    db.prepare('DELETE FROM menu_recipes WHERE id = ?').run(req.params.id);
    
    logOperation(db, 'DELETE', 'menu_recipes', req.params.id, '删除菜单配方', { menu_name: recipe.menu_name }, operator);
    
    db.prepare('COMMIT').run();
    res.json({ message: '菜单配方删除成功' });
  } catch (error) {
    db.prepare('ROLLBACK').run();
    console.error('删除菜单配方失败:', error);
    res.status(500).json({ error: '删除菜单配方失败' });
  }
});

// 审核菜单配方
router.post('/:id/approve', (req, res) => {
  const now = getCurrentTime();
  const operator = req.headers['x-operator'] || 'system';
  
  try {
    const oldRecipe = db.prepare('SELECT * FROM menu_recipes WHERE id = ?').get(req.params.id);
    if (!oldRecipe) {
      return res.status(404).json({ error: '菜单配方不存在' });
    }
    
    db.prepare('UPDATE menu_recipes SET status = ?, updated_at = ? WHERE id = ?').run(
      'approved',
      now,
      req.params.id
    );
    
    logChanges(db, 'menu_recipes', req.params.id, { status: oldRecipe.status }, { status: 'approved' }, operator);
    logOperation(db, 'APPROVE', 'menu_recipes', req.params.id, '审核通过菜单配方', { menu_name: oldRecipe.menu_name }, operator);
    
    res.json({ message: '菜单配方审核通过' });
  } catch (error) {
    console.error('审核菜单配方失败:', error);
    res.status(500).json({ error: '审核菜单配方失败' });
  }
});

module.exports = router;
