export interface Family {
  id: number;
  familyId: string;
  name: string;
  members: number;
  address: string;
  phone: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewer?: string;
  reviewTime?: string;
  remarks?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Material {
  id: number;
  code: string;
  name: string;
  unit: string;
  description?: string;
  createdAt: string;
}

export interface Batch {
  id: number;
  code: string;
  name: string;
  materialId: number;
  materialName: string;
  materialUnit: string;
  quantity: number;
  cycleDays: number;
  startTime: string;
  endTime: string;
  status: 'active' | 'closed';
  createdAt: string;
}

export interface Distribution {
  id: number;
  distributionNo: string;
  familyId: number;
  familyName: string;
  familyIdCode: string;
  batchId: number;
  batchName: string;
  materialName: string;
  quantity: number;
  status: 'pending' | 'distributed' | 'returned' | 'blocked';
  distributor?: string;
  distributeTime?: string;
  isProxy: boolean;
  proxyName?: string;
  proxyIdCard?: string;
  proxyProof?: boolean;
  blockReason?: string;
  needReview: boolean;
  reviewStatus: 'pending' | 'approved' | 'rejected';
  reviewer?: string;
  reviewTime?: string;
  remarks?: string;
  createdAt: string;
  history?: DistributionHistory[];
}

export interface DistributionHistory {
  id: number;
  distributionId: number;
  action: string;
  operator: string;
  details: string;
  createdAt: string;
}

export interface Inventory {
  id: number;
  materialId: number;
  materialName: string;
  materialUnit: string;
  batchId: number;
  batchName: string;
  totalQuantity: number;
  distributedQuantity: number;
  returnedQuantity: number;
  availableQuantity: number;
  updatedAt: string;
}

export interface DashboardStats {
  families: {
    total: number;
    approved: number;
    pending: number;
  };
  distributions: {
    total: number;
    distributed: number;
    pending: number;
    blocked: number;
    needReview: number;
  };
  inventory: {
    total: number;
    distributed: number;
    available: number;
  };
}
