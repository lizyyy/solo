import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { User } from '@/types'
import { login as apiLogin, getProfile } from '@/api/auth'

const TOKEN_KEY = 'auth_token'
const USER_KEY = 'auth_user'

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem(TOKEN_KEY))
  const user = ref<User | null>(null)
  
  const isAuthenticated = computed(() => !!token.value)
  const isAdmin = computed(() => user.value?.role === 'admin')
  const isOperator = computed(() => user.value?.role === 'operator' || user.value?.role === 'admin')
  
  async function login(username: string, password: string) {
    const result = await apiLogin({ username, password })
    token.value = result.token
    user.value = result.user
    
    localStorage.setItem(TOKEN_KEY, result.token)
    localStorage.setItem(USER_KEY, JSON.stringify(result.user))
    
    return result
  }
  
  async function fetchProfile() {
    if (!token.value) return null
    
    try {
      const profile = await getProfile()
      user.value = profile
      localStorage.setItem(USER_KEY, JSON.stringify(profile))
      return profile
    } catch (e) {
      logout()
      return null
    }
  }
  
  function logout() {
    token.value = null
    user.value = null
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
  }
  
  function restoreFromStorage() {
    const savedUser = localStorage.getItem(USER_KEY)
    if (savedUser) {
      try {
        user.value = JSON.parse(savedUser)
      } catch (e) {
        localStorage.removeItem(USER_KEY)
      }
    }
  }
  
  return {
    token,
    user,
    isAuthenticated,
    isAdmin,
    isOperator,
    login,
    fetchProfile,
    logout,
    restoreFromStorage,
  }
})
