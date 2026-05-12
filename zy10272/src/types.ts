export enum PaperType {
  A4 = 'A4',
  A3 = 'A3',
  B5 = 'B5'
}

export enum PrintSide {
  SINGLE = 'single',
  DOUBLE = 'double'
}

export enum OrderStatus {
  PENDING = 'pending',
  PAID = 'paid',
  CALLED = 'called',
  NEEDS_TOPUP = 'needs_topup',
  COMPLETED = 'completed',
  REFUNDED = 'refunded'
}

export interface OrderFile {
  id: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  storedPath: string;
}

export interface Order {
  id: string;
  orderNumber: number;
  customerName: string;
  paperType: PaperType;
  printSide: PrintSide;
  pageCount: number;
  copies: number;
  totalPages: number;
  pricePerPage: number;
  totalAmount: number;
  prepaidAmount: number;
  balance: number;
  status: OrderStatus;
  idempotencyKey?: string;
  file?: OrderFile;
  createdAt: Date;
  updatedAt: Date;
  calledAt?: Date;
  completedAt?: Date;
}

export interface CreateOrderRequest {
  customerName: string;
  paperType: PaperType;
  printSide: PrintSide;
  pageCount: number;
  copies: number;
  prepaidAmount: number;
  idempotencyKey?: string;
  fileId?: string;
}

export interface UpdateOrderRequest {
  paperType?: PaperType;
  printSide?: PrintSide;
  pageCount?: number;
  copies?: number;
  prepaidAmount?: number;
}

export interface PriceConfig {
  [PaperType.A4]: { single: number; double: number };
  [PaperType.A3]: { single: number; double: number };
  [PaperType.B5]: { single: number; double: number };
}

export const PRICE_CONFIG: PriceConfig = {
  [PaperType.A4]: { single: 0.2, double: 0.3 },
  [PaperType.A3]: { single: 0.5, double: 0.8 },
  [PaperType.B5]: { single: 0.15, double: 0.25 }
};
