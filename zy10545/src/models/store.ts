import { v4 as uuidv4 } from 'uuid';
import { Training, Registration, AuditTrail, RegistrationStatus } from './types';

class DataStore {
  private trainings: Map<string, Training> = new Map();
  private registrations: Map<string, Registration> = new Map();
  private auditTrails: AuditTrail[] = [];

  createTraining(training: Omit<Training, 'id' | 'createdAt'>): Training {
    const id = uuidv4();
    const newTraining: Training = {
      ...training,
      id,
      createdAt: new Date()
    };
    this.trainings.set(id, newTraining);
    return newTraining;
  }

  getTraining(id: string): Training | undefined {
    return this.trainings.get(id);
  }

  getTrainingByCode(code: string): Training | undefined {
    return Array.from(this.trainings.values()).find(t => t.trainingCode === code);
  }

  getAllTrainings(): Training[] {
    return Array.from(this.trainings.values());
  }

  createRegistration(registration: Omit<Registration, 'id' | 'createdAt' | 'updatedAt'>): Registration {
    const id = uuidv4();
    const now = new Date();
    const newRegistration: Registration = {
      ...registration,
      id,
      createdAt: now,
      updatedAt: now
    };
    this.registrations.set(id, newRegistration);
    return newRegistration;
  }

  getRegistration(id: string): Registration | undefined {
    return this.registrations.get(id);
  }

  getRegistrationsByTraining(trainingId: string): Registration[] {
    return Array.from(this.registrations.values())
      .filter(r => r.trainingId === trainingId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  getRegistrationsByApplicant(applicantId: string): Registration[] {
    return Array.from(this.registrations.values())
      .filter(r => r.applicantId === applicantId);
  }

  updateRegistration(id: string, updates: Partial<Registration>): Registration | undefined {
    const registration = this.registrations.get(id);
    if (!registration) return undefined;
    
    const updated = { ...registration, ...updates, updatedAt: new Date() };
    this.registrations.set(id, updated);
    return updated;
  }

  addAuditTrail(audit: Omit<AuditTrail, 'id' | 'timestamp'>): AuditTrail {
    const auditTrail: AuditTrail = {
      ...audit,
      id: uuidv4(),
      timestamp: new Date()
    };
    this.auditTrails.push(auditTrail);
    return auditTrail;
  }

  getAuditTrailsByRegistration(registrationId: string): AuditTrail[] {
    return this.auditTrails.filter(a => a.registrationId === registrationId);
  }

  getAuditTrailsByTraining(trainingId: string): AuditTrail[] {
    const registrationIds = this.getRegistrationsByTraining(trainingId).map(r => r.id);
    return this.auditTrails.filter(a => registrationIds.includes(a.registrationId));
  }

  getQualifiedCount(trainingId: string): number {
    return this.getRegistrationsByTraining(trainingId)
      .filter(r => r.status === RegistrationStatus.QUALIFIED).length;
  }

  getWaitlistRegistrations(trainingId: string): Registration[] {
    return this.getRegistrationsByTraining(trainingId)
      .filter(r => r.status === RegistrationStatus.WAITLIST)
      .sort((a, b) => (a.waitlistOrder || 0) - (b.waitlistOrder || 0));
  }

  getNextWaitlistOrder(trainingId: string): number {
    const waitlist = this.getWaitlistRegistrations(trainingId);
    return waitlist.length > 0 ? (waitlist[waitlist.length - 1].waitlistOrder || 0) + 1 : 1;
  }
}

export const store = new DataStore();
