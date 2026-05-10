import { mockClasses, mockStudents, mockDistributionRecords, mockInventory, mockExchangeRequests } from '../data/mockData';
import type { SchoolClass, Student, DistributionRecord, InventoryItem, ExchangeRequest } from '../types';

const STORAGE_KEYS = {
  CLASSES: 'uniform_exchange_classes',
  STUDENTS: 'uniform_exchange_students',
  DISTRIBUTION: 'uniform_exchange_distribution',
  INVENTORY: 'uniform_exchange_inventory',
  REQUESTS: 'uniform_exchange_requests',
  INITIALIZED: 'uniform_exchange_initialized',
};

function getFromStorage<T>(key: string, defaultValue: T): T {
  try {
    const item = localStorage.getItem(key);
    if (item) {
      return JSON.parse(item) as T;
    }
    return defaultValue;
  } catch (error) {
    console.error(`Error reading from localStorage (${key}):`, error);
    return defaultValue;
  }
}

function saveToStorage<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error(`Error saving to localStorage (${key}):`, error);
  }
}

function initializeIfNeeded(): void {
  const initialized = localStorage.getItem(STORAGE_KEYS.INITIALIZED);
  if (!initialized) {
    saveToStorage(STORAGE_KEYS.CLASSES, mockClasses);
    saveToStorage(STORAGE_KEYS.STUDENTS, mockStudents);
    saveToStorage(STORAGE_KEYS.DISTRIBUTION, mockDistributionRecords);
    saveToStorage(STORAGE_KEYS.INVENTORY, mockInventory);
    saveToStorage(STORAGE_KEYS.REQUESTS, mockExchangeRequests);
    localStorage.setItem(STORAGE_KEYS.INITIALIZED, 'true');
  }
}

initializeIfNeeded();

export const storageService = {
  getClasses(): SchoolClass[] {
    return getFromStorage<SchoolClass[]>(STORAGE_KEYS.CLASSES, []);
  },

  getClassById(id: string): SchoolClass | undefined {
    return this.getClasses().find((c) => c.id === id);
  },

  getStudents(): Student[] {
    return getFromStorage<Student[]>(STORAGE_KEYS.STUDENTS, []);
  },

  getStudentById(id: string): Student | undefined {
    return this.getStudents().find((s) => s.id === id);
  },

  getStudentsByClass(classId: string): Student[] {
    return this.getStudents().filter((s) => s.classId === classId);
  },

  saveStudents(students: Student[]): void {
    saveToStorage(STORAGE_KEYS.STUDENTS, students);
  },

  updateStudent(updatedStudent: Student): void {
    const students = this.getStudents();
    const index = students.findIndex((s) => s.id === updatedStudent.id);
    if (index !== -1) {
      students[index] = updatedStudent;
      this.saveStudents(students);
    }
  },

  getDistributionRecords(): DistributionRecord[] {
    return getFromStorage<DistributionRecord[]>(STORAGE_KEYS.DISTRIBUTION, []);
  },

  getDistributionById(id: string): DistributionRecord | undefined {
    return this.getDistributionRecords().find((d) => d.id === id);
  },

  getDistributionByStudent(studentId: string): DistributionRecord[] {
    return this.getDistributionRecords().filter((d) => d.studentId === studentId);
  },

  saveDistributionRecords(records: DistributionRecord[]): void {
    saveToStorage(STORAGE_KEYS.DISTRIBUTION, records);
  },

  updateDistributionRecord(updatedRecord: DistributionRecord): void {
    const records = this.getDistributionRecords();
    const index = records.findIndex((d) => d.id === updatedRecord.id);
    if (index !== -1) {
      records[index] = updatedRecord;
      this.saveDistributionRecords(records);
    }
  },

  getInventory(): InventoryItem[] {
    return getFromStorage<InventoryItem[]>(STORAGE_KEYS.INVENTORY, []);
  },

  getInventoryItem(uniformType: string, size: string): InventoryItem | undefined {
    return this.getInventory().find((i) => i.uniformType === uniformType && i.size === size);
  },

  saveInventory(inventory: InventoryItem[]): void {
    saveToStorage(STORAGE_KEYS.INVENTORY, inventory);
  },

  getExchangeRequests(): ExchangeRequest[] {
    return getFromStorage<ExchangeRequest[]>(STORAGE_KEYS.REQUESTS, []);
  },

  getExchangeRequestById(id: string): ExchangeRequest | undefined {
    return this.getExchangeRequests().find((r) => r.id === id);
  },

  getExchangeRequestsByStudent(studentId: string): ExchangeRequest[] {
    return this.getExchangeRequests().filter((r) => r.studentId === studentId);
  },

  getExchangeRequestsByClass(classId: string): ExchangeRequest[] {
    return this.getExchangeRequests().filter((r) => r.classId === classId);
  },

  saveExchangeRequests(requests: ExchangeRequest[]): void {
    saveToStorage(STORAGE_KEYS.REQUESTS, requests);
  },

  addExchangeRequest(request: ExchangeRequest): void {
    const requests = this.getExchangeRequests();
    requests.push(request);
    this.saveExchangeRequests(requests);
  },

  updateExchangeRequest(updatedRequest: ExchangeRequest): void {
    const requests = this.getExchangeRequests();
    const index = requests.findIndex((r) => r.id === updatedRequest.id);
    if (index !== -1) {
      requests[index] = updatedRequest;
      this.saveExchangeRequests(requests);
    }
  },

  resetData(): void {
    localStorage.removeItem(STORAGE_KEYS.CLASSES);
    localStorage.removeItem(STORAGE_KEYS.STUDENTS);
    localStorage.removeItem(STORAGE_KEYS.DISTRIBUTION);
    localStorage.removeItem(STORAGE_KEYS.INVENTORY);
    localStorage.removeItem(STORAGE_KEYS.REQUESTS);
    localStorage.removeItem(STORAGE_KEYS.INITIALIZED);
    initializeIfNeeded();
  },
};
