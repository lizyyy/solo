export type PropStatus = 'available' | 'rented' | 'cleaning' | 'damaged' | 'maintenance';

export type RentalStatus = 
  | 'pending' 
  | 'confirmed' 
  | 'picked_up' 
  | 'returned' 
  | 'cleaning' 
  | 'completed' 
  | 'damaged' 
  | 'cancelled'
  | 'blocked';

export interface Prop {
  id: string;
  name: string;
  category: string;
  description: string;
  quantity: number;
  availableQuantity: number;
  dailyRate: number;
  depositAmount: number;
  status: PropStatus;
  imageUrl?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Crew {
  id: string;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  company?: string;
  notes?: string;
  createdAt: string;
}

export interface RentalItem {
  propId: string;
  propName: string;
  quantity: number;
  unitPrice: number;
  depositAmount: number;
  returnedQuantity?: number;
  damagedQuantity?: number;
  damageDescription?: string;
}

export interface InspectionRecord {
  id: string;
  rentalId: string;
  type: 'pickup' | 'return';
  inspector: string;
  date: string;
  photos?: string[];
  notes: string;
  items: {
    propId: string;
    propName: string;
    quantity: number;
    condition: 'excellent' | 'good' | 'fair' | 'poor' | 'damaged';
    notes?: string;
  }[];
}

export interface Rental {
  id: string;
  crewId: string;
  crewName: string;
  items: RentalItem[];
  startDate: string;
  endDate: string;
  totalDays: number;
  subtotal: number;
  totalDeposit: number;
  depositPaid: boolean;
  depositRefunded?: boolean;
  refundAmount?: number;
  damageCompensation?: number;
  compensationPaid?: boolean;
  status: RentalStatus;
  pickupInspectionId?: string;
  returnInspectionId?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  resourceId: string;
  status: RentalStatus;
  rentalId: string;
  crewName: string;
}

export interface FilterOptions {
  status?: RentalStatus;
  crewId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
}
