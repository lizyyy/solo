import { ipc } from '../ipc'
import type { User } from '../../types'

class AuthStore {
  private _currentUser: User | null = null
  private _listeners = new Set<() => void>()

  get currentUser() {
    return this._currentUser
  }

  get isAdmin() {
    return this._currentUser?.role === 'ADMIN'
  }

  get isAuthenticated() {
    return !!this._currentUser
  }

  subscribe(listener: () => void) {
    this._listeners.add(listener)
    return () => this._listeners.delete(listener)
  }

  private notify() {
    this._listeners.forEach(l => l())
  }

  async login(username: string, password: string) {
    const result = await ipc.auth.login(username, password)
    if (result.success) {
      this._currentUser = result.data
      this.notify()
      return { success: true }
    }
    return { success: false, error: result.error }
  }

  logout() {
    this._currentUser = null
    this.notify()
  }
}

export const authStore = new AuthStore()
