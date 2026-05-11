const STORAGE_KEYS = {
  volunteers: 'vs_volunteers',
  campuses: 'vs_campuses',
  courses: 'vs_courses',
  schedules: 'vs_schedules',
  importRecords: 'vs_importRecords',
}

export function getItem<T>(key: string, defaultValue: T): T {
  try {
    const item = localStorage.getItem(key)
    return item ? JSON.parse(item) : defaultValue
  } catch {
    return defaultValue
  }
}

export function setItem<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (error) {
    console.error('Failed to save to localStorage:', error)
  }
}

export function clearAll(): void {
  Object.values(STORAGE_KEYS).forEach(key => {
    localStorage.removeItem(key)
  })
}

export { STORAGE_KEYS }
