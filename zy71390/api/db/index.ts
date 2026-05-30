import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { ALL_DDL_STATEMENTS } from './schema.js';
import {
  customers,
  whitelistEntries,
  rateLimitRules,
  ruleVersions,
  requestLogs,
  drillReports,
  modificationLogs,
} from './seed.js';
import type {
  RateLimitRule,
  RuleVersion,
  Customer,
  RequestLog,
  DrillReport,
  ModificationLog,
} from '../../shared/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.resolve(__dirname, '../../data/app.db');

export const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initDatabase(): void {
  const transaction = db.transaction(() => {
    for (const ddl of ALL_DDL_STATEMENTS) {
      db.exec(ddl);
    }
  });

  try {
    transaction();
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw error;
  }
}

export function seedDatabase(): void {
  const transaction = db.transaction(() => {
    const insertCustomer = db.prepare(`
      INSERT OR REPLACE INTO customers (
        id, name, tier, priority, isWhitelisted, whitelistExpiresAt,
        whitelistReason, totalRequests, blockedCount, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const customer of customers as Customer[]) {
      insertCustomer.run(
        customer.id,
        customer.name,
        customer.tier,
        customer.priority,
        customer.isWhitelisted ? 1 : 0,
        customer.whitelistExpiresAt || null,
        customer.whitelistReason || null,
        customer.totalRequests,
        customer.blockedCount,
        customer.createdAt,
        customer.updatedAt
      );
    }

    const insertWhitelist = db.prepare(`
      INSERT OR REPLACE INTO whitelist (
        id, customerId, customerName, reason, expiresAt, createdBy, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    for (const entry of whitelistEntries) {
      insertWhitelist.run(
        entry.id,
        entry.customerId,
        entry.customerName,
        entry.reason,
        entry.expiresAt,
        entry.createdBy,
        entry.createdAt
      );
    }

    const insertRule = db.prepare(`
      INSERT OR REPLACE INTO rules (
        id, name, path, method, windowSize, "limit", tier, status,
        currentVersion, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const rule of rateLimitRules as RateLimitRule[]) {
      insertRule.run(
        rule.id,
        rule.name,
        rule.path,
        rule.method,
        rule.windowSize,
        rule.limit,
        rule.tier,
        rule.status,
        rule.currentVersion,
        rule.createdAt,
        rule.updatedAt
      );
    }

    const insertRuleVersion = db.prepare(`
      INSERT OR REPLACE INTO rule_versions (
        id, ruleId, version, snapshot, changeReason, modifiedBy, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    for (const version of ruleVersions as RuleVersion[]) {
      insertRuleVersion.run(
        version.id,
        version.ruleId,
        version.version,
        JSON.stringify(version.snapshot),
        version.changeReason,
        version.modifiedBy,
        version.createdAt
      );
    }

    const insertRequestLog = db.prepare(`
      INSERT OR REPLACE INTO request_logs (
        id, customerId, path, method, timestamp, statusCode, latency, userAgent, ip
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const log of requestLogs as RequestLog[]) {
      insertRequestLog.run(
        log.id,
        log.customerId,
        log.path,
        log.method,
        log.timestamp,
        log.statusCode,
        log.latency,
        log.userAgent,
        log.ip
      );
    }

    const insertDrillReport = db.prepare(`
      INSERT OR REPLACE INTO drill_reports (
        id, name, ruleId, ruleName, ruleVersion, startTime, endTime,
        sampleRate, totalRequests, hitCount, blockedCustomers, anomalies,
        hitResults, conclusion, status, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const report of drillReports as DrillReport[]) {
      insertDrillReport.run(
        report.id,
        report.name,
        report.ruleId,
        report.ruleName,
        report.ruleVersion,
        report.startTime,
        report.endTime,
        report.sampleRate,
        report.totalRequests,
        report.hitCount,
        JSON.stringify(report.blockedCustomers),
        JSON.stringify(report.anomalies),
        JSON.stringify(report.hitResults),
        report.conclusion,
        report.status,
        report.createdAt
      );
    }

    const insertModificationLog = db.prepare(`
      INSERT OR REPLACE INTO modification_logs (
        id, entityType, entityId, field, oldValue, newValue, reason, modifiedBy, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const log of modificationLogs as ModificationLog[]) {
      insertModificationLog.run(
        log.id,
        log.entityType,
        log.entityId,
        log.field,
        log.oldValue,
        log.newValue,
        log.reason,
        log.modifiedBy,
        log.createdAt
      );
    }
  });

  try {
    transaction();
    console.log('Database seeded successfully');
    console.log(`  - ${customers.length} customers`);
    console.log(`  - ${whitelistEntries.length} whitelist entries`);
    console.log(`  - ${rateLimitRules.length} rate limit rules`);
    console.log(`  - ${ruleVersions.length} rule versions`);
    console.log(`  - ${requestLogs.length} request logs`);
    console.log(`  - ${drillReports.length} drill reports`);
    console.log(`  - ${modificationLogs.length} modification logs`);
  } catch (error) {
    console.error('Failed to seed database:', error);
    throw error;
  }
}

export function getDb(): Database.Database {
  return db;
}

export function closeDb(): void {
  db.close();
  console.log('Database connection closed');
}

export default db;
