const express = require('express');
const router = express.Router();
const responsiblePersonModel = require('../models/responsiblePerson');
const { success, error } = require('../utils/response');

router.get('/', async (req, res) => {
  try {
    const persons = await responsiblePersonModel.getAllResponsiblePersons();
    res.json(success(persons));
  } catch (err) {
    res.status(500).json(error(err.message));
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, role } = req.body;
    if (!name) {
      return res.status(400).json(error('责任人名称不能为空'));
    }
    const person = await responsiblePersonModel.createResponsiblePerson(name, role);
    res.json(success(person, '责任人创建成功'));
  } catch (err) {
    res.status(500).json(error(err.message));
  }
});

module.exports = router;
