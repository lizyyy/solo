import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../config/database';
import { JWT_SECRET, JWT_EXPIRES_IN, ROLES } from '../config/constants';
import { authMiddleware } from '../middleware/auth';
import { nowTimestamp } from '../utils/helpers';

const router = Router();

router.post('/login', (req: Request, res: Response) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: '用户名和密码不能为空' });
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as any;

  if (!user) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }

  const isValid = bcrypt.compareSync(password, user.password_hash);

  if (!isValid) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }

  const token = jwt.sign(
    {
      id: user.id,
      username: user.username,
      real_name: user.real_name,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );

  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      real_name: user.real_name,
      role: user.role,
    },
  });
});

router.get('/me', authMiddleware, (req: Request, res: Response) => {
  res.json({ user: req.user });
});

router.post('/change-password', authMiddleware, (req: Request, res: Response) => {
  const { old_password, new_password } = req.body;

  if (!old_password || !new_password) {
    return res.status(400).json({ error: '旧密码和新密码不能为空' });
  }

  if (new_password.length < 6) {
    return res.status(400).json({ error: '新密码长度不能少于6位' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user!.id) as any;

  const isValid = bcrypt.compareSync(old_password, user.password_hash);

  if (!isValid) {
    return res.status(400).json({ error: '旧密码错误' });
  }

  const passwordHash = bcrypt.hashSync(new_password, 10);
  const now = nowTimestamp();

  db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(
    passwordHash,
    now,
    req.user!.id
  );

  res.json({ message: '密码修改成功' });
});

export default router;
