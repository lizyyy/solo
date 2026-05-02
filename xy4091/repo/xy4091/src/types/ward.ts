export interface Ward {
  id: string;
  name: string;
  code: string;
  department: string;
  floor: number;
  contactPerson: string | null;
  contactPhone: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWardInput {
  name: string;
  code: string;
  department: string;
  floor: number;
  contactPerson?: string;
  contactPhone?: string;
}

export interface UpdateWardInput {
  name?: string;
  code?: string;
  department?: string;
  floor?: number;
  contactPerson?: string;
  contactPhone?: string;
  isActive?: boolean;
}
