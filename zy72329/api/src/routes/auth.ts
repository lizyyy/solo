import { Router, type Request, type Response } from 'express'
import { findByUsername } from '../repositories/userRepository'

const router = Router()

router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, password } = req.body

    if (!username || !password) {
      res.status(400).json({
        success: false,
        message: '用户名和密码不能为空'
      })
      return
    }

    const user = findByUsername(username)

    if (!user || user.password !== password) {
      res.status(401).json({
        success: false,
        message: '用户名或密码错误'
      })
      return
    }

    const { password: _, ...userWithoutPassword } = user

    res.json({
      success: true,
      data: {
        user: userWithoutPassword,
        token: username
      }
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : '登录失败'
    })
  }
})

export default router
