const { getAllChangeHistory } = require('../utils/audit');
const { getUserList } = require('../models/user');

function listHistory(req, res) {
  try {
    const history = getAllChangeHistory(req.query);
    res.json({ success: true, data: history });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
}

function listUsers(req, res) {
  try {
    const users = getUserList(req.query);
    res.json({ success: true, data: users });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
}

module.exports = {
  listHistory,
  listUsers,
};
