const { getDb } = require('./database');
const { v4: uuidv4 } = require('uuid');
const { withLock } = require('./lockManager');
const { getContractById } = require('./contractService');

const createRenewalRequest = async (contractId, data) => {
  const { requested_end_date, new_rent } = data;

  return withLock('contract_renewal', contractId, () => {
    const db = getDb();
    const contract = db.prepare(`SELECT * FROM contracts WHERE id = ?`).get(contractId);
    if (!contract) throw new Error('合同不存在');

    const pendingRequest = db.prepare(`
      SELECT 1 FROM renewal_requests WHERE contract_id = ? AND status = 'pending'
    `).get(contractId);

    if (pendingRequest) throw new Error('已有待审批的续签申请');

    const requestId = uuidv4();
    db.prepare(`
      INSERT INTO renewal_requests (id, contract_id, requested_end_date, new_rent, status)
      VALUES (?, ?, ?, ?, 'pending')
    `).run(requestId, contractId, requested_end_date, new_rent || null);

    return getRenewalRequestById(requestId);
  });
};

const getRenewalRequestById = (requestId) => {
  const db = getDb();
  return db.prepare(`SELECT * FROM renewal_requests WHERE id = ?`).get(requestId);
};

const listRenewalRequests = (contractId) => {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM renewal_requests WHERE contract_id = ? ORDER BY created_at DESC
  `).all(contractId);
};

const approveRenewal = async (requestId, approvedBy) => {
  return withLock('contract_renewal', requestId, () => {
    const db = getDb();
    const request = db.prepare(`SELECT * FROM renewal_requests WHERE id = ?`).get(requestId);
    if (!request) throw new Error('续签申请不存在');
    if (request.status !== 'pending') throw new Error('只能审批待审批状态的申请');

    const contract = db.prepare(`SELECT * FROM contracts WHERE id = ?`).get(request.contract_id);
    if (!contract) throw new Error('合同不存在');

    const currentVersion = db.prepare(`
      SELECT * FROM contract_versions WHERE contract_id = ? AND version = ?
    `).get(request.contract_id, contract.current_version);

    const newVersion = contract.current_version + 1;
    const newTotalRent = request.new_rent || currentVersion.total_rent;

    db.prepare(`UPDATE contracts SET current_version = ? WHERE id = ?`)
      .run(newVersion, request.contract_id);

    db.prepare(`
      INSERT INTO contract_versions (id, contract_id, version, parties, start_date, end_date, total_area, total_rent)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(uuidv4(), request.contract_id, newVersion, currentVersion.parties, currentVersion.start_date, request.requested_end_date, currentVersion.total_area, newTotalRent);

    const landPlots = db.prepare(`
      SELECT * FROM land_plots WHERE contract_id = ? AND version = ?
    `).all(request.contract_id, contract.current_version);

    landPlots.forEach(plot => {
      db.prepare(`
        INSERT INTO land_plots (id, contract_id, version, plot_no, area, location)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(uuidv4(), request.contract_id, newVersion, plot.plot_no, plot.area, plot.location);
    });

    const startYear = new Date(currentVersion.start_date).getFullYear();
    const oldEndYear = new Date(currentVersion.end_date).getFullYear();
    const years = oldEndYear - startYear || 1;
    const rentPerYear = newTotalRent / years;
      
    let currentEnd = new Date(currentVersion.end_date);
    const newEnd = new Date(request.requested_end_date);
    while (currentEnd < newEnd) {
      const nextEnd = new Date(currentEnd);
      nextEnd.setFullYear(nextEnd.getFullYear() + 1);
      if (nextEnd > newEnd) nextEnd.setTime(newEnd.getTime());
      db.prepare(`
        INSERT INTO rent_plans (id, contract_id, version, period_start, period_end, amount, status)
        VALUES (?, ?, ?, ?, ?, ?, 'pending')
      `).run(
        uuidv4(), 
        request.contract_id, 
        newVersion, 
        currentEnd.toISOString().split('T')[0], 
        nextEnd.toISOString().split('T')[0], 
        rentPerYear
      );
      currentEnd = nextEnd;
    }

    db.prepare(`
      INSERT INTO performance_records (id, contract_id, version, rent_paid, rent_due, area_confirmed, status)
      VALUES (?, ?, ?, 0, ?, ?, 'normal')
    `).run(uuidv4(), request.contract_id, newVersion, newTotalRent, currentVersion.total_area);

    db.prepare(`
      UPDATE renewal_requests SET status = 'approved', approved_by = ?, approved_at = ?
      WHERE id = ?
    `).run(approvedBy, new Date().toISOString(), requestId);

    return {
      success: true,
      request_id: requestId,
      contract: getContractById(request.contract_id)
    };
  });
};

const rejectRenewal = async (requestId, reason) => {
  return withLock('contract_renewal', requestId, () => {
    const db = getDb();
    db.prepare(`UPDATE renewal_requests SET status = 'rejected' WHERE id = ?`).run(requestId);
    return { success: true, request_id: requestId, status: 'rejected' };
  });
};

const createBreachReminder = async (contractId, type, description) => {
  return withLock('contract_breach', contractId, () => {
    const db = getDb();
    const reminderId = uuidv4();
    db.prepare(`
      INSERT INTO breach_reminders (id, contract_id, type, description, is_resolved)
      VALUES (?, ?, ?, ?, 0)
    `).run(reminderId, contractId, type, description);

    const performance = db.prepare(`
      SELECT * FROM performance_records WHERE contract_id = ? AND version = (SELECT current_version FROM contracts WHERE id = ?)
    `).get(contractId, contractId);

    if (performance) {
      db.prepare(`UPDATE performance_records SET status = 'breach' WHERE id = ?`).run(performance.id);
    }

    return {
      id: reminderId,
      contract_id: contractId,
      type,
      description
    };
  });
};

const listBreachReminders = (contractId) => {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM breach_reminders WHERE contract_id = ? ORDER BY created_at DESC
  `).all(contractId);
};

const resolveBreachReminder = async (reminderId) => {
  return withLock('contract_breach', reminderId, () => {
    const db = getDb();
    db.prepare(`
      UPDATE breach_reminders SET is_resolved = 1, resolved_at = ? WHERE id = ?
    `).run(new Date().toISOString(), reminderId);

    const reminder = db.prepare(`SELECT * FROM breach_reminders WHERE id = ?`).get(reminderId);

    const unresolved = db.prepare(`
      SELECT 1 FROM breach_reminders WHERE contract_id = ? AND is_resolved = 0
    `).get(reminder.contract_id);

    if (!unresolved) {
      const performance = db.prepare(`
        SELECT * FROM performance_records WHERE contract_id = ? AND version = (SELECT current_version FROM contracts WHERE id = ?)
      `).get(reminder.contract_id, reminder.contract_id);

      if (performance && performance.rent_due === 0) {
        db.prepare(`UPDATE performance_records SET status = 'normal' WHERE id = ?`).run(performance.id);
      }
    }

    return { success: true, reminder_id: reminderId };
  });
};

const exportPerformance = (contractId) => {
  const db = getDb();
  const contract = getContractById(contractId);
  if (!contract) return null;

  const versions = db.prepare(`
    SELECT pr.*, cv.start_date, cv.end_date, cv.total_area, cv.total_rent
    FROM performance_records pr
    JOIN contract_versions cv ON pr.contract_id = cv.contract_id AND pr.version = cv.version
    WHERE pr.contract_id = ?
    ORDER BY pr.version DESC
  `).all(contractId);

  const rentPlans = db.prepare(`
    SELECT * FROM rent_plans WHERE contract_id = ? AND version = ?
  `).all(contractId, contract.current_version);

  const breaches = db.prepare(`
    SELECT * FROM breach_reminders WHERE contract_id = ?
  `).all(contractId);

  const renewals = db.prepare(`
    SELECT * FROM renewal_requests WHERE contract_id = ?
  `).all(contractId);

  return {
    contract,
    performance_history: versions,
    rent_status: {
      total_rent: contract.total_rent,
      paid_rent: versions[0]?.rent_paid || 0,
      due_rent: versions[0]?.rent_due || 0,
      plans: rentPlans.map(p => ({
        period: `${p.period_start} ~ ${p.period_end}`,
        amount: p.amount,
        status: p.status,
        paid_at: p.paid_at
      }))
    },
    breach_history: breaches,
    renewal_history: renewals,
    export_time: new Date().toISOString()
  };
};

const listPerformanceSummary = () => {
  const db = getDb();
  const contracts = db.prepare(`SELECT * FROM contracts`).all();

  return contracts.map(c => {
    const performance = db.prepare(`
      SELECT pr.* FROM performance_records pr
      JOIN contracts c ON pr.contract_id = c.id AND pr.version = c.current_version
      WHERE pr.contract_id = ?
    `).get(c.id);

    const unpaidCount = db.prepare(`
      SELECT COUNT(*) as count FROM rent_plans 
      WHERE contract_id = ? AND version = ? AND status = 'pending'
    `).get(c.id, c.current_version);

    const breachCount = db.prepare(`
      SELECT COUNT(*) as count FROM breach_reminders
      WHERE contract_id = ? AND is_resolved = 0
    `).get(c.id);

    return {
      contract_id: c.id,
      contract_no: c.contract_no,
      status: c.status,
      performance_status: performance?.status || 'unknown',
      unpaid_rent_count: unpaidCount?.count || 0,
      unresolved_breach_count: breachCount?.count || 0,
      total_area: performance?.area_confirmed || 0,
      rent_paid: performance?.rent_paid || 0
    };
  });
};

module.exports = {
  createRenewalRequest,
  getRenewalRequestById,
  listRenewalRequests,
  approveRenewal,
  rejectRenewal,
  createBreachReminder,
  listBreachReminders,
  resolveBreachReminder,
  exportPerformance,
  listPerformanceSummary
};
