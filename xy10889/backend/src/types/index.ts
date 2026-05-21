export enum SampleStatus {
  CREATED = 'CREATED',
  COLLECTED = 'COLLECTED',
  IN_TRANSIT = 'IN_TRANSIT',
  ARRIVED = 'ARRIVED',
  TESTING = 'TESTING',
  COMPLETED = 'COMPLETED',
  EXCEPTION = 'EXCEPTION',
  LOST = 'LOST'
}

export enum ExceptionType {
  TEMPERATURE_EXCEEDED = 'TEMPERATURE_EXCEEDED',
  DELAYED = 'DELAYED',
  DAMAGED = 'DAMAGED',
  LOST = 'LOST',
  WRONG_DESTINATION = 'WRONG_DESTINATION',
  OTHER = 'OTHER'
}

export interface Sample {
  id: string;
  barcode: string;
  status: SampleStatus;
  type: string;
  collectionPoint: string;
  destinationLab: string;
  currentLocation: string;
  createdAt: string;
  updatedAt: string;
  currentHandler: string;
  batchId?: string;
}

export interface Transfer {
  id: string;
  sampleId: string;
  fromHandler: string;
  toHandler: string;
  fromLocation: string;
  toLocation: string;
  transferTime: string;
  temperature?: number;
  humidity?: number;
  notes?: string;
  status: 'PENDING' | 'CONFIRMED' | 'REJECTED';
}

export interface Batch {
  id: string;
  batchNumber: string;
  status: 'PREPARING' | 'SHIPPING' | 'DELIVERED' | 'EXCEPTION';
  origin: string;
  destination: string;
  estimatedArrival?: string;
  actualArrival?: string;
  courier: string;
  sampleCount: number;
  createdAt: string;
}

export interface TemperatureRecord {
  id: string;
  batchId?: string;
  sampleId?: string;
  temperature: number;
  recordTime: string;
  location: string;
  recordedBy: string;
}

export interface ExceptionRecord {
  id: string;
  sampleId?: string;
  batchId?: string;
  type: ExceptionType;
  description: string;
  reportedBy: string;
  reportedAt: string;
  resolved: boolean;
  resolvedAt?: string;
  resolvedBy?: string;
  resolution?: string;
}

export interface ResponsibilityLink {
  id: string;
  sampleId: string;
  handler: string;
  role: string;
  startTime: string;
  endTime?: string;
  location: string;
  action: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}
