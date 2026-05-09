import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import { runQuery, getOne, getAll } from '../utils/db-helpers';
import { ExchangeRateSnapshot } from '../types';

interface ExchangeRateSnapshotRow {
  id: string;
  currency: string;
  buy_rate: number;
  sell_rate: number;
  snapshot_time: string;
  created_at: string;
}

export const exchangeRateService = {
  async createSnapshot(
    currency: string,
    buyRate: number,
    sellRate: number
  ): Promise<ExchangeRateSnapshot> {
    const id = uuidv4();
    const now = dayjs().toISOString();

    await runQuery(
      `INSERT INTO exchange_rate_snapshots (
        id, currency, buy_rate, sell_rate, snapshot_time, created_at
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [id, currency, buyRate, sellRate, now, now]
    );

    return {
      id,
      currency,
      buyRate,
      sellRate,
      snapshotTime: now,
      createdAt: now
    };
  },

  async getLatestSnapshot(currency: string): Promise<ExchangeRateSnapshot | undefined> {
    const row = await getOne<ExchangeRateSnapshotRow>(
      `SELECT * FROM exchange_rate_snapshots 
       WHERE currency = ? 
       ORDER BY snapshot_time DESC 
       LIMIT 1`,
      [currency]
    );

    return row ? this.rowToSnapshot(row) : undefined;
  },

  async getSnapshotById(id: string): Promise<ExchangeRateSnapshot | undefined> {
    const row = await getOne<ExchangeRateSnapshotRow>(
      'SELECT * FROM exchange_rate_snapshots WHERE id = ?',
      [id]
    );

    return row ? this.rowToSnapshot(row) : undefined;
  },

  async getSnapshotsByCurrency(currency: string, limit: number = 10): Promise<ExchangeRateSnapshot[]> {
    const rows = await getAll<ExchangeRateSnapshotRow>(
      `SELECT * FROM exchange_rate_snapshots 
       WHERE currency = ? 
       ORDER BY snapshot_time DESC 
       LIMIT ?`,
      [currency, limit]
    );

    return rows.map(this.rowToSnapshot);
  },

  async seedDefaultRates(): Promise<void> {
    const currencies = [
      { currency: 'USD', buyRate: 7.15, sellRate: 7.25 },
      { currency: 'EUR', buyRate: 7.65, sellRate: 7.75 },
      { currency: 'GBP', buyRate: 8.95, sellRate: 9.05 },
      { currency: 'JPY', buyRate: 0.048, sellRate: 0.052 },
      { currency: 'HKD', buyRate: 0.91, sellRate: 0.93 }
    ];

    for (const rate of currencies) {
      await this.createSnapshot(rate.currency, rate.buyRate, rate.sellRate);
    }
  },

  rowToSnapshot(row: ExchangeRateSnapshotRow): ExchangeRateSnapshot {
    return {
      id: row.id,
      currency: row.currency,
      buyRate: row.buy_rate,
      sellRate: row.sell_rate,
      snapshotTime: row.snapshot_time,
      createdAt: row.created_at
    };
  }
};