import type { Request, Response, NextFunction } from 'express'
import type { User, UserRole } from '../../../shared/types'
import { findByUsername } from '../repositories/userRepository'

declare module 'express' {
  interface Request {
    user?: User
  }
}

function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const skipPaths = ['/api/auth/login', '/api/health']
  if (skipPaths.some(p => req.path.startsWith(p))) {
    next()
    return
  }

  try {
    const token = req.headers.authorization?.replace('Bearer ', '')

    if (!token) {
      res.status(401).json({
        success: false,
        message: '未提供认证令牌'
      })
      return
    }

    const user = findByUsername(token)

    if (!user) {
      res.status(401).json({
        success: false,
        message: '无效的认证令牌'
      })
      return
    }

    const roleHeader = req.headers['x-user-role'] as string
    const role = (roleHeader || user.role) as UserRole

    req.user = {
      id: user.id,
      username: user.username,
      name: user.name,
      role
    }

    next()
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '认证失败'
    })
  }
}

function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: '未登录'
      })
      return
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: '权限不足'
      })
      return
    }

    next()
  }
}

export { authMiddleware, requireRole }
