import { InMemoryRepository } from './InMemoryRepository';
import { TransactionRepository } from './TransactionRepository';
import { BudgetPool, Campaign, Material, Channel, MaterialBinding, Transaction, AuditLogEntry } from '../types';

let budgetPoolRepo: InMemoryRepository<BudgetPool> | null = null;
let campaignRepo: InMemoryRepository<Campaign> | null = null;
let materialRepo: InMemoryRepository<Material> | null = null;
let channelRepo: InMemoryRepository<Channel> | null = null;
let bindingRepo: InMemoryRepository<MaterialBinding> | null = null;
let transactionRepo: TransactionRepository | null = null;
let auditLogRepo: InMemoryRepository<AuditLogEntry> | null = null;

export function getBudgetPoolRepository(): InMemoryRepository<BudgetPool> {
  if (!budgetPoolRepo) {
    budgetPoolRepo = new InMemoryRepository<BudgetPool>();
  }
  return budgetPoolRepo;
}

export function getCampaignRepository(): InMemoryRepository<Campaign> {
  if (!campaignRepo) {
    campaignRepo = new InMemoryRepository<Campaign>();
  }
  return campaignRepo;
}

export function getMaterialRepository(): InMemoryRepository<Material> {
  if (!materialRepo) {
    materialRepo = new InMemoryRepository<Material>();
  }
  return materialRepo;
}

export function getChannelRepository(): InMemoryRepository<Channel> {
  if (!channelRepo) {
    channelRepo = new InMemoryRepository<Channel>();
  }
  return channelRepo;
}

export function getBindingRepository(): InMemoryRepository<MaterialBinding> {
  if (!bindingRepo) {
    bindingRepo = new InMemoryRepository<MaterialBinding>();
  }
  return bindingRepo;
}

export function getTransactionRepository(): TransactionRepository {
  if (!transactionRepo) {
    transactionRepo = new TransactionRepository();
  }
  return transactionRepo;
}

export function getAuditLogRepository(): InMemoryRepository<AuditLogEntry> {
  if (!auditLogRepo) {
    auditLogRepo = new InMemoryRepository<AuditLogEntry>();
  }
  return auditLogRepo;
}

export function resetAllRepositories(): void {
  budgetPoolRepo = null;
  campaignRepo = null;
  materialRepo = null;
  channelRepo = null;
  bindingRepo = null;
  transactionRepo = null;
  auditLogRepo = null;
}
