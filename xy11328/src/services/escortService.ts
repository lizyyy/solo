import { v4 as uuidv4 } from 'uuid'
import { Escort } from '../models/types'
import { storage } from './storage'
import { createSensitiveLogger } from '../utils/sensitiveMask'

const logger = createSensitiveLogger()

export class EscortService {
  public createEscort(
    name: string,
    phone: string,
    employeeId: string
  ): Escort {
    const existingEscort = storage.getEscorts().find(e => e.employeeId === employeeId)
    if (existingEscort) {
      throw new Error('该工号的陪检员已存在')
    }

    const escort: Escort = {
      id: uuidv4(),
      name,
      phone,
      employeeId,
      status: 'available'
    }

    storage.saveEscort(escort)
    logger.info('陪检员创建成功', { escortId: escort.id })
    return escort
  }

  public updateEscort(
    escortId: string,
    updates: Partial<Pick<Escort, 'name' | 'phone' | 'status'>>
  ): Escort {
    const escort = storage.getEscortById(escortId)
    if (!escort) {
      throw new Error('陪检员不存在')
    }

    const updatedEscort = { ...escort, ...updates }
    storage.saveEscort(updatedEscort)
    logger.info('陪检员信息已更新', { escortId })
    return updatedEscort
  }

  public getEscortById(escortId: string): Escort | undefined {
    return storage.getEscortById(escortId)
  }

  public getEscortByEmployeeId(employeeId: string): Escort | undefined {
    return storage.getEscorts().find(e => e.employeeId === employeeId)
  }

  public getAllEscorts(): Escort[] {
    return storage.getEscorts()
  }

  public getAvailableEscorts(): Escort[] {
    return storage.getEscorts().filter(e => e.status === 'available')
  }

  public deleteEscort(escortId: string): void {
    const escort = storage.getEscortById(escortId)
    if (!escort) {
      throw new Error('陪检员不存在')
    }

    if (escort.currentTaskId) {
      throw new Error('该陪检员有正在进行的任务，无法删除')
    }

    const db = storage.load()
    db.escorts = db.escorts.filter(e => e.id !== escortId)
    storage.save(db)
    logger.info('陪检员已删除', { escortId })
  }
}

export const escortService = new EscortService()
