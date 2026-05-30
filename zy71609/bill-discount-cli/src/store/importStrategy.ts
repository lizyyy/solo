import {
  Bill,
  Quote,
  Application,
  CalendarEntry,
  Payment,
  ImportStrategy,
  ConflictRecord,
  ImportResult,
  DataType,
} from '../types';
import { loadStore, saveStore } from './store';

function findExistingBill(bills: Bill[], bill: Bill): Bill | undefined {
  return bills.find((b) => b.billNo === bill.billNo);
}

function findExistingQuote(quotes: Quote[], quote: Quote): Quote | undefined {
  return quotes.find(
    (q) =>
      q.bankName === quote.bankName &&
      q.billType === quote.billType &&
      q.version === quote.version
  );
}

function findExistingApplication(apps: Application[], app: Application): Application | undefined {
  return apps.find((a) => a.appId === app.appId);
}

function findExistingCalendar(entries: CalendarEntry[], entry: CalendarEntry): CalendarEntry | undefined {
  return entries.find((c) => c.date === entry.date);
}

function findExistingPayment(payments: Payment[], payment: Payment): Payment | undefined {
  return payments.find((p) => p.paymentId === payment.paymentId);
}

function buildConflict(
  dataType: string,
  key: string,
  fieldName: string,
  existingVal: string,
  newVal: string,
  strategy: ImportStrategy
): ConflictRecord {
  return {
    key,
    dataType,
    fieldName,
    existingValue: existingVal,
    newValue: newVal,
    strategy,
    resolved: strategy !== 'conflict',
  };
}

function diffRecords(
  existing: Record<string, any>,
  incoming: Record<string, any>,
  key: string,
  dataType: string,
  strategy: ImportStrategy
): { changed: boolean; conflicts: ConflictRecord[] } {
  const conflicts: ConflictRecord[] = [];
  let changed = false;
  const ignoreFields = new Set(['createdAt', 'updatedAt']);

  for (const field of Object.keys(incoming)) {
    if (ignoreFields.has(field)) continue;
    const exVal = String(existing[field] ?? '');
    const newVal = String(incoming[field] ?? '');
    if (exVal !== newVal) {
      changed = true;
      if (strategy === 'conflict') {
        conflicts.push(buildConflict(dataType, key, field, exVal, newVal, 'conflict'));
      }
    }
  }
  return { changed, conflicts };
}

export function importWithStrategy(
  dataType: DataType,
  records: any[],
  strategy: ImportStrategy,
  onConflict?: (conflict: ConflictRecord) => ImportStrategy
): ImportResult {
  const store = loadStore();
  const now = new Date().toISOString();
  const result: ImportResult = {
    dataType,
    total: records.length,
    inserted: 0,
    skipped: 0,
    updated: 0,
    conflicts: [],
    timestamp: now,
  };

  if (dataType === 'bills') {
    const bills = records as Bill[];
    const existing = store.bills;
    const newBills: Bill[] = [...existing];

    for (const bill of bills) {
      bill.updatedAt = now;
      const found = findExistingBill(existing, bill);
      if (!found) {
        bill.createdAt = now;
        newBills.push(bill);
        result.inserted++;
      } else {
        const { changed, conflicts } = diffRecords(
          found as unknown as Record<string, any>,
          bill as unknown as Record<string, any>,
          bill.billNo,
          dataType,
          strategy
        );
        if (!changed) {
          result.skipped++;
          continue;
        }
        if (strategy === 'skip') {
          result.skipped++;
        } else if (strategy === 'update') {
          const idx = newBills.findIndex((b) => b.billNo === bill.billNo);
          bill.createdAt = found.createdAt;
          newBills[idx] = bill;
          result.updated++;
        } else {
          let resolved = false;
          if (onConflict) {
            const userStrategy = onConflict(conflicts[0]);
            if (userStrategy === 'update') {
              const idx = newBills.findIndex((b) => b.billNo === bill.billNo);
              bill.createdAt = found.createdAt;
              newBills[idx] = bill;
              result.updated++;
              resolved = true;
            } else if (userStrategy === 'skip') {
              result.skipped++;
              resolved = true;
            }
          }
          if (!resolved) {
            result.conflicts.push(...conflicts);
          }
        }
      }
    }
    store.bills = newBills;
  } else if (dataType === 'quotes') {
    const quotes = records as Quote[];
    const existing = store.quotes;
    const newQuotes: Quote[] = [...existing];

    for (const quote of quotes) {
      quote.createdAt = now;
      const found = findExistingQuote(existing, quote);
      if (!found) {
        newQuotes.push(quote);
        result.inserted++;
      } else {
        const { changed, conflicts } = diffRecords(
          found as unknown as Record<string, any>,
          quote as unknown as Record<string, any>,
          `${quote.bankName}-${quote.billType}-v${quote.version}`,
          dataType,
          strategy
        );
        if (!changed) {
          result.skipped++;
          continue;
        }
        if (strategy === 'skip') {
          result.skipped++;
        } else if (strategy === 'update') {
          const idx = newQuotes.findIndex(
            (q) =>
              q.bankName === quote.bankName &&
              q.billType === quote.billType &&
              q.version === quote.version
          );
          newQuotes[idx] = quote;
          result.updated++;
        } else {
          result.conflicts.push(...conflicts);
        }
      }
    }
    store.quotes = newQuotes;
  } else if (dataType === 'applications') {
    const apps = records as Application[];
    const existing = store.applications;
    const newApps: Application[] = [...existing];

    for (const app of apps) {
      app.updatedAt = now;
      const found = findExistingApplication(existing, app);
      if (!found) {
        app.createdAt = now;
        newApps.push(app);
        result.inserted++;
      } else {
        const { changed, conflicts } = diffRecords(
          found as unknown as Record<string, any>,
          app as unknown as Record<string, any>,
          app.appId,
          dataType,
          strategy
        );
        if (!changed) {
          result.skipped++;
          continue;
        }
        if (strategy === 'skip') {
          result.skipped++;
        } else if (strategy === 'update') {
          const idx = newApps.findIndex((a) => a.appId === app.appId);
          app.createdAt = found.createdAt;
          newApps[idx] = app;
          result.updated++;
        } else {
          let resolved = false;
          if (onConflict) {
            const userStrategy = onConflict(conflicts[0]);
            if (userStrategy === 'update') {
              const idx = newApps.findIndex((a) => a.appId === app.appId);
              app.createdAt = found.createdAt;
              newApps[idx] = app;
              result.updated++;
              resolved = true;
            } else if (userStrategy === 'skip') {
              result.skipped++;
              resolved = true;
            }
          }
          if (!resolved) {
            result.conflicts.push(...conflicts);
          }
        }
      }
    }
    store.applications = newApps;
  } else if (dataType === 'calendar') {
    const entries = records as CalendarEntry[];
    const existing = store.calendar;
    const newCalendar: CalendarEntry[] = [...existing];

    for (const entry of entries) {
      const found = findExistingCalendar(existing, entry);
      if (!found) {
        newCalendar.push(entry);
        result.inserted++;
      } else {
        const { changed, conflicts } = diffRecords(
          found as unknown as Record<string, any>,
          entry as unknown as Record<string, any>,
          entry.date,
          dataType,
          strategy
        );
        if (!changed) {
          result.skipped++;
          continue;
        }
        if (strategy === 'skip') {
          result.skipped++;
        } else if (strategy === 'update') {
          const idx = newCalendar.findIndex((c) => c.date === entry.date);
          newCalendar[idx] = entry;
          result.updated++;
        } else {
          result.conflicts.push(...conflicts);
        }
      }
    }
    store.calendar = newCalendar;
  } else if (dataType === 'payments') {
    const payments = records as Payment[];
    const existing = store.payments;
    const newPayments: Payment[] = [...existing];

    for (const payment of payments) {
      payment.createdAt = now;
      const found = findExistingPayment(existing, payment);
      if (!found) {
        newPayments.push(payment);
        result.inserted++;
      } else {
        const { changed, conflicts } = diffRecords(
          found as unknown as Record<string, any>,
          payment as unknown as Record<string, any>,
          payment.paymentId,
          dataType,
          strategy
        );
        if (!changed) {
          result.skipped++;
          continue;
        }
        if (strategy === 'skip') {
          result.skipped++;
        } else if (strategy === 'update') {
          const idx = newPayments.findIndex((p) => p.paymentId === payment.paymentId);
          newPayments[idx] = payment;
          result.updated++;
        } else {
          result.conflicts.push(...conflicts);
        }
      }
    }
    store.payments = newPayments;
  }

  store.importHistory.push(result);
  saveStore(store);
  return result;
}
