const userModel = require('../models/userModel');

async function createUser(req, res) {
  try {
    const { name, role } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: '用户名不能为空' });
    }

    const existingUser = await userModel.getUserByName(name);
    if (existingUser) {
      return res.status(400).json({ error: '用户名已存在' });
    }

    const user = await userModel.createUser({ name, role });
    res.status(201).json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function getUsers(req, res) {
  try {
    const users = await userModel.getAllUsers();
    res.json({ total: users.length, data: users });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function getUser(req, res) {
  try {
    const { id } = req.params;
    const user = await userModel.getUserById(id);
    
    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }
    
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

module.exports = {
  createUser,
  getUsers,
  getUser
};
