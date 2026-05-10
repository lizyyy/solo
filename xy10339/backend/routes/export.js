const express = require('express');
const ExcelJS = require('exceljs');

function getExportRouter(db) {
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

  router.get('/excel/:repairItemId', async (req, res) => {
    try {
      const { repairItemId } = req.params;
      const now = new Date().toISOString().split('T')[0];

      const repairItem = await queryOne('SELECT * FROM repair_items WHERE id = ?', [repairItemId]);
      if (!repairItem) return res.status(404).json({ error: '维修事项不存在' });

      const totalHouses = await queryOne(`
        SELECT COUNT(DISTINCT h.id) as total_houses, SUM(h.area) as total_area
        FROM houses h
      `);

      const activeVotes = await query(`
        SELECT v.vote_value, COUNT(DISTINCT v.house_id) as house_count, SUM(h.area) as area_sum
        FROM votes v LEFT JOIN houses h ON v.house_id = h.id
        WHERE v.repair_item_id = ? AND v.status = 'active'
        GROUP BY v.vote_value
      `, [repairItemId]);

      let agreedHouses = 0, agreedArea = 0;
      let disagreedHouses = 0, disagreedArea = 0;
      let abstainedHouses = 0, abstainedArea = 0;

      activeVotes.forEach(v => {
        if (v.vote_value === 'agree') {
          agreedHouses = v.house_count; agreedArea = v.area_sum || 0;
        } else if (v.vote_value === 'disagree') {
          disagreedHouses = v.house_count; disagreedArea = v.area_sum || 0;
        } else if (v.vote_value === 'abstain') {
          abstainedHouses = v.house_count; abstainedArea = v.area_sum || 0;
        }
      });

      const peoplePassRate = totalHouses.total_houses > 0 
        ? ((agreedHouses / totalHouses.total_houses) * 100).toFixed(2) : 0;
      const areaPassRate = totalHouses.total_area > 0 
        ? ((agreedArea / totalHouses.total_area) * 100).toFixed(2) : 0;
      const passed = parseFloat(peoplePassRate) >= 50 && parseFloat(areaPassRate) >= 50;

      const votesList = await query(`
        SELECT v.*, 
          h.unit_number, h.room_number, h.area, b.name as building_name,
          o.name as voter_name, o.phone as voter_phone,
          d.principal_owner_id,
          (SELECT name FROM owners WHERE id = d.principal_owner_id) as principal_name
        FROM votes v
        LEFT JOIN houses h ON v.house_id = h.id
        LEFT JOIN buildings b ON h.building_id = b.id
        LEFT JOIN owners o ON v.voter_owner_id = o.id
        LEFT JOIN delegates d ON v.delegate_id = d.id
        WHERE v.repair_item_id = ?
        ORDER BY v.created_at DESC
      `, [repairItemId]);

      const delegates = await query(`
        SELECT d.*,
          p.name as principal_name, p.phone as principal_phone,
          p_h.unit_number as principal_unit, p_h.room_number as principal_room,
          p_b.name as principal_building,
          a.name as agent_name, a.phone as agent_phone
        FROM delegates d
        LEFT JOIN owners p ON d.principal_owner_id = p.id
        LEFT JOIN houses p_h ON p.house_id = p_h.id
        LEFT JOIN buildings p_b ON p_h.building_id = p_b.id
        LEFT JOIN owners a ON d.agent_owner_id = a.id
        WHERE d.repair_item_id = ?
        ORDER BY d.created_at DESC
      `, [repairItemId]);

      const votedHouseIds = new Set(
        votesList.filter(v => v.status === 'active').map(v => v.house_id)
      );
      const allHouses = await query(`
        SELECT h.*, b.name as building_name,
          (SELECT o.name FROM owners o WHERE o.house_id = h.id LIMIT 1) as owner_name,
          (SELECT o.phone FROM owners o WHERE o.house_id = h.id LIMIT 1) as owner_phone
        FROM houses h
        LEFT JOIN buildings b ON h.building_id = b.id
        ORDER BY b.name, h.unit_number, h.room_number
      `);
      const notVotedList = allHouses.filter(h => !votedHouseIds.has(h.id));

      const workbook = new ExcelJS.Workbook();
      workbook.creator = '社区维修基金投票系统';
      workbook.created = new Date();

      const summarySheet = workbook.addWorksheet('统计汇总');
      summarySheet.columns = [
        { header: '项目', key: 'item', width: 25 },
        { header: '数值', key: 'value', width: 40 }
      ];
      summarySheet.addRows([
        { item: '维修事项', value: repairItem.name },
        { item: '事项描述', value: repairItem.description || '-' },
        { item: '预算金额', value: repairItem.estimated_cost ? `￥${Number(repairItem.estimated_cost).toLocaleString()}` : '-' },
        { item: '投票周期', value: `${repairItem.start_date} 至 ${repairItem.end_date}` },
        { item: '导出日期', value: now },
        {},
        { item: '=== 统计口径说明 ===', value: '' },
        { item: '计入统计的投票', value: 'status=active 的有效投票，每房屋计1票' },
        { item: '不计入统计的投票', value: 'status=revoked 的撤回投票' },
        { item: '委托投票有效性', value: '委托状态为active且未撤销、投票日期在委托有效期内' },
        { item: '通过条件', value: '同意户数比例 ≥ 50% 且 同意面积比例 ≥ 50%' },
        { item: '户数比例公式', value: '同意户数 / 总户数 × 100%' },
        { item: '面积比例公式', value: '同意房屋面积 / 总建筑面积 × 100%' },
        {},
        { item: '=== 总体数据 ===', value: '' },
        { item: '总户数', value: totalHouses.total_houses },
        { item: '总建筑面积', value: `${totalHouses.total_area} ㎡` },
        {},
        { item: '=== 投票进度 ===', value: '' },
        { item: '已投票户数', value: agreedHouses + disagreedHouses + abstainedHouses },
        { item: '未投票户数', value: totalHouses.total_houses - (agreedHouses + disagreedHouses + abstainedHouses) },
        { item: '投票率', value: `${(((agreedHouses + disagreedHouses + abstainedHouses) / totalHouses.total_houses) * 100).toFixed(2)}%` },
        {},
        { item: '=== 投票结果 ===', value: '' },
        { item: '同意户数', value: agreedHouses },
        { item: '同意户数比例', value: `${peoplePassRate}%` },
        { item: '同意房屋面积', value: `${agreedArea} ㎡` },
        { item: '同意面积比例', value: `${areaPassRate}%` },
        { item: '反对户数', value: disagreedHouses },
        { item: '反对房屋面积', value: `${disagreedArea} ㎡` },
        { item: '弃权户数', value: abstainedHouses },
        { item: '弃权房屋面积', value: `${abstainedArea} ㎡` },
        {},
        { item: '=== 最终结论 ===', value: '' },
        { item: '是否通过', value: passed ? '是' : '否' }
      ]);

      const votesSheet = workbook.addWorksheet('有效投票明细');
      votesSheet.columns = [
        { header: '序号', key: 'no', width: 6 },
        { header: '楼栋', key: 'building', width: 18 },
        { header: '单元', key: 'unit', width: 8 },
        { header: '房号', key: 'room', width: 8 },
        { header: '面积', key: 'area', width: 10 },
        { header: '投票人', key: 'voter', width: 12 },
        { header: '联系电话', key: 'phone', width: 15 },
        { header: '表决意见', key: 'vote', width: 10 },
        { header: '投票类型', key: 'type', width: 12 },
        { header: '委托人', key: 'principal', width: 12 },
        { header: '投票时间', key: 'time', width: 20 },
        { header: '状态', key: 'status', width: 10 },
        { header: '备注', key: 'notes', width: 30 }
      ];

      const activeVotesList = votesList.filter(v => v.status === 'active');
      activeVotesList.forEach((v, idx) => {
        const voteText = v.vote_value === 'agree' ? '同意' : v.vote_value === 'disagree' ? '反对' : '弃权';
        const typeText = v.vote_type === 'delegate' ? '委托投票' : '亲自投票';
        const statusText = v.status === 'active' ? '有效' : '已撤回';
        votesSheet.addRow({
          no: idx + 1,
          building: v.building_name,
          unit: v.unit_number,
          room: v.room_number,
          area: v.area,
          voter: v.voter_name,
          phone: v.voter_phone,
          vote: voteText,
          type: typeText,
          principal: v.principal_name || '-',
          time: v.created_at,
          status: statusText,
          notes: v.notes || '-'
        });
      });

      const historySheet = workbook.addWorksheet('历史投票记录');
      historySheet.columns = votesSheet.columns;
      votesList.forEach((v, idx) => {
        const voteText = v.vote_value === 'agree' ? '同意' : v.vote_value === 'disagree' ? '反对' : '弃权';
        const typeText = v.vote_type === 'delegate' ? '委托投票' : '亲自投票';
        const statusText = v.status === 'active' ? '有效' : '已撤回';
        historySheet.addRow({
          no: idx + 1,
          building: v.building_name,
          unit: v.unit_number,
          room: v.room_number,
          area: v.area,
          voter: v.voter_name,
          phone: v.voter_phone,
          vote: voteText,
          type: typeText,
          principal: v.principal_name || '-',
          time: v.created_at,
          status: statusText,
          notes: v.notes || '-'
        });
      });

      const delegateSheet = workbook.addWorksheet('委托记录');
      delegateSheet.columns = [
        { header: '序号', key: 'no', width: 6 },
        { header: '委托人', key: 'principal', width: 12 },
        { header: '房屋', key: 'house', width: 20 },
        { header: '受托人', key: 'agent', width: 12 },
        { header: '受托人电话', key: 'agent_phone', width: 15 },
        { header: '开始日期', key: 'start', width: 12 },
        { header: '结束日期', key: 'end', width: 12 },
        { header: '状态', key: 'status', width: 10 },
        { header: '撤销时间', key: 'revoked', width: 20 }
      ];
      delegates.forEach((d, idx) => {
        const statusText = d.status === 'active' && !d.revoked_at ? '有效' : '已撤销';
        delegateSheet.addRow({
          no: idx + 1,
          principal: d.principal_name,
          house: `${d.principal_building} ${d.principal_unit}单元${d.principal_room}室`,
          agent: d.agent_name,
          agent_phone: d.agent_phone,
          start: d.start_date,
          end: d.end_date,
          status: statusText,
          revoked: d.revoked_at || '-'
        });
      });

      const notVotedSheet = workbook.addWorksheet('未投票房屋');
      notVotedSheet.columns = [
        { header: '序号', key: 'no', width: 6 },
        { header: '楼栋', key: 'building', width: 18 },
        { header: '单元', key: 'unit', width: 8 },
        { header: '房号', key: 'room', width: 8 },
        { header: '面积', key: 'area', width: 10 },
        { header: '业主', key: 'owner', width: 12 },
        { header: '联系电话', key: 'phone', width: 15 }
      ];
      notVotedList.forEach((h, idx) => {
        notVotedSheet.addRow({
          no: idx + 1,
          building: h.building_name,
          unit: h.unit_number,
          room: h.room_number,
          area: h.area,
          owner: h.owner_name || '-',
          phone: h.owner_phone || '-'
        });
      });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=维修基金投票_${repairItem.name}_${now}.xlsx`);

      await workbook.xlsx.write(res);
      res.end();
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}

module.exports = { getExportRouter };
