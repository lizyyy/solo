export interface Member {
  id: string;
  name: string;
  phone: string;
  idCard: string;
  gender: 'male' | 'female';
  age: number;
  chronicDiseases: string[];
  address: string;
  registerDate: string;
  lastVisitDate?: string;
  riskLevel: 'low' | 'medium' | 'high';
  status: 'active' | 'inactive';
  notes?: string;
}

export interface Medicine {
  id: string;
  name: string;
  genericName: string;
  category: string;
  specification: string;
  manufacturer: string;
  price: number;
  stock: number;
  contraindications: string[];
  sideEffects: string[];
  usage: string;
  status: 'available' | 'unavailable';
}

export interface PurchaseRecord {
  id: string;
  memberId: string;
  memberName: string;
  medicines: {
    medicineId: string;
    medicineName: string;
    quantity: number;
    price: number;
  }[];
  purchaseDate: string;
  totalAmount: number;
  pharmacist: string;
  notes?: string;
}

export interface IndicatorRecord {
  id: string;
  memberId: string;
  memberName: string;
  type: 'blood_pressure' | 'blood_sugar' | 'blood_lipid' | 'heart_rate' | 'weight' | 'other';
  typeName: string;
  value: string;
  unit: string;
  isAbnormal: boolean;
  measureDate: string;
  measureTime: string;
  followupTaskId?: string;
  notes?: string;
}

export interface FollowupTask {
  id: string;
  memberId: string;
  memberName: string;
  memberPhone: string;
  type: 'medicine' | 'indicator' | 'chronic' | 'refill' | 'other';
  typeName: string;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'closed';
  scheduledDate: string;
  scheduledTime?: string;
  actualDate?: string;
  assignedTo: string;
  relatedPurchaseId?: string;
  relatedMedicines: string[];
  refillIntention: 'yes' | 'no' | 'pending';
  completionStatus: 'full' | 'partial' | 'none';
  hasAbnormalIndicator: boolean;
  hasContraindicationReminder: boolean;
  indicatorFollowed: boolean;
  content?: string;
  result?: string;
  nextFollowupDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AbnormalAlert {
  id: string;
  memberId: string;
  memberName: string;
  type: 'indicator' | 'contraindication' | 'task' | 'refill';
  typeName: string;
  level: 'warning' | 'danger' | 'info';
  message: string;
  relatedTaskId?: string;
  relatedIndicatorId?: string;
  isHandled: boolean;
  handledBy?: string;
  handledAt?: string;
  createdAt: string;
}

export interface DashboardStats {
  todayPendingTasks: number;
  todayCompletedTasks: number;
  highRiskMembers: number;
  mediumRiskMembers: number;
  abnormalIndicatorsPending: number;
  pendingRefillIntentions: number;
  tasksThisWeek: number;
  completedThisWeek: number;
}

export interface User {
  id: string;
  name: string;
  role: 'admin' | 'pharmacist' | 'nurse';
  avatar?: string;
}
