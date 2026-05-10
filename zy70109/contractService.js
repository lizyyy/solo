const { getDb } = require('./database');
const { v4: uuidv4 } = require('uuid');
const { withLock } = require('./lockManager');

const createContract = async (data) => {
  const { contract_no, parties, start_date, end_date, land_plots, rent_plans } = data;

  return withLock('contract', contract_no, () => {
    const db = getDb();
    const contractId = uuidv4();
    
    db.prepare(`
      INSERT INTO contracts (id, contract_no, current_version, status)
      VALUES (?, ?, 1, 'active')
    `).run(contractId, contract_no);

    const totalArea = land_plots.reduce((sum, plot) => sum + plot.area, 0);
    const totalRent = rent_plans.reduce((sum, plan) => sum + plan.amount, 0);

    db.prepare(`
      INSERT INTO contract_versions (id, contract_id, version, parties, start_date, end_date, total_area, total_rent)
      VALUES (?, ?, 1, ?, ?, ?, ?, ?)
    `).run(uuidv4(), contractId, JSON.stringify(parties), start_date, end_date, totalArea, totalRent);

    land_plots.forEach(plot => {
      db.prepare(`
        INSERT INTO land_plots (id, contract_id, version, plot_no, area, location)
        VALUES (?, ?, 1, ?, ?, ?)
      `).run(uuidv4(), contractId, plot.plot_no, plot.area, plot.location || null);
    });

    rent_plans.forEach(plan => {
      db.prepare(`
        INSERT INTO rent_plans (id, contract_id, version, period_start, period_end, amount, status)
        VALUES (?, ?, 1, ?, ?, ?, 'pending')
      `).run(uuidv4(), contractId, plan.period_start, plan.period_end, plan.amount);
    });

    db.prepare(`
      INSERT INTO performance_records (id, contract_id, version, rent_paid, rent_due, area_confirmed, status)
      VALUES (?, ?, 1, 0, ?, ?, 'normal')
    `).run(uuidv4(), contractId, totalRent, totalArea);

    return getContractById(contractId);
  });
};

const getContractById = (contractId) => {
  const db = getDb();
  const contract = db.prepare(`SELECT * FROM contracts WHERE id = ?`).get(contractId);
  if (!contract) return null;

  const currentVersion = db.prepare(`
    SELECT * FROM contract_versions WHERE contract_id = ? AND version = ?
  `).get(contractId, contract.current_version);

  const landPlots = db.prepare(`
    SELECT * FROM land_plots WHERE contract_id = ? AND version = ?
  `).all(contractId, contract.current_version);

  const rentPlans = db.prepare(`
    SELECT * FROM rent_plans WHERE contract_id = ? AND version = ?
  `).all(contractId, contract.current_version);

  return {
    ...contract,
    parties: JSON.parse(currentVersion.parties),
    start_date: currentVersion.start_date,
    end_date: currentVersion.end_date,
    total_area: currentVersion.total_area,
    total_rent: currentVersion.total_rent,
    land_plots: landPlots,
    rent_plans: rentPlans
  };
};

const getContractByNo = (contractNo) => {
  const db = getDb();
  const contract = db.prepare(`SELECT * FROM contracts WHERE contract_no = ?`).get(contractNo);
  if (!contract) return null;
  return getContractById(contract.id);
};

const updateContract = async (contractId, data) => {
  const { parties, start_date, end_date, land_plots, rent_plans } = data;

  return withLock('contract', contractId, () => {
    const db = getDb();
    const contract = db.prepare(`SELECT * FROM contracts WHERE id = ?`).get(contractId);
    if (!contract) throw new Error('合同不存在');
    if (contract.status !== 'active') throw new Error('只有有效合同才能修改');

    const newVersion = contract.current_version + 1;

    db.prepare(`UPDATE contracts SET current_version = ? WHERE id = ?`)
      .run(newVersion, contractId);

    const totalArea = land_plots.reduce((sum, plot) => sum + plot.area, 0);
    const totalRent = rent_plans.reduce((sum, plan) => sum + plan.amount, 0);

    db.prepare(`
      INSERT INTO contract_versions (id, contract_id, version, parties, start_date, end_date, total_area, total_rent)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(uuidv4(), contractId, newVersion, JSON.stringify(parties), start_date, end_date, totalArea, totalRent);

    land_plots.forEach(plot => {
      db.prepare(`
        INSERT INTO land_plots (id, contract_id, version, plot_no, area, location)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(uuidv4(), contractId, newVersion, plot.plot_no, plot.area, plot.location || null);
    });

    rent_plans.forEach(plan => {
      db.prepare(`
        INSERT INTO rent_plans (id, contract_id, version, period_start, period_end, amount, status)
        VALUES (?, ?, ?, ?, ?, ?, 'pending')
      `).run(uuidv4(), contractId, newVersion, plan.period_start, plan.period_end, plan.amount);
    });

    db.prepare(`
      INSERT INTO performance_records (id, contract_id, version, rent_paid, rent_due, area_confirmed, status)
      VALUES (?, ?, ?, 0, ?, ?, 'normal')
    `).run(uuidv4(), contractId, newVersion, totalRent, totalArea);

    return getContractById(contractId);
  });
};

const payRent = async (contractId, planId, amount) => {
  return withLock('contract_rent', `${contractId}_${planId}`, () => {
    const db = getDb();
    const plan = db.prepare(`
      SELECT * FROM rent_plans WHERE id = ? AND contract_id = ?
    `).get(planId, contractId);

    if (!plan) throw new Error('租金计划不存在');
    if (plan.status === 'paid') throw new Error('该租金已支付，不能重复结算');
    if (amount !== plan.amount) throw new Error(`支付金额必须等于计划金额 ${plan.amount}`);

    db.prepare(`
      UPDATE rent_plans SET status = 'paid', paid_at = ? WHERE id = ?
    `).run(new Date().toISOString(), planId);

    const performance = db.prepare(`
      SELECT * FROM performance_records WHERE contract_id = ? AND version = (SELECT current_version FROM contracts WHERE id = ?)
    `).get(contractId, contractId);

    const newRentPaid = (performance.rent_paid || 0) + amount;
    const newRentDue = (performance.rent_due || 0) - amount;

    let status = 'normal';
    if (newRentDue > 0) {
      const breachCheck = db.prepare(`
        SELECT 1 FROM breach_reminders 
        WHERE contract_id = ? AND type = 'rent_overdue' AND is_resolved = 0
      `).get(contractId);
      
      if (breachCheck) {
        status = 'breach_resolved';
        db.prepare(`
          UPDATE breach_reminders SET is_resolved = 1, resolved_at = ?
          WHERE contract_id = ? AND type = 'rent_overdue' AND is_resolved = 0
        `).run(new Date().toISOString(), contractId);
      }
    }

    db.prepare(`
      UPDATE performance_records SET rent_paid = ?, rent_due = ?, status = ?
      WHERE id = ?
    `).run(newRentPaid, newRentDue, status, performance.id);

    return {
      success: true,
      plan_id: planId,
      amount: amount,
      paid_at: new Date().toISOString()
    };
  });
};

const listContractVersions = (contractId) => {
  const db = getDb();
  const versions = db.prepare(`
    SELECT * FROM contract_versions WHERE contract_id = ? ORDER BY version DESC
  `).all(contractId);

  return versions.map(v => ({
    ...v,
    parties: JSON.parse(v.parties)
  }));
};

const listAllContracts = () => {
  const db = getDb();
  const contracts = db.prepare(`SELECT * FROM contracts ORDER BY created_at DESC`).all();
  return contracts.map(c => getContractById(c.id));
};

module.exports = {
  createContract,
  getContractById,
  getContractByNo,
  updateContract,
  payRent,
  listContractVersions,
  listAllContracts
};
