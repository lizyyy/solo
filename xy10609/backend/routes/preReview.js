const express = require('express');
const router = express.Router();
const db = require('../config/dbUtils');
const dayjs = require('dayjs');

const GAP_TYPES = {
  ATTACHMENT_EXPIRED: 'attachment_expired',
  ATTACHMENT_EXPIRING_SOON: 'attachment_expiring_soon',
  CORRECTION_PENDING: 'correction_pending',
  WINDOW_REJECTED: 'window_rejected',
  MATERIAL_MISSING: 'material_missing'
};

const calculateGaps = async (matterId = null) => {
  const gaps = [];
  const today = dayjs();

  let matterFilter = '';
  const params = [];
  if (matterId) {
    matterFilter = 'WHERE matter_id = ?';
    params.push(matterId);
  }

  const attachments = await db.all(`
    SELECT a.*, m.name as matter_name, it.name as identity_type
    FROM attachments a
    LEFT JOIN business_matters m ON a.matter_id = m.id
    LEFT JOIN identity_types it ON a.identity_type_id = it.id
    ${matterFilter}
  `, matterId ? [matterId] : []);

  for (const attachment of attachments) {
    if (attachment.expire_date) {
      const expireDate = dayjs(attachment.expire_date);
      const daysUntilExpire = expireDate.diff(today, 'day');

      if (daysUntilExpire < 0) {
        gaps.push({
          matter_id: attachment.matter_id,
          identity_type_id: attachment.identity_type_id,
          gap_type: GAP_TYPES.ATTACHMENT_EXPIRED,
          gap_description: `附件"${attachment.name}"已过期${Math.abs(daysUntilExpire)}天，请重新上传`,
          attachment_id: attachment.id,
          severity: 'high'
        });
      } else if (daysUntilExpire <= 30) {
        gaps.push({
          matter_id: attachment.matter_id,
          identity_type_id: attachment.identity_type_id,
          gap_type: GAP_TYPES.ATTACHMENT_EXPIRING_SOON,
          gap_description: `附件"${attachment.name}"将在${daysUntilExpire}天后过期，请及时更新`,
          attachment_id: attachment.id,
          severity: 'medium'
        });
      }
    }
  }

  const correctionOpinions = await db.all(`
    SELECT co.*, m.name as matter_name, a.name as attachment_name
    FROM correction_opinions co
    LEFT JOIN business_matters m ON co.matter_id = m.id
    LEFT JOIN attachments a ON co.attachment_id = a.id
    WHERE co.status = 'pending'
    ${matterId ? ' AND co.matter_id = ?' : ''}
  `, matterId ? [matterId] : []);

  for (const opinion of correctionOpinions) {
    gaps.push({
      matter_id: opinion.matter_id,
      gap_type: GAP_TYPES.CORRECTION_PENDING,
      gap_description: `补正意见待处理: ${opinion.opinion} (处理人: ${opinion.handler || '未分配'})`,
      attachment_id: opinion.attachment_id,
      severity: 'high'
    });
  }

  const windowAcceptances = await db.all(`
    SELECT wa.*, m.name as matter_name
    FROM window_acceptances wa
    LEFT JOIN business_matters m ON wa.matter_id = m.id
    WHERE wa.material_check_result IN ('rejected', 'incomplete')
    ${matterId ? ' AND wa.matter_id = ?' : ''}
  `, matterId ? [matterId] : []);

  for (const acceptance of windowAcceptances) {
    gaps.push({
      matter_id: acceptance.matter_id,
      gap_type: GAP_TYPES.WINDOW_REJECTED,
      gap_description: `窗口受理${acceptance.material_check_result === 'rejected' ? '驳回' : '材料不全'}: ${acceptance.remarks || '无备注'} (受理人: ${acceptance.acceptor}, 窗口: ${acceptance.window_no})`,
      severity: acceptance.material_check_result === 'rejected' ? 'high' : 'medium'
    });
  }

  const mattersWithAttachments = await db.all(`
    SELECT m.*, 
      (SELECT COUNT(*) FROM attachments WHERE matter_id = m.id) as attachment_count
    FROM business_matters m
    ${matterFilter}
  `, matterId ? [matterId] : []);

  for (const matter of mattersWithAttachments) {
    if (matter.attachment_count === 0) {
      gaps.push({
        matter_id: matter.id,
        gap_type: GAP_TYPES.MATERIAL_MISSING,
        gap_description: `事项"${matter.name}"暂无任何附件，请上传必要材料`,
        severity: 'high'
      });
    }
  }

  return gaps;
};

router.post('/calculate', async (req, res) => {
  try {
    const { matter_id, auto_create = true, handler } = req.body;

    const gaps = await calculateGaps(matter_id);

    if (auto_create && gaps.length > 0) {
      for (const gap of gaps) {
        const existing = await db.get(`
          SELECT id FROM material_gaps 
          WHERE matter_id = ? AND gap_type = ? AND is_resolved = 0
          LIMIT 1
        `, [gap.matter_id, gap.gap_type]);

        if (!existing) {
          await db.run(`
            INSERT INTO material_gaps (matter_id, identity_type_id, gap_type, gap_description, attachment_id, severity, is_resolved, created_at)
            VALUES (?, ?, ?, ?, ?, ?, 0, ?)
          `, [gap.matter_id, gap.identity_type_id, gap.gap_type, gap.gap_description, gap.attachment_id, gap.severity, dayjs().format()]);

          await db.run(`
            INSERT INTO exceptions (matter_id, exception_type, reason, attachment_id, handler, is_fixed, created_at)
            VALUES (?, ?, ?, ?, ?, 0, ?)
          `, [gap.matter_id, gap.gap_type, gap.gap_description, gap.attachment_id, handler || 'system', dayjs().format()]);
        }
      }
    }

    res.json({
      success: true,
      data: {
        calculated_at: dayjs().format(),
        total_gaps: gaps.length,
        gaps: gaps,
        summary: {
          expired: gaps.filter(g => g.gap_type === GAP_TYPES.ATTACHMENT_EXPIRED).length,
          expiring_soon: gaps.filter(g => g.gap_type === GAP_TYPES.ATTACHMENT_EXPIRING_SOON).length,
          correction_pending: gaps.filter(g => g.gap_type === GAP_TYPES.CORRECTION_PENDING).length,
          window_rejected: gaps.filter(g => g.gap_type === GAP_TYPES.WINDOW_REJECTED).length,
          material_missing: gaps.filter(g => g.gap_type === GAP_TYPES.MATERIAL_MISSING).length
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/summary', async (req, res) => {
  try {
    const { matterId } = req.query;

    const gaps = await calculateGaps(matterId);

    const matters = await db.all('SELECT id, name FROM business_matters');
    const mattersSummary = {};

    for (const matter of matters) {
      const matterGaps = gaps.filter(g => g.matter_id === matter.id);
      mattersSummary[matter.id] = {
        matter_name: matter.name,
        total_gaps: matterGaps.length,
        high_severity: matterGaps.filter(g => g.severity === 'high').length,
        medium_severity: matterGaps.filter(g => g.severity === 'medium').length,
        low_severity: matterGaps.filter(g => g.severity === 'low').length
      };
    }

    res.json({
      success: true,
      data: {
        total_gaps: gaps.length,
        by_type: {
          expired: gaps.filter(g => g.gap_type === GAP_TYPES.ATTACHMENT_EXPIRED).length,
          expiring_soon: gaps.filter(g => g.gap_type === GAP_TYPES.ATTACHMENT_EXPIRING_SOON).length,
          correction_pending: gaps.filter(g => g.gap_type === GAP_TYPES.CORRECTION_PENDING).length,
          window_rejected: gaps.filter(g => g.gap_type === GAP_TYPES.WINDOW_REJECTED).length,
          material_missing: gaps.filter(g => g.gap_type === GAP_TYPES.MATERIAL_MISSING).length
        },
        by_matter: mattersSummary
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
