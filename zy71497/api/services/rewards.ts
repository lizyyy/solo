import db from "../db/index.js";
import type { StarTransaction, RewardSummary } from "../../shared/types.js";

const getTransactions = (options?: {
  student_id?: number;
  type?: string;
  from?: string;
  to?: string;
}): { transactions: StarTransaction[]; total_count: number } => {
  let sql = "SELECT * FROM star_transactions WHERE 1=1";
  const params: any[] = [];

  if (options?.student_id) {
    sql += " AND student_id = ?";
    params.push(options.student_id);
  }
  if (options?.type) {
    sql += " AND type = ?";
    params.push(options.type);
  }
  if (options?.from) {
    sql += " AND created_at >= ?";
    params.push(`${options.from} 00:00:00`);
  }
  if (options?.to) {
    sql += " AND created_at <= ?";
    params.push(`${options.to} 23:59:59`);
  }

  const countSql = sql.replace("SELECT *", "SELECT COUNT(*) as count");
  const countResult = db
    .prepare(countSql)
    .get(...params) as { count: number };

  sql += " ORDER BY created_at DESC LIMIT 1000";
  const transactions = db.prepare(sql).all(...params) as StarTransaction[];

  return {
    transactions,
    total_count: countResult.count,
  };
};

const getSummary = (): RewardSummary[] => {
  const summary = db
    .prepare(
      `
    SELECT 
      s.id as student_id,
      s.name as student_name,
      COALESCE(SUM(t.amount), 0) as total_stars
    FROM students s
    LEFT JOIN star_transactions t ON s.id = t.student_id
    WHERE s.status = 'active'
    GROUP BY s.id, s.name
    ORDER BY total_stars DESC
  `
    )
    .all() as { student_id: number; student_name: string; total_stars: number }[];

  return summary.map((item, index) => ({
    ...item,
    rank: index + 1,
  }));
};

const getTotalCount = (table: string): number => {
  const result = db
    .prepare(`SELECT COUNT(*) as count FROM ${table}`)
    .get() as { count: number };
  return result.count;
};

export default {
  getTransactions,
  getSummary,
  getTotalCount,
};
