import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useToastStore = defineStore('toast', () => {
  const toasts = ref<Array<{ id: number; message: string; type: 'success' | 'error' | 'warning' | 'info' }>>([])
  let nextId = 0

  function show(message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') {
    const id = nextId++
    toasts.value.push({ id, message, type })
    setTimeout(() => {
      remove(id)
    }, 3000)
  }

  function remove(id: number) {
    const index = toasts.value.findIndex(t => t.id === id)
    if (index > -1) {
      toasts.value.splice(index, 1)
    }
  }

  function success(message: string) {
    show(message, 'success')
  }

  function error(message: string) {
    show(message, 'error')
  }

  function warning(message: string) {
    show(message, 'warning')
  }

  function info(message: string) {
    show(message, 'info')
  }

  return {
    toasts,
    show,
    success,
    error,
    warning,
    info
  }
})
