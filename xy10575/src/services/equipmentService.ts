import { equipmentRepository } from '../repositories/equipmentRepository';
import { historyRepository } from '../repositories/historyRepository';
import { db } from '../database';
import { Equipment, EquipmentStatus } from '../models';

export class BusinessError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = 'BusinessError';
  }
}

export class EquipmentService {
  async create(data: Omit<Equipment, 'id' | 'createdAt' | 'updatedAt'>, operator: { id: string; name: string }): Promise<Equipment> {
    const existing = await equipmentRepository.findByCode(data.code);
    if (existing) {
      throw new BusinessError('DUPLICATE_CODE', `设备编码 ${data.code} 已存在`);
    }
    
    const equipment = await equipmentRepository.create(data);
    
    await historyRepository.create({
      entityType: 'EQUIPMENT',
      entityId: equipment.id,
      action: 'CREATE',
      toStatus: equipment.status,
      changes: JSON.stringify(data),
      operatorId: operator.id,
      operatorName: operator.name,
      timestamp: db.now()
    });
    
    return equipment;
  }

  async getById(id: string): Promise<Equipment | undefined> {
    return equipmentRepository.findById(id);
  }

  async getAll(): Promise<Equipment[]> {
    return equipmentRepository.findAll();
  }

  async updateStatus(id: string, status: EquipmentStatus, operator: { id: string; name: string }, reason?: string): Promise<Equipment> {
    const equipment = await equipmentRepository.findById(id);
    if (!equipment) {
      throw new BusinessError('NOT_FOUND', '设备不存在');
    }
    
    const fromStatus = equipment.status;
    await equipmentRepository.updateStatus(id, status);
    
    await historyRepository.create({
      entityType: 'EQUIPMENT',
      entityId: id,
      action: 'STATUS_CHANGE',
      fromStatus,
      toStatus: status,
      changes: JSON.stringify({ from: fromStatus, to: status }),
      operatorId: operator.id,
      operatorName: operator.name,
      reason,
      timestamp: db.now()
    });
    
    const updated = await equipmentRepository.findById(id);
    return updated!;
  }
}

export const equipmentService = new EquipmentService();
