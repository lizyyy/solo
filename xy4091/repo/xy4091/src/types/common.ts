export type BloodType = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';

export type BloodComponentType = 'RED_CELL' | 'PLASMA' | 'PLATELET' | 'CRYOPRECIPITATE';

export type BloodBagStatus = 'AVAILABLE' | 'RESERVED' | 'ISSUED' | 'EXPIRED' | 'QUARANTINE';

export type ApplicationStatus = 'PENDING' | 'MATCHED' | 'RESERVED' | 'ISSUED' | 'CANCELLED' | 'REJECTED';

export interface TemperatureRecord {
  timestamp: string;
  temperature: number;
  location: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
