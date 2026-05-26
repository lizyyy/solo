export interface RegistrationRow {
  idCard: string;
  name: string;
  phone: string;
  address?: string;
  community?: string;
}

export interface WaitlistRow {
  idCard: string;
  name: string;
  phone: string;
  address?: string;
  community?: string;
  waitlistOrder: number;
  priority: number;
  reason?: string;
}

export interface AttendanceRow {
  idCard: string;
  name: string;
  signInTime?: string;
  signOutTime?: string;
  status?: string;
}

export interface BlacklistRow {
  idCard: string;
  name: string;
  reason: string;
  addedBy: string;
}

export interface ProcessResult {
  success: boolean;
  message: string;
  data?: any;
}

export interface QueryFilters {
  activityId?: string;
  status?: string;
  isDuplicate?: boolean;
  isBlacklisted?: boolean;
  isPromoted?: boolean;
  startDate?: string;
  endDate?: string;
  community?: string;
}
