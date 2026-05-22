import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { getDatabase } from '../database/init.js';
import { generateToken } from '../middleware/auth.js';
import { createAuditLog } from '../services/auditService.js';
import { Role } from '../../shared/types.js';

const router = Router();

router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const { username, password } = req.body;

  if (!username || !password) {
    res.status(400).json({
      success: false,
      error: '用户名和密码不能为空'
    });
    return;
  }

  const db = getDatabase();
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as any;
  db.close();

  if (!user) {
    res.status(401).json({
      success: false,
      error: '用户名或密码错误'
    });
    return;
  }

  const isValid = bcrypt.compareSync(password, user.password_hash);
  if (!isValid) {
    createAuditLog({
      userId: user.id,
      userName: user.real_name,
      action: 'auth:login',
      resourceType: 'auth',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      success: false,
      failureReason: '密码错误'
    });

    res.status(401).json({
      success: false,
      error: '用户名或密码错误'
    });
    return;
  }

  const token = generateToken(user.id);

  const db2 = getDatabase();
  db2.prepare('UPDATE users SET last_login = ? WHERE id = ?')
    .run(new Date().toISOString(), user.id);
  db2.close();

  createAuditLog({
    userId: user.id,
    userName: user.real_name,
    action: 'auth:login',
    resourceType: 'auth',
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
    success: true
  });

  res.json({
    success: true,
    token,
    user: {
      id: user.id,
      username: user.username,
      role: user.role as Role,
      realName: user.real_name,
      createdAt: user.created_at,
      lastLogin: user.last_login
    }
  });
});

router.post('/logout', async (req: Request, res: Response): Promise<void> => {
  res.json({
    success: true,
    message: '已退出登录'
  });
});

export default router;
