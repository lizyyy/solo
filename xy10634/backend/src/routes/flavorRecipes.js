const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { Database } = require('../utils/db');

router.get('/', async (req, res) => {
  try {
    const recipes = await Database.all('SELECT * FROM flavor_recipes WHERE is_active = 1 ORDER BY created_at DESC');
    res.json({ success: true, data: recipes });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const recipe = await Database.get('SELECT * FROM flavor_recipes WHERE id = ?', req.params.id);
    if (!recipe) {
      return res.status(404).json({ success: false, message: '口味配方不存在' });
    }
    const versions = await Database.all('SELECT * FROM flavor_recipe_versions WHERE recipe_id = ? ORDER BY version DESC', req.params.id);
    res.json({ success: true, data: { ...recipe, versions } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, description, ingredients, baking_time, baking_temperature, operator } = req.body;
    const id = uuidv4();
    const now = new Date().toISOString();

    await Database.run(
      'INSERT INTO flavor_recipes (id, name, description, ingredients, baking_time, baking_temperature, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      id, name, description, ingredients, baking_time, baking_temperature, now, now
    );

    await Database.run(
      'INSERT INTO operation_logs (id, operation_type, entity_type, entity_id, new_value, operator, operation_time) VALUES (?, ?, ?, ?, ?, ?, ?)',
      uuidv4(), 'create', 'flavor_recipe', id, JSON.stringify({ name, description, ingredients, baking_time, baking_temperature }), operator, now
    );

    res.json({ success: true, data: { id, name, description, ingredients, baking_time, baking_temperature } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { name, description, ingredients, baking_time, baking_temperature, operator } = req.body;
    const id = req.params.id;
    const now = new Date().toISOString();

    const oldRecipe = await Database.get('SELECT * FROM flavor_recipes WHERE id = ?', id);
    if (!oldRecipe) {
      return res.status(404).json({ success: false, message: '口味配方不存在' });
    }

    const versionRow = await Database.get('SELECT COALESCE(MAX(version), 0) + 1 as next_version FROM flavor_recipe_versions WHERE recipe_id = ?', id);
    const version = versionRow.next_version;

    await Database.run(
      'INSERT INTO flavor_recipe_versions (id, recipe_id, name, description, ingredients, baking_time, baking_temperature, version, modified_by, modified_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      uuidv4(), id, oldRecipe.name, oldRecipe.description, oldRecipe.ingredients, oldRecipe.baking_time, oldRecipe.baking_temperature, version, operator, now
    );

    await Database.run(
      'UPDATE flavor_recipes SET name = ?, description = ?, ingredients = ?, baking_time = ?, baking_temperature = ?, updated_at = ? WHERE id = ?',
      name, description, ingredients, baking_time, baking_temperature, now, id
    );

    await Database.run(
      'INSERT INTO operation_logs (id, operation_type, entity_type, entity_id, old_value, new_value, operator, operation_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      uuidv4(), 'update', 'flavor_recipe', id, JSON.stringify(oldRecipe), JSON.stringify({ name, description, ingredients, baking_time, baking_temperature }), operator, now
    );

    res.json({ success: true, message: '口味配方已更新' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { operator } = req.body;
    const id = req.params.id;
    const now = new Date().toISOString();

    const oldRecipe = await Database.get('SELECT * FROM flavor_recipes WHERE id = ?', id);
    if (!oldRecipe) {
      return res.status(404).json({ success: false, message: '口味配方不存在' });
    }

    await Database.run('UPDATE flavor_recipes SET is_active = 0, updated_at = ? WHERE id = ?', now, id);

    await Database.run(
      'INSERT INTO operation_logs (id, operation_type, entity_type, entity_id, old_value, operator, operation_time) VALUES (?, ?, ?, ?, ?, ?, ?)',
      uuidv4(), 'delete', 'flavor_recipe', id, JSON.stringify(oldRecipe), operator, now
    );

    res.json({ success: true, message: '口味配方已删除' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
