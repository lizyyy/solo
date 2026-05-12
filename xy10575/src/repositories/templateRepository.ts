import { db } from '../database';
import { CheckTemplate, CheckItem, CheckType, ItemType } from '../models';

export class TemplateRepository {
  async createTemplate(data: Omit<CheckTemplate, 'id' | 'createdAt'>): Promise<CheckTemplate> {
    const id = db.generateId();
    const now = db.now();
    await db.run(
      `INSERT INTO check_template (id, equipment_id, check_type, name, description, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, data.equipmentId, data.checkType, data.name, data.description, now]
    );
    return this.findTemplateById(id) as Promise<CheckTemplate>;
  }

  async findTemplateById(id: string): Promise<CheckTemplate | undefined> {
    return db.get<CheckTemplate>(
      `SELECT id, equipment_id as equipmentId, check_type as checkType, 
              name, description, created_at as createdAt
       FROM check_template WHERE id = ?`,
      [id]
    );
  }

  async findTemplatesByEquipment(equipmentId: string): Promise<CheckTemplate[]> {
    return db.all<CheckTemplate>(
      `SELECT id, equipment_id as equipmentId, check_type as checkType, 
              name, description, created_at as createdAt
       FROM check_template WHERE equipment_id = ? ORDER BY created_at DESC`,
      [equipmentId]
    );
  }

  async createItem(data: Omit<CheckItem, 'id' | 'createdAt'>): Promise<CheckItem> {
    const id = db.generateId();
    const now = db.now();
    await db.run(
      `INSERT INTO check_item (id, template_id, name, item_type, standard, method, sort_order, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.templateId, data.name, data.itemType, data.standard, data.method, data.sortOrder, now]
    );
    return this.findItemById(id) as Promise<CheckItem>;
  }

  async findItemById(id: string): Promise<CheckItem | undefined> {
    return db.get<CheckItem>(
      `SELECT id, template_id as templateId, name, item_type as itemType,
              standard, method, sort_order as sortOrder, created_at as createdAt
       FROM check_item WHERE id = ?`,
      [id]
    );
  }

  async findItemsByTemplate(templateId: string): Promise<CheckItem[]> {
    return db.all<CheckItem>(
      `SELECT id, template_id as templateId, name, item_type as itemType,
              standard, method, sort_order as sortOrder, created_at as createdAt
       FROM check_item WHERE template_id = ? ORDER BY sort_order ASC`,
      [templateId]
    );
  }
}

export const templateRepository = new TemplateRepository();
