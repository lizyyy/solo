export interface Prop {
  id: string;
  name: string;
  code: string;
  category: '布景' | '服饰' | '小道具' | '音效设备';
  location: string;
}

export type BorrowStatus = 'borrowed' | 'returned' | 'on_stage' | 'pending_review';
export type EntryType = 'normal' | 'supplement' | 'withdrawn';

export interface BorrowRecord {
  id: string;
  propId: string;
  sceneNumber: string;
  borrower: string;
  borrowTime: string;
  expectedReturnTime: string;
  actualReturnTime: string;
  status: BorrowStatus;
  entryType: EntryType;
  originalBorrowTime: string;
  originalReturnTime: string;
  isSupplemented: boolean;
  isWithdrawn: boolean;
}

export interface DamageRecord {
  id: string;
  borrowRecordId: string;
  description: string;
  photoUrl: string;
  confirmed: boolean;
  confirmedBy: string;
  confirmedAt: string;
}

export interface AnomalyItem {
  id: string;
  type: 'duplicate_borrow' | 'unconfirmed_damage' | 'late_return' | 'pending_review';
  borrowRecordId: string;
  propId: string;
  message: string;
  resolved: boolean;
  createdAt: string;
}

export type SceneSchedule = {
  sceneNumber: string;
  performanceTime: string;
};
