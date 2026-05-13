import { v4 as uuidv4 } from 'uuid';
import { db } from '../database';
import { SignOffPerson } from '../types';
import { OperationLogService } from './OperationLogService';

export class SignOffPersonService {
  static async createPerson(
    name: string,
    phone: string,
    idCard: string,
    authorized: boolean,
    department: string,
    operatorId: string,
    operatorName: string
  ): Promise<SignOffPerson> {
    const existing = await db.get<any>(
      `SELECT * FROM sign_off_persons WHERE id_card = ?`,
      [idCard]
    );

    if (existing) {
      throw new Error('该身份证已注册');
    }

    const person: SignOffPerson = {
      id: uuidv4(),
      name,
      phone,
      idCard,
      authorized,
      department
    };

    await db.run(
      `INSERT INTO sign_off_persons (id, name, phone, id_card, authorized, department)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        person.id,
        person.name,
        person.phone,
        person.idCard,
        person.authorized ? 1 : 0,
        person.department
      ]
    );

    await OperationLogService.createLog(
      'create',
      'sign_off_person',
      person.id,
      operatorId,
      operatorName,
      null,
      person,
      '创建签收人'
    );

    return person;
  }

  static async getPerson(id: string): Promise<SignOffPerson | undefined> {
    const row = await db.get<any>(
      `SELECT * FROM sign_off_persons WHERE id = ?`,
      [id]
    );
    return row ? this.mapRowToPerson(row) : undefined;
  }

  static async validateSignOffPerson(personId: string): Promise<{ valid: boolean; reasons: string[] }> {
    const person = await this.getPerson(personId);
    const reasons: string[] = [];

    if (!person) {
      reasons.push('签收人不存在');
      return { valid: false, reasons };
    }

    if (!person.authorized) {
      reasons.push('签收人未授权');
    }

    return { valid: reasons.length === 0, reasons };
  }

  static async getAllPersons(): Promise<SignOffPerson[]> {
    const rows = await db.all<any>(`SELECT * FROM sign_off_persons`);
    return rows.map(row => this.mapRowToPerson(row));
  }

  private static mapRowToPerson(row: any): SignOffPerson {
    return {
      id: row.id,
      name: row.name,
      phone: row.phone,
      idCard: row.id_card,
      authorized: row.authorized === 1,
      department: row.department
    };
  }
}
