const BillService = require('../services/billService');

class BillController {
  static async getByOrderId(req, res) {
    try {
      const bills = await BillService.getBillsByOrderId(req.params.orderId);
      res.json({ success: true, data: bills });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  static async pay(req, res) {
    try {
      await BillService.payBill(req.params.id);
      res.json({ success: true, message: '账单已支付' });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  static async list(req, res) {
    try {
      const bills = await BillService.listBills(req.query);
      res.json({ success: true, data: bills });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  }
}

module.exports = BillController;
