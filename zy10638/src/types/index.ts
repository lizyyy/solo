export enum MatchStatus {
  PENDING = 'pending',
  MATCHED = 'matched',
  DISPUTED = 'disputed',
  SETTLED = 'settled'
}

export interface EntryRecord {
  id: string;
  entryTime: Date;
  photoUrl: string;
  parkingSpot: string;
  plateNumber?: string;
  createdAt: Date;
}

export interface PaymentRecord {
  id: string;
  paymentTime: Date;
  amount: number;
  paymentMethod: string;
  transactionId: string;
  createdAt: Date;
}

export interface MatchRecord {
  id: string;
  entryId: string;
  paymentId: string;
  status: MatchStatus;
  manualNote: string;
  matchedBy?: string;
  matchedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface MatchHistory {
  id: string;
  matchId: string;
  previousStatus?: MatchStatus;
  newStatus: MatchStatus;
  changedBy?: string;
  changeNote: string;
  createdAt: Date;
}

export interface MatchDetail extends MatchRecord {
  entry: EntryRecord;
  payment: PaymentRecord;
  histories: MatchHistory[];
}

export interface ImportResult {
  success: number;
  failed: number;
  errors: Array<{
    row: number;
    message: string;
    data: Record<string, any>;
  }>;
}
