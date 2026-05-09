import { api } from './http'
import type { LoginResponse, User } from '@/types'

export interface LoginParams {
  username: string
  password: string
}

export interface RegisterParams {
  username: string
  password: string
  role?: 'admin' | 'operator' | 'viewer'
}

export interface ChangePasswordParams {
  oldPassword: string
  newPassword: string
}

async function login(params: LoginParams): Promise<LoginResponse> {
  const response = await api.post('/auth/login', params)
  return response.data.data
}

async function register(params: RegisterParams): Promise<User> {
  const response = await api.post('/auth/register', params)
  return response.data.data
}

async function getProfile(): Promise<User> {
  const response = await api.get('/auth/profile')
  return response.data.data
}

async function changePassword(params: ChangePasswordParams): Promise<void> {
  await api.post('/auth/change-password', params)
}

async function listUsers(role?: string): Promise<User[]> {
  const response = await api.get('/auth/users', { params: { role } })
  return response.data.data
}

export {
  login,
  register,
  getProfile,
  changePassword,
  listUsers,
}
