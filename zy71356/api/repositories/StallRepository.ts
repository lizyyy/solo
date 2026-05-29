import db from '../db';
import { Stall } from '../../shared/types';
import { BaseRepository } from './BaseRepository';

export class StallRepository extends BaseRepository<Stall> {
  constructor() {
    super('stalls');
  }

  create(stall: Omit<Stall, 'id'>): Stall {
    const id = crypto.randomUUID();
    db.prepare(
      `INSERT INTO stalls (id, name, row, col, max_power, is_entrance, width, height)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      stall.name,
      stall.row,
      stall.col,
      stall.maxPower,
      stall.isEntrance ? 1 : 0,
      stall.width,
      stall.height
    );
    return this.findById(id)!;
  }

  update(id: string, stall: Partial<Omit<Stall, 'id'>>): Stall | undefined {
    const fields: string[] = [];
    const values: any[] = [];

    const snakeStall = this.toSnakeCase(stall);
    for (const [key, value] of Object.entries(snakeStall)) {
      if (key !== 'id') {
        fields.push(`${key} = ?`);
        if (key === 'is_entrance') {
          values.push(value ? 1 : 0);
        } else {
          values.push(value);
        }
      }
    }

    values.push(id);

    db.prepare(
      `UPDATE stalls SET ${fields.join(', ')} WHERE id = ?`
    ).run(...values);

    return this.findById(id);
  }

  findByGrid(row: number, col: number): Stall | undefined {
    const rowData = db
      .prepare(`SELECT * FROM stalls WHERE row = ? AND col = ?`)
      .get(row, col);
    return rowData ? this.toCamelCase(rowData) : undefined;
  }

  findEntranceStalls(): Stall[] {
    const rows = db
      .prepare(`SELECT * FROM stalls WHERE is_entrance = 1`)
      .all();
    return rows.map((row) => this.toCamelCase(row));
  }

  clearAll(): void {
    db.prepare(`DELETE FROM stalls`).run();
  }

  bulkCreate(stalls: Omit<Stall, 'id'>[]): Stall[] {
    const result: Stall[] = [];
    const insert = db.prepare(
      `INSERT INTO stalls (id, name, row, col, max_power, is_entrance, width, height)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );

    const transaction = db.transaction((stallList) => {
      for (const stall of stallList) {
        const id = crypto.randomUUID();
        insert.run(
          id,
          stall.name,
          stall.row,
          stall.col,
          stall.maxPower,
          stall.isEntrance ? 1 : 0,
          stall.width,
          stall.height
        );
        result.push(this.findById(id)!);
      }
    });

    transaction(stalls);
    return result;
  }

  findMaxDimensions(): { maxRow: number; maxCol: number } {
    const result = db
      .prepare(`SELECT MAX(row) as maxRow, MAX(col) as maxCol FROM stalls`)
      .get() as any;
    return {
      maxRow: result.maxRow ?? 0,
      maxCol: result.maxCol ?? 0,
    };
  }
}
