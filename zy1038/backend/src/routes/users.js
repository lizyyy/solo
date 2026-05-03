import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { storageService } from '../services/storage.js';
import { auditService } from '../services/auditService.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const users = await storageService.getUsers();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const users = await storageService.getUsers();
    const user = users.find(u => u.id === req.params.id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const users = await storageService.getUsers();
    const newUser = {
      id: uuidv4(),
      name: req.body.name,
      email: req.body.email,
      region: req.body.region,
      accountType: req.body.accountType,
      tags: req.body.tags || [],
      registerDays: Number(req.body.registerDays) || 0,
      createdAt: new Date().toISOString()
    };
    
    users.push(newUser);
    await storageService.saveUsers(users);
    
    await auditService.logCreate(
      'USER',
      newUser,
      `创建用户: ${newUser.name}`
    );
    
    res.status(201).json(newUser);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const users = await storageService.getUsers();
    const index = users.findIndex(u => u.id === req.params.id);
    
    if (index === -1) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const oldValue = { ...users[index] };
    
    const updatedUser = {
      ...users[index],
      name: req.body.name ?? users[index].name,
      email: req.body.email ?? users[index].email,
      region: req.body.region ?? users[index].region,
      accountType: req.body.accountType ?? users[index].accountType,
      tags: req.body.tags ?? users[index].tags,
      registerDays: req.body.registerDays !== undefined 
        ? Number(req.body.registerDays) 
        : users[index].registerDays,
      updatedAt: new Date().toISOString()
    };
    
    users[index] = updatedUser;
    await storageService.saveUsers(users);
    
    await auditService.logUpdate(
      'USER',
      req.params.id,
      oldValue,
      updatedUser,
      `更新用户: ${updatedUser.name}`
    );
    
    res.json(updatedUser);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const users = await storageService.getUsers();
    const index = users.findIndex(u => u.id === req.params.id);
    
    if (index === -1) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const deletedUser = users.splice(index, 1)[0];
    await storageService.saveUsers(users);
    
    await auditService.logDelete(
      'USER',
      req.params.id,
      deletedUser,
      `删除用户: ${deletedUser.name}`
    );
    
    res.json({ success: true, deleted: deletedUser });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/batch', async (req, res) => {
  try {
    const users = await storageService.getUsers();
    const newUsers = req.body.map(userData => ({
      id: uuidv4(),
      name: userData.name,
      email: userData.email,
      region: userData.region,
      accountType: userData.accountType,
      tags: userData.tags || [],
      registerDays: Number(userData.registerDays) || 0,
      createdAt: new Date().toISOString()
    }));
    
    users.push(...newUsers);
    await storageService.saveUsers(users);
    
    for (const user of newUsers) {
      await auditService.logCreate(
        'USER',
        user,
        `批量创建用户: ${user.name}`
      );
    }
    
    res.status(201).json(newUsers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
