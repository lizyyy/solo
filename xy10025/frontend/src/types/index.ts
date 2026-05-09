export interface User {
  id: string;
  username: string;
  email: string;
  displayName?: string;
  isOwner?: boolean;
}

export interface Group {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  members: User[];
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface BillShare {
  id: string;
  userId: string;
  amount: number;
  percentage?: number;
  isSettled: boolean;
  settledAt?: string;
}

export interface BillVersion {
  id: string;
  billId: string;
  versionNumber: number;
  snapshot: any;
  changeDescription?: string;
  createdAt: string;
}

export interface Bill {
  id: string;
  title: string;
  amount: number;
  description?: string;
  date: string;
  groupId: string;
  paidByUserId: string;
  status: 'pending' | 'settled' | 'cancelled';
  requestId?: string;
  shares: BillShare[];
  versions: BillVersion[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  version: number;
}

export interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId?: string;
  oldValue?: any;
  newValue?: any;
  userId?: string;
  groupId?: string;
  billId?: string;
  createdAt: string;
  requestId?: string;
}

export interface Statistics {
  totalBills: number;
  settledBills: number;
  pendingBills: number;
  totalAmount: number;
  pendingAmount: number;
  myPaid: number;
  myOwe: number;
  netBalance: number;
}

export interface CreateBillRequest {
  title: string;
  amount: number;
  description?: string;
  date: string;
  groupId: string;
  paidByUserId: string;
  shares: { userId: string; amount: number; percentage?: number }[];
  requestId?: string;
}

export interface UpdateBillRequest {
  title?: string;
  amount?: number;
  description?: string;
  date?: string;
  paidByUserId?: string;
  shares?: { userId: string; amount: number; percentage?: number }[];
  changeDescription?: string;
  expectedVersion: number;
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}
