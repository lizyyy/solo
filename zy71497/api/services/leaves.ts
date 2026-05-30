import db from "../db/index.js";
import rewardRulesService from "./rewardRules.js";
import type { Leave, Makeup, StarTransaction } from "../../shared/types.js";

const getAll = (options?: { student_id?: number; month?: string }): Leave[] => {
  let sql = `
    SELECT l.id, l.student_id, l.date, l.reason, l.stars_deducted, l.created_at, l.updated_at,
      CASE WHEN m.id IS NOT NULL THEN 1 ELSE 0 END as has_makeup_num
    FROM leaves l
    LEFT JOIN makeups m ON l.id = m.leave_id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (options?.student_id) {
    sql += " AND l.student_id = ?";
    params.push(options.student_id);
  }
  if (options?.month) {
    sql += " AND l.date LIKE ?";
    params.push(`${options.month}%`);
  }

  sql += " ORDER BY l.date DESC";

  type LeaveRow = {
    id: number;
    student_id: number;
    date: string;
    reason: string;
    stars_deducted: number;
    created_at: string;
    updated_at: string;
    has_makeup_num: number;
  };

  const leaves = db.prepare(sql).all(...params) as LeaveRow[];
  return leaves.map((l) => ({
    id: l.id,
    student_id: l.student_id,
    date: l.date,
    reason: l.reason,
    stars_deducted: l.stars_deducted,
    has_makeup: Boolean(l.has_makeup_num),
  }));
};

const getById = (id: number): (Leave & { student_name: string }) | undefined => {
  type LeaveRow = {
    id: number;
    student_id: number;
    date: string;
    reason: string;
    stars_deducted: number;
    created_at: string;
    updated_at: string;
    student_name: string;
    has_makeup_num: number;
  };

  const leave = db
    .prepare(
      `
    SELECT l.id, l.student_id, l.date, l.reason, l.stars_deducted, l.created_at, l.updated_at, 
      s.name as student_name,
      CASE WHEN m.id IS NOT NULL THEN 1 ELSE 0 END as has_makeup_num
    FROM leaves l
    JOIN students s ON l.student_id = s.id
    LEFT JOIN makeups m ON l.id = m.leave_id
    WHERE l.id = ?
  `
    )
    .get(id) as LeaveRow | undefined;

  if (!leave) return undefined;
  return {
    id: leave.id,
    student_id: leave.student_id,
    date: leave.date,
    reason: leave.reason,
    stars_deducted: leave.stars_deducted,
    has_makeup: Boolean(leave.has_makeup_num),
    student_name: leave.student_name,
  };
};

const create = (data: {
  student_id: number;
  date: string;
  reason: string;
}): { leave: Leave; starTransaction: StarTransaction } => {
  const deduction = Math.floor(rewardRulesService.getRuleValue("leave_deduction"));

  const insertLeaveStmt = db.prepare(`
    INSERT INTO leaves (student_id, date, reason, stars_deducted)
    VALUES (?, ?, ?, ?)
  `);

  const insertTransactionStmt = db.prepare(`
    INSERT INTO star_transactions (student_id, amount, type, reference_id, reference_type, note)
    VALUES (?, ?, 'leave_deduct', ?, 'leave', ?)
  `);

  const updateStudentStmt = db.prepare(`
    UPDATE students 
    SET total_stars = total_stars + ?, updated_at = datetime('now', 'localtime')
    WHERE id = ?
  `);

  const transaction = db.transaction(() => {
    const leaveResult = insertLeaveStmt.run(
      data.student_id,
      data.date,
      data.reason,
      -deduction
    );
    insertTransactionStmt.run(
      data.student_id,
      -deduction,
      leaveResult.lastInsertRowid,
      `请假扣除: ${data.reason}`
    );
    updateStudentStmt.run(-deduction, data.student_id);
    return leaveResult.lastInsertRowid;
  });

  const leaveId = transaction();
  const leave = getById(Number(leaveId))!;

  const starTransaction = db
    .prepare(
      "SELECT * FROM star_transactions WHERE reference_id = ? AND reference_type = 'leave'"
    )
    .get(leaveId) as StarTransaction;

  return { leave, starTransaction };
};

const checkDuplicateMakeup = (leaveId: number): { is_duplicate: boolean; existing_makeup: Makeup | null } => {
  const makeup = db
    .prepare("SELECT * FROM makeups WHERE leave_id = ?")
    .get(leaveId) as Makeup | undefined;

  return {
    is_duplicate: !!makeup,
    existing_makeup: makeup || null,
  };
};

const createMakeup = (data: {
  leave_id: number;
  makeup_date: string;
  duration_minutes: number;
}): { makeup: Makeup; starTransaction: StarTransaction } | null => {
  const duplicateCheck = checkDuplicateMakeup(data.leave_id);
  if (duplicateCheck.is_duplicate) {
    return null;
  }

  const leave = getById(data.leave_id);
  if (!leave) return null;

  const starsPerMinute = rewardRulesService.getRuleValue("stars_per_minute");
  const returnRate = rewardRulesService.getRuleValue("makeup_return_rate");
  const starsReturned = Math.floor(data.duration_minutes * starsPerMinute * returnRate);

  const insertMakeupStmt = db.prepare(`
    INSERT INTO makeups (leave_id, student_id, makeup_date, duration_minutes, stars_returned)
    VALUES (?, ?, ?, ?, ?)
  `);

  const insertTransactionStmt = db.prepare(`
    INSERT INTO star_transactions (student_id, amount, type, reference_id, reference_type, note)
    VALUES (?, ?, 'makeup_return', ?, 'makeup', ?)
  `);

  const updateStudentStmt = db.prepare(`
    UPDATE students 
    SET total_stars = total_stars + ?, updated_at = datetime('now', 'localtime')
    WHERE id = ?
  `);

  const transaction = db.transaction(() => {
    const makeupResult = insertMakeupStmt.run(
      data.leave_id,
      leave.student_id,
      data.makeup_date,
      data.duration_minutes,
      starsReturned
    );
    insertTransactionStmt.run(
      leave.student_id,
      starsReturned,
      makeupResult.lastInsertRowid,
      `补练返还: 原请假日期 ${leave.date}, 补练时长 ${data.duration_minutes}分钟`
    );
    updateStudentStmt.run(starsReturned, leave.student_id);
    return makeupResult.lastInsertRowid;
  });

  const makeupId = transaction();

  const makeup = db
    .prepare("SELECT * FROM makeups WHERE id = ?")
    .get(makeupId) as Makeup;

  const starTransaction = db
    .prepare(
      "SELECT * FROM star_transactions WHERE reference_id = ? AND reference_type = 'makeup'"
    )
    .get(makeupId) as StarTransaction;

  return { makeup, starTransaction };
};

const getMakeups = (studentId?: number): Makeup[] => {
  let sql = "SELECT * FROM makeups";
  const params: any[] = [];

  if (studentId) {
    sql += " WHERE student_id = ?";
    params.push(studentId);
  }

  sql += " ORDER BY makeup_date DESC";
  return db.prepare(sql).all(...params) as Makeup[];
};

export default {
  getAll,
  getById,
  create,
  checkDuplicateMakeup,
  createMakeup,
  getMakeups,
};
