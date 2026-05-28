import { db, saveDatabase, generateId } from '../db/init';
import type { AccountSubject, SubjectCategory } from '../../shared/types';

export class SubjectRepository {
  static findAll(params?: { category?: SubjectCategory }): AccountSubject[] {
    let subjects = [...db.accountSubject];
    if (params?.category) {
      subjects = subjects.filter(s => s.category === params.category);
    }
    return subjects.sort((a, b) => a.code.localeCompare(b.code));
  }

  static findById(id: string): AccountSubject | null {
    return db.accountSubject.find(s => s.id === id) || null;
  }

  static findByCode(code: string): AccountSubject | null {
    return db.accountSubject.find(s => s.code === code) || null;
  }

  static create(data: Omit<AccountSubject, 'id' | 'isSystem'>): AccountSubject {
    const id = generateId('sub');
    const subject: AccountSubject = {
      ...data,
      id,
      isSystem: false,
    };
    db.accountSubject.push(subject);
    saveDatabase();
    return subject;
  }
}
