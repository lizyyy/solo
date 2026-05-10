export enum BatchStatus {
  PENDING = 'PENDING',
  TEMPERATURE_CHECKED = 'TEMPERATURE_CHECKED',
  WEIGHT_CHECKED = 'WEIGHT_CHECKED',
  TICKET_CHECKED = 'TICKET_CHECKED',
  ACCEPTED = 'ACCEPTED',
  PARTIALLY_ACCEPTED = 'PARTIALLY_ACCEPTED',
  REJECTED = 'REJECTED',
  REPLENISHED = 'REPLENISHED'
}

export enum InspectionType {
  TEMPERATURE = 'TEMPERATURE',
  WEIGHT = 'WEIGHT',
  TICKET = 'TICKET'
}

export enum TicketType {
  QUALIFICATION_CERT = 'QUALIFICATION_CERT',
  INSPECTION_REPORT = 'INSPECTION_REPORT',
  DELIVER_NOTE = 'DELIVER_NOTE',
  INVOICE = 'INVOICE'
}

export enum TemperatureUnit {
  CELSIUS = 'CELSIUS',
  FAHRENHEIT = 'FAHRENHEIT'
}

export enum WeightUnit {
  KILOGRAM = 'KILOGRAM',
  GRAM = 'GRAM',
  POUND = 'POUND'
}

export interface TemperatureCheckItem {
  location: string;
  value: number;
  unit: TemperatureUnit;
  measuredAt: Date;
  operatorId: string;
}

export interface WeightCheckItem {
  expected: number;
  actual: number;
  unit: WeightUnit;
}

export interface TicketItem {
  type: TicketType;
  provided: boolean;
  valid?: boolean;
  ticketNumber?: string;
  issueDate?: Date;
  expiryDate?: Date;
}

export interface RejectionReason {
  type: InspectionType;
  code: string;
  description: string;
  detail: string;
}

export interface ReplenishmentInfo {
  replenishedAt: Date;
  operatorId: string;
  note?: string;
  newBatchId?: string;
}
