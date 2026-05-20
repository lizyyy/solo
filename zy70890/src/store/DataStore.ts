import { v4 as uuidv4 } from 'uuid';
import {
  Person,
  AttendanceRecord,
  LeaveRecord,
  LocationTrace,
  ReconciliationRecord,
  ReconciliationSummary,
  ReviewStatus,
  DifferenceType,
  ObjectLevel
} from '../types';

export class DataStore {
  private static instance: DataStore;
  private persons: Map<string, Person> = new Map();
  private attendances: Map<string, AttendanceRecord> = new Map();
  private leaves: Map<string, LeaveRecord> = new Map();
  private locationTraces: Map<string, LocationTrace> = new Map();
  private reconciliationRecords: Map<string, ReconciliationRecord> = new Map();
  private reconciliationIdCounter: number = 1;

  private constructor() {}

  public static getInstance(): DataStore {
    if (!DataStore.instance) {
      DataStore.instance = new DataStore();
    }
    return DataStore.instance;
  }

  generateId(): string {
    return uuidv4();
  }

  now(): Date {
    return new Date();
  }

  addPerson(person: Person): void {
    this.persons.set(person.id, person);
  }

  getPerson(id: string): Person | undefined {
    return this.persons.get(id);
  }

  getAllPersons(): Person[] {
    return Array.from(this.persons.values());
  }

  addAttendance(attendance: AttendanceRecord): void {
    this.attendances.set(attendance.id, attendance);
  }

  getAttendancesByDateAndPerson(date: string, personId: string): AttendanceRecord[] {
    return Array.from(this.attendances.values()).filter(
      a => a.date === date && a.personId === personId
    );
  }

  getAllAttendances(): AttendanceRecord[] {
    return Array.from(this.attendances.values());
  }

  addLeave(leave: LeaveRecord): void {
    this.leaves.set(leave.id, leave);
  }

  getLeavesByDateRange(startDate: string, endDate: string, personId: string): LeaveRecord[] {
    return Array.from(this.leaves.values()).filter(
      l => l.personId === personId && 
           l.startDate <= endDate && 
           l.endDate >= startDate
    );
  }

  getAllLeaves(): LeaveRecord[] {
    return Array.from(this.leaves.values());
  }

  addLocationTrace(trace: LocationTrace): void {
    this.locationTraces.set(trace.id, trace);
  }

  getLocationTraceByDateAndPerson(date: string, personId: string): LocationTrace | undefined {
    return Array.from(this.locationTraces.values()).find(
      t => t.date === date && t.personId === personId
    );
  }

  getAllLocationTraces(): LocationTrace[] {
    return Array.from(this.locationTraces.values());
  }

  addReconciliationRecord(record: ReconciliationRecord): void {
    this.reconciliationRecords.set(record.id, record);
  }

  getReconciliationRecord(id: string): ReconciliationRecord | undefined {
    return this.reconciliationRecords.get(id);
  }

  getReconciliationRecordsByReconciliationId(reconciliationId: string): ReconciliationRecord[] {
    return Array.from(this.reconciliationRecords.values()).filter(
      r => r.reconciliationId === reconciliationId
    );
  }

  updateReconciliationRecord(record: ReconciliationRecord): void {
    record.updatedAt = this.now();
    this.reconciliationRecords.set(record.id, record);
  }

  getAllReconciliationIds(): string[] {
    const ids = new Set(Array.from(this.reconciliationRecords.values()).map(r => r.reconciliationId));
    return Array.from(ids).sort().reverse();
  }

  generateReconciliationId(): string {
    const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
    return `RC${date}${String(this.reconciliationIdCounter++).padStart(4, '0')}`;
  }

  getReconciliationSummary(reconciliationId: string): ReconciliationSummary {
    const records = this.getReconciliationRecordsByReconciliationId(reconciliationId);
    
    const summary: ReconciliationSummary = {
      totalRecords: records.length,
      pendingReview: records.filter(r => r.reviewStatus === ReviewStatus.PENDING).length,
      approved: records.filter(r => r.reviewStatus === ReviewStatus.APPROVED).length,
      rejected: records.filter(r => r.reviewStatus === ReviewStatus.REJECTED).length,
      needSupplement: records.filter(r => r.reviewStatus === ReviewStatus.NEED_SUPPLEMENT).length,
      totalDifferences: records.reduce((sum, r) => sum + r.differences.length, 0),
      timeoutNoSign: records.reduce((sum, r) => sum + r.differences.filter(d => d.type === DifferenceType.TIMEOUT_NO_SIGN).length, 0),
      leaveOverlap: records.reduce((sum, r) => sum + r.differences.filter(d => d.type === DifferenceType.LEAVE_OVERLAP).length, 0),
      traceGap: records.reduce((sum, r) => sum + r.differences.filter(d => d.type === DifferenceType.TRACE_GAP).length, 0),
      locationAnomaly: records.reduce((sum, r) => sum + r.differences.filter(d => d.type === DifferenceType.LOCATION_ANOMALY).length, 0),
      manualCorrection: records.reduce((sum, r) => sum + r.differences.filter(d => d.type === DifferenceType.MANUAL_CORRECTION).length, 0),
      levelABnormal: records.filter(r => r.personLevel === ObjectLevel.LEVEL_A && r.differences.length > 0).length,
      levelBBnormal: records.filter(r => r.personLevel === ObjectLevel.LEVEL_B && r.differences.length > 0).length,
      levelCBnormal: records.filter(r => r.personLevel === ObjectLevel.LEVEL_C && r.differences.length > 0).length
    };

    return summary;
  }

  clearAll(): void {
    this.persons.clear();
    this.attendances.clear();
    this.leaves.clear();
    this.locationTraces.clear();
    this.reconciliationRecords.clear();
  }
}
