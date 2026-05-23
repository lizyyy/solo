const express = require('express');
const router = express.Router();
const memberService = require('../services/memberService');

router.post('/', (req, res, next) => {
  try {
    const result = memberService.createMember(req.body);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

router.get('/', (req, res, next) => {
  try {
    const result = memberService.getMemberList();
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

router.get('/phone/:phone', (req, res, next) => {
  try {
    const result = memberService.getMemberByPhone(req.params.phone);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', (req, res, next) => {
  try {
    const result = memberService.getMemberById(req.params.id);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', (req, res, next) => {
  try {
    const result = memberService.updateMember(req.params.id, req.body);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
