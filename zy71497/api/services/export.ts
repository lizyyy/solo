import db from "../db/index.js";
import rewardsService from "./rewards.js";

const objectToCsv = (data: any[]): string => {
  if (data.length === 0) return "";

  const headers = Object.keys(data[0]);
  const headerLine = headers.join(",");

  const dataLines = data.map((row) =>
    headers
      .map((h) => {
        let value = row[h];
        if (typeof value === "string" && (value.includes(",") || value.includes('"'))) {
          value = `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      })
      .join(",")
  );

  return [headerLine, ...dataLines].join("\n");
};

const exportCheckins = (from: string, to: string) => {
  const checkins = db
    .prepare(
      `
    SELECT 
      c.date,
      s.name as student_name,
      c.duration_minutes,
      c.parent_note,
      CASE WHEN c.is_abnormal = 1 THEN '是' ELSE '否' END as is_abnormal,
      CASE WHEN c.confirmed = 1 THEN '是' ELSE '否' END as confirmed,
      c.stars_earned
    FROM checkins c
    JOIN students s ON c.student_id = s.id
    WHERE c.date >= ? AND c.date <= ?
    ORDER BY c.date DESC, s.name
  `
    )
    .all(from, to);

  return {
    data: objectToCsv(checkins),
    count: checkins.length,
  };
};

const exportTransactions = (from: string, to: string) => {
  const transactions = db
    .prepare(
      `
    SELECT 
      t.created_at as transaction_time,
      s.name as student_name,
      t.amount,
      CASE t.type
        WHEN 'checkin_earn' THEN '打卡获得'
        WHEN 'leave_deduct' THEN '请假扣除'
        WHEN 'makeup_return' THEN '补练返还'
        WHEN 'manual_adjust' THEN '手动调整'
        ELSE t.type
      END as type,
      t.note
    FROM star_transactions t
    JOIN students s ON t.student_id = s.id
    WHERE date(t.created_at) >= ? AND date(t.created_at) <= ?
    ORDER BY t.created_at DESC, s.name
  `
    )
    .all(from, to);

  return {
    data: objectToCsv(transactions),
    count: transactions.length,
  };
};

const exportLeavesMakeups = (from: string, to: string) => {
  const data = db
    .prepare(
      `
    SELECT 
      '请假' as record_type,
      s.name as student_name,
      l.date as record_date,
      l.reason,
      l.stars_deducted as stars_change,
      CASE WHEN m.id IS NOT NULL THEN '已补练' ELSE '未补练' END as makeup_status
    FROM leaves l
    JOIN students s ON l.student_id = s.id
    LEFT JOIN makeups m ON l.id = m.leave_id
    WHERE l.date >= ? AND l.date <= ?
    
    UNION ALL
    
    SELECT 
      '补练' as record_type,
      s.name as student_name,
      m.makeup_date as record_date,
      l.reason as original_leave_reason,
      m.stars_returned as stars_change,
      NULL as makeup_status
    FROM makeups m
    JOIN leaves l ON m.leave_id = l.id
    JOIN students s ON m.student_id = s.id
    WHERE m.makeup_date >= ? AND m.makeup_date <= ?
    
    ORDER BY record_date DESC, record_type, student_name
  `
    )
    .all(from, to, from, to);

  return {
    data: objectToCsv(data),
    count: data.length,
  };
};

export default {
  exportCheckins,
  exportTransactions,
  exportLeavesMakeups,
};
