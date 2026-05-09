const express = require('express');
const router = express.Router();
const memberRepo = require('../repositories/MemberRepository');
const { MemberNotFoundError, ValidationError } = require('../errors/ApiError');

router.get('/', (req, res) => {
  const members = memberRepo.findAll();
  res.json({ success: true, data: members });
});

router.post('/', (req, res) => {
  const { name } = req.body;
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    throw new ValidationError('name 必填', { field: 'name' });
  }
  const member = memberRepo.create(name.trim());
  res.status(201).json({ success: true, data: member });
});

router.get('/:id', (req, res) => {
  const member = memberRepo.findById(req.params.id);
  if (!member) {
    throw new MemberNotFoundError(req.params.id);
  }
  res.json({ success: true, data: member });
});

module.exports = router;
