import db from "../db/index.js";
import rewardRulesService from "./rewardRules.js";
import type { Checkin, StarTransaction } from "../../shared/types.js";

const getByDate = (date: string): Checkin[] => {
  const checkins = db
    .prepare(
      `
    SELECT * FROM checkins WHERE date = ?
  `
    )
    .all(date) as Checkin[];
  return checkins.map((c) => ({
    ...c,
    is_abnormal: Boolean(c.is_abnormal),
    confirmed: Boolean(c.confirmed),
  }));
};

const getById = (id: number): (Checkin & { student_name: string }) | undefined => {
  const checkin = db
    .prepare(
      `
    SELECT c.*, s.name as student_name
    FROM checkins c
    JOIN students s ON c.student_id = s.id
    WHERE c.id = ?
  `
    )
    .get(id) as (Checkin & { student_name: string }) | undefined;
  if (checkin) {
    return {
      ...checkin,
      is_abnormal: Boolean(checkin.is_abnormal),
      confirmed: Boolean(checkin.confirmed),
    };
  }
  return checkin;
};

const batchUpsert = (
  date: string,
  records: {
    student_id: number;
    duration_minutes: number;
    parent_note?: string;
  }[]
): { checkins: Checkin[]; warnings: { student_id: number; reason: string }[] } => {
  const abnormalThreshold = rewardRulesService.getRuleValue("abnormal_threshold");
  const warnings: { student_id: number; reason: string }[] = [];

  const upsertStmt = db.prepare(`
    INSERT INTO checkins (student_id, date, duration_minutes, parent_note, is_abnormal, confirmed, stars_earned)
    VALUES (?, ?, ?, ?, ?, 0, 0)
    ON CONFLICT(student_id, date) DO UPDATE SET
      duration_minutes = excluded.duration_minutes,
      parent_note = excluded.parent_note,
      is_abnormal = excluded.is_abnormal,
      updated_at = datetime('now', 'localtime')
  `);

  const transaction = db.transaction((recs) => {
    for (const rec of recs) {
      const isAbnormal = rec.duration_minutes > abnormalThreshold;
      if (isAbnormal) {
        warnings.push({
          student_id: rec.student_id,
          reason: `时长 ${rec.duration_minutes} 分钟超过阈值 ${abnormalThreshold} 分钟`,
        });
      }
      upsertStmt.run(
        rec.student_id,
        date,
        rec.duration_minutes,
        rec.parent_note || "",
        isAbnormal ? 1 : 0
      );
    }
  });

  transaction(records);
  return { checkins: getByDate(date), warnings };
};

const confirm = (id: number): { checkin: Checkin; starTransaction: StarTransaction } | null => {
  const checkin = getById(id);
  if (!checkin || checkin.confirmed) return null;

  const starsPerMinute = rewardRulesService.getRuleValue("stars_per_minute");
  const starsEarned = Math.floor(checkin.duration_minutes * starsPerMinute);

  const updateCheckinStmt = db.prepare(`
    UPDATE checkins 
    SET confirmed = 1, stars_earned = ?, updated_at = datetime('now', 'localtime')
    WHERE id = ?
  `);

  const insertTransactionStmt = db.prepare(`
    INSERT INTO star_transactions (student_id, amount, type, reference_id, reference_type, note)
    VALUES (?, ?, 'checkin_earn', ?, 'checkin', ?)
  `);

  const updateStudentStmt = db.prepare(`
    UPDATE students 
    SET total_stars = total_stars + ?, updated_at = datetime('now', 'localtime')
    WHERE id = ?
  `);

  const transaction = db.transaction(() => {
    updateCheckinStmt.run(starsEarned, id);
    const txResult = insertTransactionStmt.run(
      checkin.student_id,
      starsEarned,
      id,
      checkin.is_abnormal ? `(时长异常) ${checkin.duration_minutes}分钟` : `${checkin.duration_minutes}分钟`
    );
    updateStudentStmt.run(starsEarned, checkin.student_id);
    return txResult;
  });

  const txResult = transaction();

  const starTransaction = db
    .prepare("SELECT * FROM star_transactions WHERE id = ?")
    .get(Number(txResult.lastInsertRowid)) as StarTransaction;

  const updatedCheckin = {
    ...checkin,
    confirmed: true,
    stars_earned: starsEarned,
  };

  return { checkin: updatedCheckin, starTransaction };
};

export default {
  getByDate,
  getById,
  batchUpsert,
  confirm,
};
