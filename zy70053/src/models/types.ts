export interface GroupCredit {
  id: string;
  name: string;
  totalLimit: number;
  availableLimit: number;
  usedLimit: number;
  frozenLimit: number;
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
}

export interface SubAccount {
  id: string;
  groupCreditId: string;
  name: string;
  usedLimit: number;
  frozenLimit: number;
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
}

export interface Withdrawal {
  id: string;
  groupCreditId: string;
  subAccountId: string;
  amount: number;
  status: 'pending' | 'success' | 'failed';
  idempotencyKey: string;
  failureReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Repayment {
  id: string;
  groupCreditId: string;
  subAccountId: string;
  withdrawalId?: string;
  amount: number;
  status: 'pending' | 'success' | 'failed';
  idempotencyKey: string;
  failureReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface FreezeRecord {
  id: string;
  groupCreditId: string;
  subAccountId?: string;
  amount: number;
  reason: string;
  status: 'active' | 'released';
  createdAt: Date;
  updatedAt: Date;
  releasedAt?: Date;
}

export interface BalanceSnapshot {
  id: string;
  groupCreditId: string;
  snapshotTime: Date;
  totalLimit: number;
  availableLimit: number;
  usedLimit: number;
  frozenLimit: number;
  subAccounts: SubAccountSnapshot[];
  createdAt: Date;
}

export interface SubAccountSnapshot {
  subAccountId: string;
  name: string;
  usedLimit: number;
  frozenLimit: number;
}
