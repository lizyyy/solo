import { Router, type Request, type Response } from 'express';
import { authService } from '../services/authService.js';
import type { User } from '../../shared/types.js';

const router = Router();

const mockUser = {
  id: 'u001',
  name: '张明',
};

router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({
        success: false,
        error: '用户名和密码不能为空',
      });
      return;
    }

    const user = await authService.login(username, password);

    if (!user) {
      res.status(401).json({
        success: false,
        error: '用户名或密码错误',
      });
      return;
    }

    res.json({
      success: true,
      data: {
        user,
        token: 'mock-token-' + Date.now(),
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || '登录失败',
    });
  }
});

router.get('/current-user', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = mockUser.id;
    const user = await authService.getCurrentUser(userId);

    if (!user) {
      res.status(404).json({
        success: false,
        error: '用户不存在',
      });
      return;
    }

    res.json({
      success: true,
      data: user,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || '获取用户信息失败',
    });
  }
});

export default router;
