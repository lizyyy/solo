const express = require('express');
const router = express.Router();
const userService = require('../services/userService');
const { wrapResponse } = require('../middleware/idempotent');

router.get('/', wrapResponse(async (req, res) => {
  const activeOnly = req.query.active === 'false' ? false : true;
  return userService.getUsers(activeOnly);
}));

router.get('/:id', wrapResponse(async (req, res) => {
  return userService.getUserById(req.params.id);
}));

router.post('/', wrapResponse(async (req, res) => {
  return userService.createUser(req.body);
}));

router.put('/:id', wrapResponse(async (req, res) => {
  return userService.updateUser(req.params.id, req.body);
}));

router.delete('/:id', wrapResponse(async (req, res) => {
  return userService.deleteUser(req.params.id);
}));

module.exports = router;
