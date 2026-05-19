"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BILLING_TYPES = exports.REQUIRED_FIELDS = exports.DATA_PATHS = exports.DEFAULT_CONFIG = void 0;
exports.DEFAULT_CONFIG = {
    defaultHourlyRate: 150,
    defaultAreaRate: 80,
    defaultFuelRate: 7.5,
    defaultMinimumCharge: 200,
    crossDaySplit: true,
    enforceMinimumCharge: true,
};
exports.DATA_PATHS = {
    records: './data/records.json',
    auditLogs: './data/audit-logs.json',
    config: './data/config.json',
};
exports.REQUIRED_FIELDS = [
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
exports.BILLING_TYPES = ['hourly', 'area', 'fuel', 'mixed'];
