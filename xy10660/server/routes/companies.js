const express = require('express');
const router = express.Router();
const { runQuery, runExecute } = require('../database');
const { v4: uuidv4 } = require('uuid');

router.get('/', async (req, res) => {
  try {
    const companies = await runQuery('SELECT * FROM companies ORDER BY created_at DESC');
    res.json(companies);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, credit_code, registered_address, legal_representative } = req.body;
    const id = uuidv4();
    await runExecute(
      'INSERT INTO companies (id, name, credit_code, registered_address, legal_representative) VALUES (?, ?, ?, ?, ?)',
      [id, name, credit_code, registered_address, legal_representative]
    );
    const company = await runQuery('SELECT * FROM companies WHERE id = ?', [id]);
    res.status(201).json(company[0]);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
