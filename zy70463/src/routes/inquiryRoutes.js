const express = require('express');
const router = express.Router();
const inquiryService = require('../services/inquiryService');

router.post('/', async (req, res) => {
  try {
    const inquiry = await inquiryService.createInquiry(req.body);
    
    res.status(201).json({
      message: '询价单创建成功',
      data: inquiry
    });
  } catch (err) {
    res.status(500).json({ error: '创建询价单失败', message: err.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const filters = {
      status: req.query.status
    };
    
    const inquiries = await inquiryService.getAllInquiries(filters);
    
    res.json({
      message: '查询成功',
      data: inquiries
    });
  } catch (err) {
    res.status(500).json({ error: '查询询价单失败', message: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const inquiry = await inquiryService.getInquiryById(req.params.id);
    
    if (!inquiry) {
      return res.status(404).json({ error: '询价单不存在' });
    }
    
    res.json({
      message: '查询成功',
      data: inquiry
    });
  } catch (err) {
    res.status(500).json({ error: '查询询价单失败', message: err.message });
  }
});

router.get('/:id/items/:lineNumber', async (req, res) => {
  try {
    const item = await inquiryService.getItemByLineNumber(
      req.params.id,
      parseInt(req.params.lineNumber)
    );
    
    res.json({
      message: '查询成功',
      data: item
    });
  } catch (err) {
    res.status(404).json({ error: '查询失败', message: err.message });
  }
});

router.post('/:id/items/:lineNumber/remark', async (req, res) => {
  try {
    const { remark } = req.body;
    
    if (!remark) {
      return res.status(400).json({ error: '备注内容不能为空' });
    }
    
    const inquiry = await inquiryService.addItemRemark(
      req.params.id,
      parseInt(req.params.lineNumber),
      remark
    );
    
    res.json({
      message: '备注添加成功',
      data: inquiry
    });
  } catch (err) {
    res.status(400).json({ error: '添加备注失败', message: err.message });
  }
});

router.post('/:id/overall-remark', async (req, res) => {
  try {
    const { remark } = req.body;
    
    if (!remark) {
      return res.status(400).json({ error: '备注内容不能为空' });
    }
    
    const inquiry = await inquiryService.updateOverallRemark(
      req.params.id,
      remark
    );
    
    res.json({
      message: '整体备注更新成功',
      data: inquiry
    });
  } catch (err) {
    res.status(400).json({ error: '更新备注失败', message: err.message });
  }
});

router.get('/:id/report', async (req, res) => {
  try {
    const report = await inquiryService.generateInquiryReport(req.params.id);
    
    res.json({
      message: '报告生成成功',
      data: report
    });
  } catch (err) {
    res.status(404).json({ error: '生成报告失败', message: err.message });
  }
});

module.exports = router;
