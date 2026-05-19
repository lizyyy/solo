export { TicketService } from './services/ticketService';
export { ExportService } from './services/exportService';
export * from './types';
export { 
  TicketRepository, 
  CabinetRepository, 
  AuditLogRepository, 
  MaintenanceRecordRepository 
} from './storage/repositories';
export { DatabaseManager } from './storage/database';
export { createRuleEngine, RuleEngine, DuplicateFaultMergeRule, OfflineCabinetExclusionRule, MaintenanceStatusConsistencyRule } from './rules/ruleEngine';