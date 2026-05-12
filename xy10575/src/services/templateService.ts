import { templateRepository } from '../repositories/templateRepository';
import { equipmentRepository } from '../repositories/equipmentRepository';
import { historyRepository } from '../repositories/historyRepository';
import { db } from '../database';
import { CheckTemplate, CheckItem } from '../models';
import { BusinessError } from './equipmentService';

export class TemplateService {
  async createTemplate(data: Omit<CheckTemplate, 'id' | 'createdAt'>, operator: { id: string; name: string }): Promise<CheckTemplate> {
    const equipment = await equipmentRepository.findById(data.equipmentId);
    if (!equipment) {
      throw new BusinessError('EQUIPMENT_NOT_FOUND', '设备不存在');
    }
    
    const template = await templateRepository.createTemplate(data);
    
    await historyRepository.create({
      entityType: 'TEMPLATE',
      entityId: template.id,
      action: 'CREATE',
      changes: JSON.stringify(data),
      operatorId: operator.id,
      operatorName: operator.name,
      timestamp: db.now()
    });
    
    return template;
  }

  async getTemplateById(id: string): Promise<CheckTemplate | undefined> {
    return templateRepository.findTemplateById(id);
  }

  async getTemplatesByEquipment(equipmentId: string): Promise<CheckTemplate[]> {
    return templateRepository.findTemplatesByEquipment(equipmentId);
  }

  async addItem(data: Omit<CheckItem, 'id' | 'createdAt'>, operator: { id: string; name: string }): Promise<CheckItem> {
    const template = await templateRepository.findTemplateById(data.templateId);
    if (!template) {
      throw new BusinessError('TEMPLATE_NOT_FOUND', '模板不存在');
    }
    
    const item = await templateRepository.createItem(data);
    
    await historyRepository.create({
      entityType: 'TEMPLATE_ITEM',
      entityId: data.templateId,
      action: 'ADD_ITEM',
      changes: JSON.stringify(data),
      operatorId: operator.id,
      operatorName: operator.name,
      timestamp: db.now()
    });
    
    return item;
  }

  async getItemsByTemplate(templateId: string): Promise<CheckItem[]> {
    return templateRepository.findItemsByTemplate(templateId);
  }
}

export const templateService = new TemplateService();
