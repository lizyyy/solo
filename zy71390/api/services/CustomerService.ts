import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index.js';
import { ModificationService } from './ModificationService.js';
import type { Customer, Tier, AddWhitelistRequest } from '../../shared/types.js';

export class CustomerService {
  static getCustomers(): Customer[] {
    const stmt = db.prepare(`
      SELECT id, name, tier, priority, isWhitelisted, whitelistExpiresAt, whitelistReason, totalRequests, blockedCount, createdAt, updatedAt
      FROM customers
      ORDER BY priority DESC, name ASC
    `);

    const rows = stmt.all() as Array<{
      id: string;
      name: string;
      tier: string;
      priority: number;
      isWhitelisted: number;
      whitelistExpiresAt?: string;
      whitelistReason?: string;
      totalRequests: number;
      blockedCount: number;
      createdAt: string;
      updatedAt: string;
    }>;

    return rows.map(row => ({
      ...row,
      tier: row.tier as Tier,
      isWhitelisted: row.isWhitelisted === 1
    }));
  }

  private static getCustomerById(id: string): Customer | null {
    const stmt = db.prepare(`
      SELECT id, name, tier, priority, isWhitelisted, whitelistExpiresAt, whitelistReason, totalRequests, blockedCount, createdAt, updatedAt
      FROM customers
      WHERE id = ?
    `);

    const row = stmt.get(id) as {
      id: string;
      name: string;
      tier: string;
      priority: number;
      isWhitelisted: number;
      whitelistExpiresAt?: string;
      whitelistReason?: string;
      totalRequests: number;
      blockedCount: number;
      createdAt: string;
      updatedAt: string;
    } | undefined;

    if (!row) return null;

    return {
      ...row,
      tier: row.tier as Tier,
      isWhitelisted: row.isWhitelisted === 1
    };
  }

  static updateCustomerTier(customerId: string, tier: Tier, reason: string, modifiedBy: string): Customer | null {
    const customer = this.getCustomerById(customerId);
    if (!customer) return null;

    const now = new Date().toISOString();

    const stmt = db.prepare(`
      UPDATE customers
      SET tier = ?, updatedAt = ?
      WHERE id = ?
    `);

    stmt.run(tier, now, customerId);

    ModificationService.logModification(
      'customer',
      customerId,
      'tier',
      customer.tier,
      tier,
      reason,
      modifiedBy
    );

    return this.getCustomerById(customerId);
  }

  static getWhitelist(): Customer[] {
    const stmt = db.prepare(`
      SELECT id, name, tier, priority, isWhitelisted, whitelistExpiresAt, whitelistReason, totalRequests, blockedCount, createdAt, updatedAt
      FROM customers
      WHERE isWhitelisted = 1
      ORDER BY priority DESC, name ASC
    `);

    const rows = stmt.all() as Array<{
      id: string;
      name: string;
      tier: string;
      priority: number;
      isWhitelisted: number;
      whitelistExpiresAt?: string;
      whitelistReason?: string;
      totalRequests: number;
      blockedCount: number;
      createdAt: string;
      updatedAt: string;
    }>;

    return rows.map(row => ({
      ...row,
      tier: row.tier as Tier,
      isWhitelisted: row.isWhitelisted === 1
    }));
  }

  static addToWhitelist(data: AddWhitelistRequest, modifiedBy: string): Customer | null {
    const customer = this.getCustomerById(data.customerId);
    if (!customer) return null;

    const now = new Date().toISOString();

    const stmt = db.prepare(`
      UPDATE customers
      SET isWhitelisted = 1, whitelistExpiresAt = ?, whitelistReason = ?, updatedAt = ?
      WHERE id = ?
    `);

    stmt.run(data.expiresAt ?? null, data.reason, now, data.customerId);

    ModificationService.logModification(
      'whitelist',
      data.customerId,
      'isWhitelisted',
      'false',
      'true',
      data.reason,
      modifiedBy
    );

    if (data.expiresAt) {
      ModificationService.logModification(
        'whitelist',
        data.customerId,
        'whitelistExpiresAt',
        customer.whitelistExpiresAt ?? '',
        data.expiresAt,
        data.reason,
        modifiedBy
      );
    }

    return this.getCustomerById(data.customerId);
  }

  static removeFromWhitelist(id: string, reason: string, modifiedBy: string): Customer | null {
    const customer = this.getCustomerById(id);
    if (!customer) return null;

    const now = new Date().toISOString();

    const stmt = db.prepare(`
      UPDATE customers
      SET isWhitelisted = 0, whitelistExpiresAt = NULL, whitelistReason = NULL, updatedAt = ?
      WHERE id = ?
    `);

    stmt.run(now, id);

    ModificationService.logModification(
      'whitelist',
      id,
      'isWhitelisted',
      'true',
      'false',
      reason,
      modifiedBy
    );

    return this.getCustomerById(id);
  }
}

export default CustomerService;
