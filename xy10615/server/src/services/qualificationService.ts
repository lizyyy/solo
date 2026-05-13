import { store } from '../store';
import { PersonQualification } from '../types';

export class QualificationService {
  addQualification(
    data: Omit<PersonQualification, 'id'>,
    operator: string,
    operatorId: string,
    requestId: string
  ): PersonQualification {
    const idempotent = store.checkIdempotent(requestId);
    if (idempotent.exists) {
      return idempotent.result;
    }

    const qualification: PersonQualification = {
      id: store.generateId(),
      ...data
    };

    store.personQualifications.set(qualification.id, qualification);
    store.addStatusHistory(qualification.id, 'QUALIFICATION', qualification.status, undefined, operator, operatorId, '添加人员资质');
    store.markIdempotent(requestId, 'QUALIFICATION', 'CREATE', qualification);

    return qualification;
  }

  updateQualification(
    id: string,
    updates: Partial<PersonQualification>,
    operator: string,
    operatorId: string
  ): PersonQualification {
    const qualification = store.personQualifications.get(id);
    if (!qualification) {
      throw new Error('QUALIFICATION_NOT_FOUND');
    }

    const oldStatus = qualification.status;
    const updatedQualification = {
      ...qualification,
      ...updates
    };

    store.personQualifications.set(id, updatedQualification);

    Object.entries(updates).forEach(([field, newValue]) => {
      const oldValue = (qualification as any)[field];
      if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        store.addChangeLog(id, 'QUALIFICATION', field, oldValue, newValue, operator, operatorId);
      }
    });

    if (updates.status && updates.status !== oldStatus) {
      store.addStatusHistory(id, 'QUALIFICATION', updates.status, oldStatus, operator, operatorId, '资质状态变更');
    }

    return updatedQualification;
  }

  getQualification(id: string): PersonQualification | undefined {
    return store.personQualifications.get(id);
  }

  getQualificationsByPerson(personId: string): PersonQualification[] {
    return Array.from(store.personQualifications.values())
      .filter(q => q.personId === personId)
      .sort((a, b) => new Date(b.validFrom).getTime() - new Date(a.validFrom).getTime());
  }

  getQualificationsByType(qualificationType: string): PersonQualification[] {
    return Array.from(store.personQualifications.values())
      .filter(q => q.qualificationType === qualificationType);
  }

  getValidQualificationsByPerson(personId: string): PersonQualification[] {
    const now = new Date();
    return this.getQualificationsByPerson(personId).filter(q => {
      const validFrom = new Date(q.validFrom);
      const validTo = new Date(q.validTo);
      return q.status === 'VALID' && validFrom <= now && validTo >= now;
    });
  }

  checkPersonQualified(personId: string, requiredTypes: string[]): { qualified: boolean; missingTypes: string[] } {
    const validQualifications = this.getValidQualificationsByPerson(personId);
    const validTypes = new Set(validQualifications.map(q => q.qualificationType));
    const missingTypes = requiredTypes.filter(type => !validTypes.has(type));

    return {
      qualified: missingTypes.length === 0,
      missingTypes
    };
  }

  getAllQualifications(): PersonQualification[] {
    return Array.from(store.personQualifications.values());
  }

  getExpiringSoon(days: number = 30): PersonQualification[] {
    const now = new Date();
    const threshold = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    
    return this.getAllQualifications().filter(q => {
      const validTo = new Date(q.validTo);
      return q.status === 'VALID' && validTo <= threshold && validTo >= now;
    });
  }
}

export const qualificationService = new QualificationService();
