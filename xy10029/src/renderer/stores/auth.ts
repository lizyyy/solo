import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { User, Permission } from '@shared/types'
import { RolePermissions } from '@shared/types'

export const useAuthStore = defineStore('auth', () => {
  const currentUser = ref<User | null>(null)

  const isAuthenticated = computed(() => currentUser.value !== null)

  const permissions = computed<Permission[]>(() => {
    if (!currentUser.value) return []
    return RolePermissions[currentUser.value.role] || []
  })

  function login(user: User) {
    currentUser.value = user
    localStorage.setItem('currentUser', JSON.stringify(user))
  }

  function logout() {
    currentUser.value = null
    localStorage.removeItem('currentUser')
  }

  function hasPermission(permission: Permission): boolean {
    return permissions.value.includes(permission)
  }

  function restoreAuth() {
    const stored = localStorage.getItem('currentUser')
    if (stored) {
      try {
        currentUser.value = JSON.parse(stored)
      } catch {
        localStorage.removeItem('currentUser')
      }
    }
  }

  return {
    currentUser,
    isAuthenticated,
    permissions,
    login,
    logout,
    hasPermission,
    restoreAuth
  }
})
