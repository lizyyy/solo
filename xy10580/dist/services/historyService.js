"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addHistory = addHistory;
exports.getHistoryByOrderNo = getHistoryByOrderNo;
exports.getHistoryByAppealId = getHistoryByAppealId;
const database_1 = require("../db/database");
async function addHistory(orderNo, appealId, action, details, operator, fromStatus, toStatus) {
    const history = {
        id: (0, database_1.generateId)(),
        orderNo,
        appealId,
        action,
        operator,
        fromStatus,
        toStatus,
        details,
        createTime: Date.now(),
    };
    const stmt = await (0, database_1.dbPrepare)(`
    INSERT INTO appeal_histories (
      id, order_no, appeal_id, action, operator,
      from_status, to_status, details, create_time
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
    await stmt.run(history.id, history.orderNo, history.appealId, history.action, history.operator, history.fromStatus, history.toStatus, history.details, history.createTime);
}
async function getHistoryByOrderNo(orderNo) {
    const stmt = await (0, database_1.dbPrepare)(`
    SELECT 
      id, order_no as orderNo, appeal_id as appealId,
      action, operator, from_status as fromStatus,
      to_status as toStatus, details, create_time as createTime
    FROM appeal_histories
    WHERE order_no = ?
    ORDER BY create_time ASC
  `);
    const rows = await stmt.all(orderNo);
    return rows;
}
async function getHistoryByAppealId(appealId) {
    const stmt = await (0, database_1.dbPrepare)(`
    SELECT 
      id, order_no as orderNo, appeal_id as appealId,
      action, operator, from_status as fromStatus,
      to_status as toStatus, details, create_time as createTime
    FROM appeal_histories
    WHERE appeal_id = ?
    ORDER BY create_time ASC
  `);
    const rows = await stmt.all(appealId);
    return rows;
}
//# sourceMappingURL=historyService.js.map