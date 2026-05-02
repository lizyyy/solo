import { BaseEntity, TimestampRange } from './common';
import { AspectRatio, SoundFormat } from './film';

export enum DeviceStatus {
  OPERATIONAL = 'operational',
  MAINTENANCE = 'maintenance',
  OFFLINE = 'offline',
}

export interface SupportedFormats {
  aspectRatios: AspectRatio[];
  soundFormats: SoundFormat[];
}

export interface AuditoriumDevice extends BaseEntity {
  auditoriumId: string;
  auditoriumName: string;
  seatCount: number;
  supportedFormats: SupportedFormats;
  status: DeviceStatus;
  statusReason?: string;
  lastMaintenance?: string;
  nextMaintenance?: string;
  isActive: boolean;
}

export interface AuditoriumDeviceCreateInput {
  auditoriumId: string;
  auditoriumName: string;
  seatCount: number;
  supportedFormats: SupportedFormats;
  status: DeviceStatus;
  statusReason?: string;
  lastMaintenance?: string;
  nextMaintenance?: string;
}

export interface MaintenanceSchedule extends TimestampRange {
  auditoriumId: string;
  reason: string;
}
