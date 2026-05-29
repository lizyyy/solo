export const storage = {
  getItem: <T>(key: string): T | null => {
    try {
      const item = localStorage.getItem(key)
      if (!item) return null
      return JSON.parse(item) as T
    } catch (error) {
      console.error(`Error reading from localStorage: ${key}`, error)
      return null
    }
  },
  setItem: <T>(key: string, value: T): boolean => {
    try {
      const serialized = JSON.stringify(value)
      localStorage.setItem(key, serialized)
      return true
    } catch (error) {
      console.error(`Error writing to localStorage: ${key}`, error)
      return false
    }
  },
  removeItem: (key: string): boolean => {
    try {
      localStorage.removeItem(key)
      return true
    } catch (error) {
      console.error(`Error removing from localStorage: ${key}`, error)
      return false
    }
  },
  clear: (): boolean => {
    try {
      localStorage.clear()
      return true
    } catch (error) {
      console.error('Error clearing localStorage', error)
      return false
    }
  },
}
