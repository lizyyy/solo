const DbHelper = require('../utils/dbHelper');
const moment = require('moment');

class DashboardController {
  static async getOverview(req, res) {
    try {
      const [totalBindings, totalArrears, totalRenewals, totalBlacklist] = await Promise.all([
        DbHelper.get('SELECT COUNT(*) as count FROM plate_bindings'),
        DbHelper.get('SELECT COUNT(*) as count FROM arrears_ledger WHERE status = ?', ['unpaid']),
        DbHelper.get('SELECT COUNT(*) as count FROM renewal_payments WHERE created_at >= ?', [moment().startOf('month').format('YYYY-MM-DD')]),
        DbHelper.get('SELECT COUNT(*) as count FROM blacklist WHERE status = ?', ['active'])
      ]);

      const expiringSoon = await DbHelper.all(
        'SELECT * FROM plate_bindings WHERE valid_to <= ? AND valid_to >= ? AND status = ?',
        [moment().add(7, 'days').format('YYYY-MM-DD'), moment().format('YYYY-MM-DD'), 'active']
      );

      const expired = await DbHelper.all(
        'SELECT * FROM plate_bindings WHERE valid_to < ? AND status = ?',
        [moment().format('YYYY-MM-DD'), 'active']
      );

      res.json({
        success: true,
        data: {
          total_bindings: totalBindings.count,
          total_arrears: totalArrears.count,
          monthly_renewals: totalRenewals.count,
          active_blacklist: totalBlacklist.count,
          expiring_soon: expiringSoon.length,
          expired: expired.length,
          expiring_list: expiringSoon.slice(0, 10),
          expired_list: expired.slice(0, 10)
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getAbnormalList(req, res) {
    try {
      const { type, page = 1, pageSize = 50 } = req.query;
      
      let abnormalData = {};

      if (!type || type === 'no_binding') {
        const platesWithArrears = await DbHelper.all('SELECT DISTINCT plate_number FROM arrears_ledger');
        const platesWithBinding = await DbHelper.all('SELECT DISTINCT plate_number FROM plate_bindings');
        const bindingSet = new Set(platesWithBinding.map(p => p.plate_number));
        abnormalData.no_binding = platesWithArrears.filter(p => !bindingSet.has(p.plate_number));
      }

      if (!type || type === 'permission_inconsistency') {
        const expiredWithAccess = await DbHelper.all(
          `SELECT pb.*, 
            (SELECT COUNT(*) FROM renewal_payments rp WHERE rp.plate_number = pb.plate_number AND rp.created_at > pb.valid_to) as renewal_count
           FROM plate_bindings pb 
           WHERE pb.valid_to < ? AND pb.status = ?`,
          [moment().format('YYYY-MM-DD'), 'active']
        );
        abnormalData.permission_inconsistency = expiredWithAccess;
      }

      if (!type || type === 'payment_exception') {
        const paymentExceptions = await DbHelper.all(
          `SELECT rp1.* 
           FROM renewal_payments rp1
           WHERE rp1.status = 'pending'
           OR EXISTS (
             SELECT 1 FROM renewal_payments rp2 
             WHERE rp2.plate_number = rp1.plate_number 
             AND rp2.id != rp1.id 
             AND ABS(JULIANDAY(rp2.created_at) - JULIANDAY(rp1.created_at)) < 0.0007
           )
           ORDER BY rp1.created_at DESC`
        );
        abnormalData.payment_exception = paymentExceptions;
      }

      if (!type || type === 'arrears_unpaid') {
        const longTermArrears = await DbHelper.all(
          `SELECT * FROM arrears_ledger 
           WHERE status = 'unpaid' 
           AND created_at < ?
           ORDER BY created_at ASC`,
          [moment().subtract(30, 'days').format('YYYY-MM-DD')]
        );
        abnormalData.arrears_unpaid = longTermArrears;
      }

      res.json({ success: true, data: abnormalData });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
}

module.exports = DashboardController;
