import { Patient, Escort, Task, SensitiveFieldType } from '../models/types'

export function maskName(name: string): string {
  if (!name || name.length <= 1) return name
  if (name.length === 2) return name[0] + '*'
  return name[0] + '*'.repeat(name.length - 2) + name[name.length - 1]
}

export function maskIdCard(idCard: string): string {
  if (!idCard || idCard.length < 8) return idCard
  return idCard.slice(0, 4) + '*'.repeat(idCard.length - 8) + idCard.slice(-4)
}

export function maskPhone(phone: string): string {
  if (!phone || phone.length < 7) return phone
  return phone.slice(0, 3) + '*'.repeat(phone.length - 7) + phone.slice(-4)
}

export function maskPatient(
  patient: Patient,
  fields: SensitiveFieldType[] = ['all']
): Patient {
  const masked = { ...patient }
  
  if (fields.includes('all') || fields.includes('name')) {
    masked.name = maskName(patient.name)
  }
  if (fields.includes('all') || fields.includes('idCard')) {
    masked.idCard = maskIdCard(patient.idCard)
  }
  if (fields.includes('all') || fields.includes('phone')) {
    masked.phone = maskPhone(patient.phone)
  }
  
  return masked
}

export function maskEscort(
  escort: Escort,
  fields: SensitiveFieldType[] = ['all']
): Escort {
  const masked = { ...escort }
  
  if (fields.includes('all') || fields.includes('name')) {
    masked.name = maskName(escort.name)
  }
  if (fields.includes('all') || fields.includes('phone')) {
    masked.phone = maskPhone(escort.phone)
  }
  
  return masked
}

export function maskTask(
  task: Task,
  fields: SensitiveFieldType[] = ['all']
): Task {
  const masked = { ...task }
  
  if (task.patient) {
    masked.patient = maskPatient(task.patient, fields)
  }
  
  if (task.escort) {
    masked.escort = maskEscort(task.escort, fields)
  }
  
  return masked
}

export function maskTaskList(
  tasks: Task[],
  fields: SensitiveFieldType[] = ['all']
): Task[] {
  return tasks.map(task => maskTask(task, fields))
}

export function maskEscortList(
  escorts: Escort[],
  fields: SensitiveFieldType[] = ['all']
): Escort[] {
  return escorts.map(escort => maskEscort(escort, fields))
}

export function createSensitiveLogger() {
  return {
    info: (message: string, data?: any) => {
      const maskedData = data ? maskSensitiveData(data) : undefined
      console.log(`[INFO] ${message}`, maskedData || '')
    },
    error: (message: string, error?: any) => {
      const maskedError = error ? maskSensitiveData(error) : undefined
      console.error(`[ERROR] ${message}`, maskedError || '')
    },
    warn: (message: string, data?: any) => {
      const maskedData = data ? maskSensitiveData(data) : undefined
      console.warn(`[WARN] ${message}`, maskedData || '')
    }
  }
}

function maskSensitiveData(data: any): any {
  if (!data) return data
  
  if (typeof data === 'string') {
    if (/^\d{17}[\dXx]$/.test(data)) return maskIdCard(data)
    if (/^1[3-9]\d{9}$/.test(data)) return maskPhone(data)
    return data
  }
  
  if (Array.isArray(data)) {
    return data.map(maskSensitiveData)
  }
  
  if (typeof data === 'object') {
    const result: any = {}
    for (const [key, value] of Object.entries(data)) {
      const keyLower = key.toLowerCase()
      if (keyLower.includes('name') && typeof value === 'string') {
        result[key] = maskName(value)
      } else if ((keyLower.includes('idcard') || keyLower.includes('id_card')) && typeof value === 'string') {
        result[key] = maskIdCard(value)
      } else if ((keyLower.includes('phone') || keyLower.includes('mobile')) && typeof value === 'string') {
        result[key] = maskPhone(value)
      } else {
        result[key] = maskSensitiveData(value)
      }
    }
    return result
  }
  
  return data
}
