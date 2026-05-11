const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const utils = require('../utils');
const memberService = require('./memberService');

async function settlePeriod(period) {
  const existingRun = await utils.getSettlementRun(period);
  if (existingRun && existingRun.status === 'completed') {
    return {
      message: '该周期结算任务已完成（幂等处理）',
      period,
      settlement_run_id: existingRun.id,
      status: existingRun.status
    };
  }

  if (existingRun && existingRun.status === 'running') {
    return {
      message: '该周期结算任务正在进行中',
      period,
      settlement_run_id: existingRun.id,
      status: existingRun.status
    };
  }

  const runId = uuidv4();
  await new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO settlement_runs (id, period, status) VALUES (?, ?, ?)',
      [runId, period, 'running'],
      (err) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });

  try {
    const members = await utils.getAllMembers();
    const tiers = await utils.getAllTiers();
    const results = [];

    for (const member of members) {
      const points = await utils.getMemberPointsInPeriod(member.id, period);
      const calculatedTier = utils.calculateTier(points, tiers);
      const existingSettlement = await utils.getMemberSettlement(member.id, period);

      if (existingSettlement) {
        if (!existingSettlement.is_confirmed) {
          await new Promise((resolve, reject) => {
            db.run(
              `UPDATE settlements 
               SET total_points = ?, calculated_tier = ?, status = ?
               WHERE id = ?`,
              [points, calculatedTier, 'recalculated', existingSettlement.id],
              (err) => {
                if (err) reject(err);
                else resolve();
              }
            );
          });
          results.push({
            member_id: member.id,
            member_name: member.name,
            total_points: points,
            calculated_tier: calculatedTier,
            action: 'updated'
          });
        } else {
          results.push({
            member_id: member.id,
            member_name: member.name,
            total_points: existingSettlement.total_points,
            confirmed_tier: existingSettlement.confirmed_tier,
            action: 'skipped (already confirmed)'
          });
        }
      } else {
        const settlementId = uuidv4();
        await new Promise((resolve, reject) => {
          db.run(
            `INSERT INTO settlements 
             (id, member_id, period, total_points, calculated_tier, status)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [settlementId, member.id, period, points, calculatedTier, 'calculated'],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
        results.push({
          member_id: member.id,
          member_name: member.name,
          total_points: points,
          calculated_tier: calculatedTier,
          action: 'created'
        });
      }
    }

    await new Promise((resolve, reject) => {
      db.run(
        `UPDATE settlement_runs 
         SET status = ?, completed_at = datetime('now')
         WHERE id = ?`,
        ['completed', runId],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    return {
      message: '周期结算完成',
      period,
      settlement_run_id: runId,
      status: 'completed',
      member_count: members.length,
      processed_members: results.length,
      results
    };
  } catch (error) {
    await new Promise((resolve) => {
      db.run(
        `UPDATE settlement_runs 
         SET status = ?, completed_at = datetime('now'), error_message = ?
         WHERE id = ?`,
        ['failed', error.message, runId],
        () => resolve()
      );
    });
    throw error;
  }
}

async function confirmSettlement(memberId, period, confirmedBy = 'operator') {
  const settlement = await utils.getMemberSettlement(memberId, period);
  if (!settlement) {
    throw new Error('结算记录不存在');
  }

  if (settlement.is_confirmed) {
    return {
      message: '该会员该周期等级已确认（幂等处理）',
      member_id: memberId,
      period,
      confirmed_tier: settlement.confirmed_tier
    };
  }

  const tier = settlement.calculated_tier || settlement.confirmed_tier;
  if (!tier) {
    throw new Error('需要先进行周期结算，计算等级后才能确认');
  }

  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(
        `UPDATE settlements 
         SET confirmed_tier = ?, is_confirmed = 1, confirmed_at = datetime('now'), confirmed_by = ?, status = 'confirmed'
         WHERE id = ?`,
        [tier, confirmedBy, settlement.id],
        function(err) {
          if (err) {
            reject(err);
            return;
          }

          db.run(
            'UPDATE members SET current_tier = ?, updated_at = datetime(\'now\') WHERE id = ?',
            [tier, memberId],
            (updateErr) => {
              if (updateErr) {
                reject(updateErr);
              } else {
                resolve({
                  message: '等级确认成功',
                  member_id: memberId,
                  period,
                  confirmed_tier: tier,
                  confirmed_by: confirmedBy
                });
              }
            }
          );
        }
      );
    });
  });
}

async function recalculatePeriod(period, force = false, operator = 'operator') {
  const existingRun = await utils.getSettlementRun(period);
  if (existingRun && existingRun.status === 'running') {
    return {
      message: '该周期结算任务正在进行中，请等待完成后再重算',
      period,
      status: 'running'
    };
  }

  const members = await utils.getAllMembers();
  const tiers = await utils.getAllTiers();
  const results = [];

  for (const member of members) {
    const existingSettlement = await utils.getMemberSettlement(member.id, period);

    if (existingSettlement && existingSettlement.is_confirmed && !force) {
      results.push({
        member_id: member.id,
        member_name: member.name,
        action: 'skipped (already confirmed, use force=true to override)'
      });
      continue;
    }

    const points = await utils.getMemberPointsInPeriod(member.id, period);
    const calculatedTier = utils.calculateTier(points, tiers);

    if (existingSettlement) {
      if (!existingSettlement.is_confirmed) {
        await new Promise((resolve, reject) => {
          db.run(
            `UPDATE settlements 
             SET total_points = ?, calculated_tier = ?, status = ?
             WHERE id = ?`,
            [points, calculatedTier, 'recalculated', existingSettlement.id],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
        results.push({
          member_id: member.id,
          member_name: member.name,
          total_points: points,
          calculated_tier: calculatedTier,
          action: 'recalculated'
        });
      } else if (force) {
        await new Promise((resolve, reject) => {
          db.run(
            `UPDATE settlements 
             SET total_points = ?, calculated_tier = ?, confirmed_tier = ?, 
                 is_confirmed = 0, confirmed_at = NULL, confirmed_by = NULL, 
                 status = 'recalculated'
             WHERE id = ?`,
            [points, calculatedTier, null, existingSettlement.id],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
        results.push({
          member_id: member.id,
          member_name: member.name,
          total_points: points,
          calculated_tier: calculatedTier,
          action: 'force_recalculated (confirmation cleared)'
        });
      }
    } else {
      const settlementId = uuidv4();
      await new Promise((resolve, reject) => {
        db.run(
          `INSERT INTO settlements 
           (id, member_id, period, total_points, calculated_tier, status)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [settlementId, member.id, period, points, calculatedTier, 'calculated'],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });
      results.push({
        member_id: member.id,
        member_name: member.name,
        total_points: points,
        calculated_tier: calculatedTier,
        action: 'created'
      });
    }
  }

  return {
    message: '周期重算完成',
    period,
    member_count: members.length,
    processed_members: results.length,
    force_mode: force,
    results
  };
}

async function getSettlementStatistics(period) {
  const tiers = await utils.getAllTiers();
  const result = {};

  for (const tier of tiers) {
    const count = await new Promise((resolve, reject) => {
      db.get(
        `SELECT COUNT(*) as count FROM settlements 
         WHERE period = ? AND (
           (calculated_tier = ? AND status != 'confirmed')
           OR (confirmed_tier = ? AND status = 'confirmed')
         )`,
        [period, tier.name, tier.name],
        (err, row) => {
          if (err) reject(err);
          else resolve(row ? row.count : 0);
        }
      );
    });
    result[tier.name] = count;
  }

  return result;
}

function getSettlementHistory(period) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM settlement_runs 
       WHERE period = ? 
       ORDER BY started_at DESC`,
      [period],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      }
    );
  });
}

function getMemberSettlements(memberId) {
  return new Promise((resolve, reject) => {
    db.all(
      'SELECT * FROM settlements WHERE member_id = ? ORDER BY period DESC',
      [memberId],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      }
    );
  });
}

async function getCriticalMembers(period, thresholdPercent = 0.9) {
  const tiers = await utils.getAllTiers();
  const criticalMembers = [];

  for (let i = 1; i < tiers.length; i++) {
    const tier = tiers[i];
    const threshold = Math.floor(tier.min_points * thresholdPercent);

    const members = await new Promise((resolve, reject) => {
      db.all(
        `SELECT s.*, m.name, m.phone 
         FROM settlements s 
         JOIN members m ON s.member_id = m.id
         WHERE s.period = ? AND s.total_points >= ? AND s.total_points < ?`,
        [period, threshold, tier.min_points],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });

    criticalMembers.push({
      tier: tier.name,
      threshold_points: tier.min_points,
      current_points_range: `${threshold}-${tier.min_points - 1}`,
      members
    });
  }

  return criticalMembers;
}

module.exports = {
  settlePeriod,
  confirmSettlement,
  recalculatePeriod,
  getSettlementStatistics,
  getSettlementHistory,
  getMemberSettlements,
  getCriticalMembers
};
