const express = require('express');

function getStatisticsRouter(db) {
  const router = express.Router();

  function query(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  function queryOne(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  router.get('/repair-item/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const now = new Date().toISOString().split('T')[0];

      const repairItem = await queryOne('SELECT * FROM repair_items WHERE id = ?', [id]);
      if (!repairItem) return res.status(404).json({ error: '维修事项不存在' });

      const totalHouses = await queryOne(`
        SELECT 
          COUNT(DISTINCT h.id) as total_houses,
          SUM(h.area) as total_area
        FROM houses h
      `);

      const activeVotes = await query(`
        SELECT 
          v.vote_value,
          COUNT(DISTINCT v.house_id) as house_count,
          SUM(h.area) as area_sum,
          v.vote_type
        FROM votes v
        LEFT JOIN houses h ON v.house_id = h.id
        WHERE v.repair_item_id = ? AND v.status = 'active'
        GROUP BY v.vote_value
      `, [id]);

      const uniqueVotedHouses = await queryOne(`
        SELECT COUNT(DISTINCT house_id) as count
        FROM votes 
        WHERE repair_item_id = ? AND status = 'active'
      `, [id]);

      const votesByType = await query(`
        SELECT 
          v.vote_type,
          COUNT(DISTINCT v.house_id) as house_count
        FROM votes v
        WHERE v.repair_item_id = ? AND v.status = 'active'
        GROUP BY v.vote_type
      `, [id]);

      const votesByValue = {};
      let agreedHouses = 0, agreedArea = 0;
      let disagreedHouses = 0, disagreedArea = 0;
      let abstainedHouses = 0, abstainedArea = 0;

      activeVotes.forEach(v => {
        votesByValue[v.vote_value] = v;
        if (v.vote_value === 'agree') {
          agreedHouses = v.house_count;
          agreedArea = v.area_sum || 0;
        } else if (v.vote_value === 'disagree') {
          disagreedHouses = v.house_count;
          disagreedArea = v.area_sum || 0;
        } else if (v.vote_value === 'abstain') {
          abstainedHouses = v.house_count;
          abstainedArea = v.area_sum || 0;
        }
      });

      const notVotedHouses = totalHouses.total_houses - uniqueVotedHouses.count;

      const peoplePassRate = totalHouses.total_houses > 0 
        ? ((agreedHouses / totalHouses.total_houses) * 100).toFixed(2) 
        : 0;
      const areaPassRate = totalHouses.total_area > 0 
        ? ((agreedArea / totalHouses.total_area) * 100).toFixed(2) 
        : 0;

      const passed = parseFloat(peoplePassRate) >= 50 && parseFloat(areaPassRate) >= 50;

      const invalidDelegateVotes = await queryOne(`
        SELECT COUNT(*) as count
        FROM votes v
        LEFT JOIN delegates d ON v.delegate_id = d.id
        WHERE v.repair_item_id = ? 
          AND v.status = 'active'
          AND v.vote_type = 'delegate'
          AND (
            d.status != 'active'
            OR d.revoked_at IS NOT NULL
            OR ? < d.start_date
            OR ? > d.end_date
          )
      `, [id, now, now]);

      const revokedVotes = await queryOne(`
        SELECT COUNT(*) as count
        FROM votes 
        WHERE repair_item_id = ? AND status = 'revoked'
      `, [id]);

      const activeDelegates = await queryOne(`
        SELECT COUNT(*) as count
        FROM delegates 
        WHERE repair_item_id = ? AND status = 'active' AND revoked_at IS NULL
      `, [id]);

      const votedHouseList = await query(`
        SELECT DISTINCT v.house_id, h.unit_number, h.room_number, h.area, b.name as building_name
        FROM votes v
        LEFT JOIN houses h ON v.house_id = h.id
        LEFT JOIN buildings b ON h.building_id = b.id
        WHERE v.repair_item_id = ? AND v.status = 'active'
      `, [id]);

      const votedHouseIds = new Set(votedHouseList.map(v => v.house_id));

      const allHouses = await query(`
        SELECT h.id, h.unit_number, h.room_number, h.area, b.name as building_name,
          (SELECT o.name FROM owners o WHERE o.house_id = h.id LIMIT 1) as owner_name,
          (SELECT o.phone FROM owners o WHERE o.house_id = h.id LIMIT 1) as owner_phone
        FROM houses h
        LEFT JOIN buildings b ON h.building_id = b.id
        ORDER BY b.name, h.unit_number, h.room_number
      `);
      const notVotedHouseList = allHouses.filter(h => !votedHouseIds.has(h.id));

      res.json({
        repair_item: repairItem,
        totals: {
          total_houses: totalHouses.total_houses,
          total_area: totalHouses.total_area
        },
        voting_progress: {
          voted_houses: uniqueVotedHouses.count,
          not_voted_houses: notVotedHouses,
          voted_percentage: totalHouses.total_houses > 0 
            ? ((uniqueVotedHouses.count / totalHouses.total_houses) * 100).toFixed(2) 
            : 0,
          not_voted_list: notVotedHouseList.slice(0, 20)
        },
        results: {
          agreed: { houses: agreedHouses, area: agreedArea || 0 },
          disagreed: { houses: disagreedHouses, area: disagreedArea || 0 },
          abstained: { houses: abstainedHouses, area: abstainedArea || 0 },
          people_pass_rate: peoplePassRate,
          area_pass_rate: areaPassRate,
          passed: passed
        },
        breakdown: {
          by_vote_type: votesByType,
          by_vote_value: votesByValue
        },
        flags: {
          invalid_delegate_vote_count: invalidDelegateVotes.count,
          revoked_vote_count: revokedVotes.count,
          active_delegate_count: activeDelegates.count
        },
        counting_rules: {
          counted_votes: 'status = active 的有效投票，每房屋计1票',
          excluded_votes: 'status = revoked 的撤回投票不计入统计',
          delegate_rules: '委托投票需满足：委托状态为active且未撤销、投票日期在委托有效期内',
          pass_criteria: '同意户数比例 >= 50% 且 同意面积比例 >= 50% 视为通过',
          people_rate_calc: '同意户数 / 总户数 × 100%',
          area_rate_calc: '同意房屋面积 / 总建筑面积 × 100%'
        }
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}

module.exports = { getStatisticsRouter };
