import { BillingConfig } from '../types';

export const DEFAULT_CONFIG: BillingConfig = {
  defaultHourlyRate: 150,
  defaultAreaRate: 80,
  defaultFuelRate: 7.5,
  defaultMinimumCharge: 200,
  crossDaySplit: true,
  enforceMinimumCharge: true,
};

export const DATA_PATHS = {
  records: './data/records.json',
  auditLogs: './data/audit-logs.json',
  config: './data/config.json',
};

export const REQUIRED_FIELDS = [
  'recordNo',
  'operator',
  'tractorNo',
  'operatorName',
  'startTime',
  'endTime',
  'workHours',
  'workArea',
  'fuelConsumption',
  'billingType',
];

export const BILLING_TYPES = ['hourly', 'area', 'fuel', 'mixed'];
