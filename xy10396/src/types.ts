export interface DeliveryOrder {
  orderId: string;
  customerName: string;
  address: string;
  scheduledDate: string;
  floor: number;
  items: OrderItem[];
  status: OrderStatus;
  createdAt: string;
}

export interface OrderItem {
  itemId: string;
  name: string;
  dimensions: Dimensions;
  quantity: number;
  price: number;
}

export interface Dimensions {
  length: number;
  width: number;
  height: number;
}

export type OrderStatus = 'pending' | 'delivered' | 'rescheduled' | 'partially_delivered' | 'completed' | 'cancelled';

export interface ElevatorInfo {
  orderId: string;
  floor: number;
  hasElevator: boolean;
  elevatorSize?: Dimensions;
  maxWeight?: number;
  stairAccessOnly: boolean;
}

export interface InstallationRecord {
  orderId: string;
  itemId: string;
  installedDate: string;
  installerId: string;
  issues: string[];
  isCompleted: boolean;
  notes?: string;
}

export interface MissingPartRecord {
  orderId: string;
  itemId: string;
  partName: string;
  quantity: number;
  reportedDate: string;
  status: 'pending' | 'shipped' | 'delivered' | 'installed';
  expectedDeliveryDate?: string;
  actualDeliveryDate?: string;
  notes?: string;
}

export interface RescheduleRecord {
  orderId: string;
  originalDate: string;
  newDate: string;
  reason: string;
  requestedBy: 'customer' | 'company' | 'installer';
  status: 'pending' | 'approved' | 'completed' | 'cancelled';
  createdAt: string;
}

export interface DamageCompensation {
  compensationId: string;
  orderId: string;
  itemId: string;
  damageType: DamageType;
  damageSeverity: DamageSeverity;
  compensationAmount: number;
  responsibleParty: ResponsibleParty;
  description: string;
  reportedDate: string;
  status: 'pending' | 'approved' | 'paid' | 'rejected';
  paidDate?: string;
}

export type DamageType = 'product_damage' | 'installation_damage' | 'delivery_damage' | 'assembly_issue';

export type DamageSeverity = 'minor' | 'moderate' | 'severe';

export type ResponsibleParty = 'customer' | 'supplier' | 'delivery_team' | 'installation_team' | 'manufacturer' | 'company';

export interface AbnormalityCheckResult {
  hasAbnormality: boolean;
  abnormalities: Abnormality[];
}

export interface Abnormality {
  orderId: string;
  type: AbnormalityType;
  severity: 'high' | 'medium' | 'low';
  description: string;
  responsibleParty: ResponsibleParty;
  status: 'open' | 'in_progress' | 'resolved';
  createdAt: string;
  resolvedDate?: string;
  resolution?: string;
}

export type AbnormalityType = 
  | 'missing_parts'
  | 'elevator_conflict'
  | 'reschedule_conflict'
  | 'damage'
  | 'installation_issue'
  | 'late_delivery'
  | 'duplicate_compensation';

export interface AfterSalesReport {
  reportId: string;
  generatedAt: string;
  summary: ReportSummary;
  abnormalities: Abnormality[];
  orders: DeliveryOrder[];
  compensations: DamageCompensation[];
}

export interface ReportSummary {
  totalOrders: number;
  abnormalOrders: number;
  normalOrders: number;
  totalCompensation: number;
  abnormalityBreakdown: Record<AbnormalityType, number>;
  partyResponsibility: Record<ResponsibleParty, number>;
}

export interface ProcessedData {
  orders: Map<string, DeliveryOrder>;
  elevators: Map<string, ElevatorInfo>;
  installations: Map<string, InstallationRecord[]>;
  missingParts: Map<string, MissingPartRecord[]>;
  reschedules: Map<string, RescheduleRecord[]>;
  compensations: Map<string, DamageCompensation[]>;
}
