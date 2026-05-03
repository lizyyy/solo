const isElectron = typeof window !== 'undefined' && window.electronAPI

export const storage = {
  async get(key) {
    if (isElectron) {
      try {
        return await window.electronAPI.storeGet(key)
      } catch (e) {
        console.error('Electron storage get error:', e)
        return null
      }
    } else {
      try {
        const value = localStorage.getItem(key)
        return value ? JSON.parse(value) : null
      } catch (e) {
        console.error('LocalStorage get error:', e)
        return null
      }
    }
  },

  async set(key, value) {
    if (isElectron) {
      try {
        return await window.electronAPI.storeSet(key, value)
      } catch (e) {
        console.error('Electron storage set error:', e)
        return false
      }
    } else {
      try {
        localStorage.setItem(key, JSON.stringify(value))
        return true
      } catch (e) {
        console.error('LocalStorage set error:', e)
        return false
      }
    }
  },

  async delete(key) {
    if (isElectron) {
      try {
        return await window.electronAPI.storeDelete(key)
      } catch (e) {
        console.error('Electron storage delete error:', e)
        return false
      }
    } else {
      try {
        localStorage.removeItem(key)
        return true
      } catch (e) {
        console.error('LocalStorage delete error:', e)
        return false
      }
    }
  },

  async clear() {
    if (isElectron) {
      try {
        return await window.electronAPI.storeClear()
      } catch (e) {
        console.error('Electron storage clear error:', e)
        return false
      }
    } else {
      try {
        localStorage.clear()
        return true
      } catch (e) {
        console.error('LocalStorage clear error:', e)
        return false
      }
    }
  }
}

export default storage
