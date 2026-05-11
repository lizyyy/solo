import { db } from './database'
import { hashPassword, verifyPassword } from '../utils/password'

export type UserRole = 'ADMIN' | 'CHECKER'

class AuthService {
  async login(username: string, password: string) {
    const user = await db.user.findUnique({ where: { username } })

    if (!user) {
      throw new Error('用户不存在')
    }

    if (!verifyPassword(password, user.password)) {
      throw new Error('密码错误')
    }

    const { password: _, ...userInfo } = user
    return userInfo
  }

  async changePassword(userId: string, oldPassword: string, newPassword: string) {
    const user = await db.user.findUnique({ where: { id: userId } })
    if (!user) throw new Error('用户不存在')

    if (!verifyPassword(oldPassword, user.password)) {
      throw new Error('原密码错误')
    }

    await db.user.update({
      where: { id: userId },
      data: { password: hashPassword(newPassword) },
    })

    return true
  }

  async listUsers() {
    return db.user.findMany({
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        createdAt: true,
      },
    })
  }

  async createUser(params: {
    username: string
    password: string
    name: string
    role: UserRole
  }) {
    const exists = await db.user.findUnique({ where: { username: params.username } })
    if (exists) {
      throw new Error('用户名已存在')
    }

    const user = await db.user.create({
      data: {
        username: params.username,
        password: hashPassword(params.password),
        name: params.name,
        role: params.role,
      },
    })

    const { password: _, ...userInfo } = user
    return userInfo
  }

  async updateUser(id: string, params: Partial<{ name: string; role: UserRole }>) {
    return db.user.update({
      where: { id },
      data: params,
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        createdAt: true,
      },
    })
  }

  async deleteUser(id: string) {
    await db.user.delete({ where: { id } })
    return true
  }
}

export const authService = new AuthService()
