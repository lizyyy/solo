const express = require('express');
const router = express.Router();
const {
  getRules,
  updateRule,
  createRule,
  deleteRule,
  getSensitiveFields,
  updateSensitiveField,
  createSensitiveField
} = require('../services/ruleService');
const logger = require('../utils/logger');

router.get('/', async (req, res) => {
  try {
    const rules = await getRules();
    res.json({ success: true, data: rules });
  } catch (error) {
    logger.error('获取规则列表失败', { error: error.message });
    res.status(500).json({ error: '获取失败' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { rule_type, rule_name, keywords, severity, is_enabled, operator, role } = req.body;

    if (!rule_type || !rule_name || !keywords || !operator || !role) {
      return res.status(400).json({ error: '缺少必填参数' });
    }

    const ruleId = await createRule({
      rule_type,
      rule_name,
      keywords,
      severity,
      is_enabled
    }, operator, role, req.ip);

    logger.info(`创建规则: ${rule_name}`, { operator, role });
    res.json({ success: true, data: { id: ruleId } });
  } catch (error) {
    logger.error('创建规则失败', { error: error.message });
    res.status(500).json({ error: '创建失败' });
  }
});

router.put('/:ruleId', async (req, res) => {
  try {
    const { ruleId } = req.params;
    const { rule_name, keywords, severity, is_enabled, operator, role } = req.body;

    if (!rule_name || !keywords || !operator || !role) {
      return res.status(400).json({ error: '缺少必填参数' });
    }

    const success = await updateRule(ruleId, {
      rule_name,
      keywords,
      severity,
      is_enabled
    }, operator, role, req.ip);

    if (!success) {
      return res.status(404).json({ error: '规则不存在' });
    }

    logger.info(`更新规则: ${rule_name}`, { operator, role });
    res.json({ success: true });
  } catch (error) {
    logger.error('更新规则失败', { error: error.message });
    res.status(500).json({ error: '更新失败' });
  }
});

router.delete('/:ruleId', async (req, res) => {
  try {
    const { ruleId } = req.params;
    const { operator, role } = req.body;

    if (!operator || !role) {
      return res.status(400).json({ error: '缺少必填参数' });
    }

    const success = await deleteRule(ruleId, operator, role, req.ip);

    if (!success) {
      return res.status(404).json({ error: '规则不存在' });
    }

    logger.info(`删除规则: ${ruleId}`, { operator, role });
    res.json({ success: true });
  } catch (error) {
    logger.error('删除规则失败', { error: error.message });
    res.status(500).json({ error: '删除失败' });
  }
});

router.get('/sensitive-fields', async (req, res) => {
  try {
    const fields = await getSensitiveFields();
    res.json({ success: true, data: fields });
  } catch (error) {
    logger.error('获取敏感字段配置失败', { error: error.message });
    res.status(500).json({ error: '获取失败' });
  }
});

router.post('/sensitive-fields', async (req, res) => {
  try {
    const { field_name, mask_pattern, is_enabled, operator, role } = req.body;

    if (!field_name || !mask_pattern || !operator || !role) {
      return res.status(400).json({ error: '缺少必填参数' });
    }

    const fieldId = await createSensitiveField({
      field_name,
      mask_pattern,
      is_enabled
    }, operator, role, req.ip);

    logger.info(`创建敏感字段配置: ${field_name}`, { operator, role });
    res.json({ success: true, data: { id: fieldId } });
  } catch (error) {
    logger.error('创建敏感字段配置失败', { error: error.message });
    res.status(500).json({ error: '创建失败' });
  }
});

router.put('/sensitive-fields/:fieldId', async (req, res) => {
  try {
    const { fieldId } = req.params;
    const { field_name, mask_pattern, is_enabled, operator, role } = req.body;

    if (!field_name || !mask_pattern || !operator || !role) {
      return res.status(400).json({ error: '缺少必填参数' });
    }

    const success = await updateSensitiveField(fieldId, {
      field_name,
      mask_pattern,
      is_enabled
    }, operator, role, req.ip);

    if (!success) {
      return res.status(404).json({ error: '配置不存在' });
    }

    logger.info(`更新敏感字段配置: ${field_name}`, { operator, role });
    res.json({ success: true });
  } catch (error) {
    logger.error('更新敏感字段配置失败', { error: error.message });
    res.status(500).json({ error: '更新失败' });
  }
});

module.exports = router;
