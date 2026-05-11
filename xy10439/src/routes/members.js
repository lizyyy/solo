const express = require('express');
const router = express.Router();
const memberService = require('../services/memberService');
const utils = require('../utils');

router.post('/', async (req, res) => {
  try {
    const { name, phone } = req.body;
    if (!name || !phone) {
      return res.status(400).json({ error: '姓名和手机号不能为空' });
    }
    const member = await memberService.createMember(name, phone);
    res.status(201).json(member);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const members = await memberService.listMembers();
    res.json(members);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const member = await memberService.getMember(req.params.id);
    if (!member) {
      return res.status(404).json({ error: '会员不存在' });
    }
    res.json(member);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/phone/:phone', async (req, res) => {
  try {
    const member = await memberService.getMemberByPhone(req.params.phone);
    if (!member) {
      return res.status(404).json({ error: '会员不存在' });
    }
    res.json(member);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
