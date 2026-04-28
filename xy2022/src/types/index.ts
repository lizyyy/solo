export interface ServiceType {
  id: string;
  name: string;
  icon: string;
  basePrice: number;
  unit: string;
  description: string;
}

export interface ServiceOption {
  id: string;
  name: string;
  price: number;
  selected?: boolean;
}

export interface Feeder {
  id: string;
  name: string;
  avatar: string;
  rating: number;
  reviewCount: number;
  distance: number;
  experience: number;
  services: string[];
  available: boolean;
  completedOrders: number;
}

export interface DogInfo {
  id: string;
  name: string;
  breed: string;
  age: number;
  weight: number;
  personality: string;
  isAggressive: boolean;
  dietaryRestrictions: string;
  avatar: string;
}

export interface Address {
  id: string;
  name: string;
  phone: string;
  province: string;
  city: string;
  district: string;
  detail: string;
  isDefault: boolean;
}

export interface Order {
  id: string;
  orderNo: string;
  serviceType: string;
  serviceItems: ServiceOption[];
  address: Address;
  dogInfo: DogInfo;
  feederId: string;
  feederName: string;
  feederAvatar: string;
  appointmentTime: string;
  duration: number;
  specialNotes: string;
  isUrgent: boolean;
  additionalServices: ServiceOption[];
  totalAmount: number;
  status: 'pending_payment' | 'pending_accept' | 'in_progress' | 'completed' | 'refund';
  createTime: string;
  checkInTime?: string;
  checkOutTime?: string;
  videos: string[];
  photos: string[];
  review?: Review;
}

export interface Review {
  id: string;
  rating: number;
  content: string;
  photos: string[];
  createTime: string;
  feederId: string;
  orderId: string;
}

export interface Coupon {
  id: string;
  name: string;
  discount: number;
  minAmount: number;
  expireTime: string;
  isUsed: boolean;
}

export interface Wallet {
  balance: number;
  frozen: number;
  points: number;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  type: 'holiday' | 'restriction' | 'scope';
  createTime: string;
}

export interface PriceItem {
  id: string;
  serviceId: string;
  serviceName: string;
  basePrice: number;
  distanceFee: number;
  urgentFee: number;
  unit: string;
}

export interface FormData {
  serviceType: string;
  serviceItems: ServiceOption[];
  address: Address | null;
  appointmentTime: string;
  duration: number;
  dogInfo: DogInfo | null;
  specialNotes: string;
  feederId: string;
  isUrgent: boolean;
  additionalServices: ServiceOption[];
}
