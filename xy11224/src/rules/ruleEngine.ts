import { Ticket, RuleResult, RuleAction, Cabinet } from '../types';
import { TicketRepository, CabinetRepository, MaintenanceRecordRepository } from '../storage/repositories';

export interface IRule {
  name: string;
  execute(ticket: Ticket): Promise<RuleResult> | RuleResult;
}

export class DuplicateFaultMergeRule implements IRule {
  name = 'DuplicateFaultMergeRule';
  private ticketRepo: TicketRepository;
  private mergeWindowHours: number;

  constructor(ticketRepo: TicketRepository, mergeWindowHours: number = 24) {
    this.ticketRepo = ticketRepo;
    this.mergeWindowHours = mergeWindowHours;
  }

  async execute(ticket: Ticket): Promise<RuleResult> {
    const existingTickets = await this.ticketRepo.findByCabinetIdAndFaultType(
      ticket.cabinetId,
      ticket.faultType,
      this.mergeWindowHours
    );

    if (existingTickets.length > 0) {
      const oldest = existingTickets.reduce((a, b) => 
        a.reportedAt < b.reportedAt ? a : b
      );

      return {
        ruleName: this.name,
        action: RuleAction.MERGE,
        reason: `检测到${this.mergeWindowHours}小时内相同柜机(${ticket.cabinetName})存在相同类型故障`,
        timestamp: new Date(),
        details: {
          mergeIntoId: oldest.id,
          existingCount: existingTickets.length,
          mergeWindowHours: this.mergeWindowHours
        }
      };
    }

    return {
      ruleName: this.name,
      action: RuleAction.ALLOW,
      reason: '未检测到重复故障',
      timestamp: new Date()
    };
  }
}

export class OfflineCabinetExclusionRule implements IRule {
  name = 'OfflineCabinetExclusionRule';
  private cabinetRepo: CabinetRepository;

  constructor(cabinetRepo: CabinetRepository) {
    this.cabinetRepo = cabinetRepo;
  }

  async execute(ticket: Ticket): Promise<RuleResult> {
    const cabinet = await this.cabinetRepo.findById(ticket.cabinetId);
    
    if (cabinet && !cabinet.isOnline) {
      return {
        ruleName: this.name,
        action: RuleAction.BLOCK,
        reason: `柜机(${cabinet.name})当前处于离线状态，排除派修`,
        timestamp: new Date(),
        details: {
          cabinetId: cabinet.id,
          cabinetName: cabinet.name,
          lastHeartbeat: cabinet.lastHeartbeat.toISOString()
        }
      };
    }

    if (ticket.isOffline) {
      return {
        ruleName: this.name,
        action: RuleAction.BLOCK,
        reason: `工单标记柜机为离线状态，排除派修`,
        timestamp: new Date(),
        details: {
          cabinetId: ticket.cabinetId,
          cabinetName: ticket.cabinetName
        }
      };
    }

    return {
      ruleName: this.name,
      action: RuleAction.ALLOW,
      reason: '柜机在线，可正常处理',
      timestamp: new Date()
    };
  }
}

export class MaintenanceStatusConsistencyRule implements IRule {
  name = 'MaintenanceStatusConsistencyRule';
  private maintenanceRepo: MaintenanceRecordRepository;

  constructor(maintenanceRepo: MaintenanceRecordRepository) {
    this.maintenanceRepo = maintenanceRepo;
  }

  async execute(ticket: Ticket): Promise<RuleResult> {
    const maintenanceRecords = await this.maintenanceRepo.findByCabinetId(ticket.cabinetId);
    
    if (maintenanceRecords.length === 0) {
      return {
        ruleName: this.name,
        action: RuleAction.ALLOW,
        reason: '无历史维修记录',
        timestamp: new Date()
      };
    }

    const recentMaintenance = maintenanceRecords[0];
    
    if (recentMaintenance.statusAfter && recentMaintenance.statusAfter !== 'NORMAL') {
      return {
        ruleName: this.name,
        action: RuleAction.BLOCK,
        reason: `上次维修后柜机状态仍为异常(${recentMaintenance.statusAfter})，需复核`,
        timestamp: new Date(),
        details: {
          maintenanceId: recentMaintenance.id,
          statusBefore: recentMaintenance.statusBefore,
          statusAfter: recentMaintenance.statusAfter,
          technician: recentMaintenance.technician
        }
      };
    }

    if (!recentMaintenance.completedAt) {
      return {
        ruleName: this.name,
        action: RuleAction.BLOCK,
        reason: '存在未完成的维修记录，暂不处理新工单',
        timestamp: new Date(),
        details: {
          maintenanceId: recentMaintenance.id,
          technician: recentMaintenance.technician,
          scheduledAt: recentMaintenance.scheduledAt.toISOString()
        }
      };
    }

    return {
      ruleName: this.name,
      action: RuleAction.ALLOW,
      reason: '维修记录状态一致，可正常处理',
      timestamp: new Date(),
      details: {
        lastMaintenanceId: recentMaintenance.id,
        statusAfter: recentMaintenance.statusAfter
      }
    };
  }
}

export class RuleEngine {
  private rules: IRule[] = [];

  constructor(rules: IRule[] = []) {
    this.rules = rules;
  }

  addRule(rule: IRule): void {
    this.rules.push(rule);
  }

  async execute(ticket: Ticket): Promise<{ finalAction: RuleAction; results: RuleResult[] }> {
    const results: RuleResult[] = [];
    let finalAction: RuleAction = RuleAction.ALLOW;

    for (const rule of this.rules) {
      const result = await rule.execute(ticket);
      results.push(result);

      if (result.action === RuleAction.BLOCK) {
        finalAction = RuleAction.BLOCK;
        break;
      }

      if (result.action === RuleAction.MERGE) {
        finalAction = RuleAction.MERGE;
      }
    }

    return { finalAction, results };
  }

  getRuleNames(): string[] {
    return this.rules.map(r => r.name);
  }
}

export function createRuleEngine(
  ticketRepo: TicketRepository,
  cabinetRepo: CabinetRepository,
  maintenanceRepo: MaintenanceRecordRepository
): RuleEngine {
  return new RuleEngine([
    new DuplicateFaultMergeRule(ticketRepo),
    new OfflineCabinetExclusionRule(cabinetRepo),
    new MaintenanceStatusConsistencyRule(maintenanceRepo)
  ]);
}