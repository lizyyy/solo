import { storage } from '../storage';
import { BlacklistEntry, BlacklistReason } from '../models/types';
import { logger, maskObject, normalizePlateNumber } from '../utils';

export interface AddToBlacklistParams {
  name: string;
  phone?: string;
  idCard?: string;
  plateNumber?: string;
  reason: BlacklistReason;
  reasonDetail?: string;
  addedBy: string;
  expiresAt?: string;
}

export class BlacklistService {
  add(params: AddToBlacklistParams): BlacklistEntry {
    const entry = storage.blacklist.create({
      name: params.name,
      phone: params.phone,
      idCard: params.idCard,
      plateNumber: params.plateNumber,
      reason: params.reason,
      reasonDetail: params.reasonDetail,
      addedBy: params.addedBy,
      addedAt: new Date().toISOString(),
      expiresAt: params.expiresAt,
      isActive: true
    } as BlacklistEntry);

    logger.audit('添加黑名单', {
      blacklistId: entry.id,
      addedBy: params.addedBy,
      name: params.name,
      reason: params.reason
    });

    return maskObject(entry);
  }

  remove(id: string, operator: string): boolean {
    const entry = storage.blacklist.findById(id);
    if (!entry) {
      return false;
    }

    const result = storage.blacklist.update(id, { isActive: false });

    logger.audit('移除黑名单', {
      blacklistId: id,
      operator,
      name: entry.name
    });

    return !!result;
  }

  getById(id: string): BlacklistEntry | undefined {
    const entry = storage.blacklist.findById(id);
    return entry ? maskObject(entry) : undefined;
  }

  getAll(): BlacklistEntry[] {
    const entries = storage.blacklist.findMany(b => b.isActive);
    return entries.map(e => maskObject(e));
  }

  verify(phone?: string, plateNumber?: string, idCard?: string): {
    blocked: boolean;
    entry?: BlacklistEntry;
    reason: string;
  } {
    const activeEntries = storage.blacklist.findMany(b => b.isActive);

    for (const entry of activeEntries) {
      if (entry.expiresAt && new Date(entry.expiresAt) < new Date()) {
        continue;
      }

      if (phone && entry.phone === phone) {
        return {
          blocked: true,
          entry: maskObject(entry),
          reason: `手机号在黑名单中: ${entry.reason}${entry.reasonDetail ? ` - ${entry.reasonDetail}` : ''}`
        };
      }

      if (plateNumber && entry.plateNumber) {
        const normalizedPlate = normalizePlateNumber(plateNumber);
        const normalizedEntryPlate = normalizePlateNumber(entry.plateNumber);
        if (normalizedPlate === normalizedEntryPlate) {
          return {
            blocked: true,
            entry: maskObject(entry),
            reason: `车牌号在黑名单中: ${entry.reason}${entry.reasonDetail ? ` - ${entry.reasonDetail}` : ''}`
          };
        }
      }

      if (idCard && entry.idCard === idCard) {
        return {
          blocked: true,
          entry: maskObject(entry),
          reason: `身份证在黑名单中: ${entry.reason}${entry.reasonDetail ? ` - ${entry.reasonDetail}` : ''}`
        };
      }
    }

    return { blocked: false, reason: '不在黑名单中' };
  }

  importBatch(
    entries: Omit<AddToBlacklistParams, 'addedBy'>[],
    addedBy: string
  ): { total: number; added: number; skipped: number } {
    let added = 0;
    let skipped = 0;

    for (const entry of entries) {
      const exists = storage.blacklist.exists(b => {
        if (!b.isActive) return false;
        const phoneMatch = entry.phone ? b.phone === entry.phone : false;
        const plateMatch = entry.plateNumber ? b.plateNumber === entry.plateNumber : false;
        const idCardMatch = entry.idCard ? b.idCard === entry.idCard : false;
        return phoneMatch || plateMatch || idCardMatch;
      });

      if (exists) {
        skipped++;
      } else {
        this.add({ ...entry, addedBy });
        added++;
      }
    }

    logger.audit('批量导入黑名单', {
      total: entries.length,
      added,
      skipped,
      operator: addedBy
    });

    return { total: entries.length, added, skipped };
  }
}

export const blacklistService = new BlacklistService();
