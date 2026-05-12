const express = require('express');
const router = express.Router();
const db = require('../config/database');

router.get('/overview', (req, res) => {
  db.serialize(() => {
    const overview = {};

    db.get(`SELECT COUNT(*) as count FROM campaigns`, (err, row) => {
      overview.campaigns = row.count;
    });

    db.get(`SELECT COUNT(*) as count FROM materials`, (err, row) => {
      overview.materials = row.count;
    });

    db.get(`SELECT COUNT(*) as count FROM channels WHERE is_active = 1`, (err, row) => {
      overview.active_channels = row.count;
    });

    db.get(`SELECT COUNT(*) as count FROM material_channels WHERE status = 'running'`, (err, row) => {
      overview.running_ads = row.count;
    });

    db.get(`SELECT SUM(spent) as total FROM material_channels`, (err, row) => {
      overview.total_spent = row.total || 0;

      res.json({
        success: true,
        data: overview
      });
    });
  });
});

router.get('/campaign/:campaignId/dashboard', (req, res) => {
  const { campaignId } = req.params;

  db.all(
    `SELECT mc.id, mc.status, mc.review_status, mc.budget, mc.spent,
            mc.created_at, mc.updated_at,
            c.name as channel_name, c.code as channel_code,
            m.title as material_title, m.version as material_version, m.id as material_id,
            m.parent_version_id
     FROM material_channels mc
     JOIN channels c ON mc.channel_id = c.id
     JOIN materials m ON mc.material_id = m.id
     WHERE m.campaign_id = ?
     ORDER BY mc.created_at DESC`,
    [campaignId],
    (err, materialChannels) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      db.all(
        `SELECT * FROM materials WHERE campaign_id = ? ORDER BY created_at ASC`,
        [campaignId],
        (err, materials) => {
          if (err) {
            return res.status(500).json({ error: err.message });
          }

          const map = new Map();
          const tree = [];
          materials.forEach(m => map.set(m.id, { ...m, children: [] }));
          materials.forEach(m => {
            const node = map.get(m.id);
            if (m.parent_version_id && map.has(m.parent_version_id)) {
              map.get(m.parent_version_id).children.push(node);
            } else {
              tree.push(node);
            }
          });

          const byStatus = {};
          const byReviewStatus = {};
          let totalBudget = 0;
          let totalSpent = 0;

          materialChannels.forEach(mc => {
            byStatus[mc.status] = (byStatus[mc.status] || 0) + 1;
            byReviewStatus[mc.review_status] = (byReviewStatus[mc.review_status] || 0) + 1;
            totalBudget += mc.budget;
            totalSpent += mc.spent;
          });

          res.json({
            success: true,
            data: {
              campaign_id: campaignId,
              summary: {
                total_materials: materials.length,
                total_channels: materialChannels.length,
                by_status: byStatus,
                by_review_status: byReviewStatus,
                total_budget: totalBudget,
                total_spent: totalSpent,
                remaining_budget: totalBudget - totalSpent
              },
              version_tree: tree,
              channel_statuses: materialChannels
            }
          });
        }
      );
    }
  );
});

router.get('/rollback-history/:campaignId', (req, res) => {
  const { campaignId } = req.params;

  db.all(
    `SELECT r.*,
            mf.title as from_title, mf.version as from_version,
            mt.title as to_title, mt.version as to_version,
            c.name as channel_name, c.code as channel_code
     FROM rollback_records r
     JOIN material_channels mc ON r.material_channel_id = mc.id
     JOIN channels c ON mc.channel_id = c.id
     JOIN materials mf ON r.from_material_id = mf.id
     JOIN materials mt ON r.to_material_id = mt.id
     WHERE mf.campaign_id = ?
     ORDER BY r.created_at DESC`,
    [campaignId],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({
        success: true,
        data: {
          count: rows.length,
          records: rows
        }
      });
    }
  );
});

router.get('/performance/:campaignId', (req, res) => {
  const { campaignId } = req.params;

  db.all(
    `SELECT pd.*,
            c.name as channel_name, c.code as channel_code,
            m.title as material_title, m.version as material_version,
            mc.status, mc.budget, mc.spent
     FROM performance_data pd
     JOIN material_channels mc ON pd.material_channel_id = mc.id
     JOIN channels c ON mc.channel_id = c.id
     JOIN materials m ON mc.material_id = m.id
     WHERE m.campaign_id = ?
     ORDER BY pd.created_at DESC`,
    [campaignId],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      const summary = {
        total_impressions: 0,
        total_clicks: 0,
        total_conversions: 0,
        total_cost: 0
      };

      rows.forEach(r => {
        summary.total_impressions += r.impressions;
        summary.total_clicks += r.clicks;
        summary.total_conversions += r.conversions;
        summary.total_cost += r.cost;
      });

      summary.ctr = summary.total_impressions > 0
        ? ((summary.total_clicks / summary.total_impressions) * 100).toFixed(2) + '%'
        : '0%';
      summary.cvr = summary.total_clicks > 0
        ? ((summary.total_conversions / summary.total_clicks) * 100).toFixed(2) + '%'
        : '0%';

      res.json({
        success: true,
        data: {
          summary,
          records: rows
        }
      });
    }
  );
});

router.get('/export/:campaignId', (req, res) => {
  const { campaignId } = req.params;

  db.serialize(() => {
    const exportData = {
      campaign_id: campaignId,
      export_time: new Date().toISOString(),
      materials: [],
      channel_assignments: [],
      rollback_history: [],
      performance_data: [],
      manual_corrections: []
    };

    db.all(
      `SELECT * FROM materials WHERE campaign_id = ? ORDER BY version`,
      [campaignId],
      (err, rows) => {
        exportData.materials = rows;

        db.all(
          `SELECT mc.id, mc.status, mc.review_status, mc.budget, mc.spent,
                  c.name as channel_name, c.code as channel_code,
                  m.title as material_title, m.version as material_version
           FROM material_channels mc
           JOIN channels c ON mc.channel_id = c.id
           JOIN materials m ON mc.material_id = m.id
           WHERE m.campaign_id = ?
           ORDER BY mc.created_at DESC`,
          [campaignId],
          (err, rows) => {
            exportData.channel_assignments = rows;

            db.all(
              `SELECT r.*,
                      mf.title as from_title, mf.version as from_version,
                      mt.title as to_title, mt.version as to_version,
                      c.name as channel_name
               FROM rollback_records r
               JOIN material_channels mc ON r.material_channel_id = mc.id
               JOIN channels c ON mc.channel_id = c.id
               JOIN materials mf ON r.from_material_id = mf.id
               JOIN materials mt ON r.to_material_id = mt.id
               WHERE mf.campaign_id = ?
               ORDER BY r.created_at DESC`,
              [campaignId],
              (err, rows) => {
                exportData.rollback_history = rows;

                db.all(
                  `SELECT pd.*,
                          c.name as channel_name,
                          m.title as material_title, m.version as material_version
                   FROM performance_data pd
                   JOIN material_channels mc ON pd.material_channel_id = mc.id
                   JOIN channels c ON mc.channel_id = c.id
                   JOIN materials m ON mc.material_id = m.id
                   WHERE m.campaign_id = ?
                   ORDER BY pd.created_at DESC`,
                  [campaignId],
                  (err, rows) => {
                    exportData.performance_data = rows;

                    res.setHeader('Content-Type', 'application/json');
                    res.setHeader('Content-Disposition', `attachment; filename=report-${campaignId}.json`);
                    res.json(exportData);
                  }
                );
              }
            );
          }
        );
      }
    );
  });
});

module.exports = router;
