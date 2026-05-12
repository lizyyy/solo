const DepositService = require('../services/depositService');

class DepositController {
  static async pay(req, res) {
    try {
      const transaction = await DepositService.recordPayment(req.body);
      res.sendIdempotentResponse(201, { success: true, data: transaction });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  static async deduct(req, res) {
    try {
      const transaction = await DepositService.deductDeposit(req.body);
      res.sendIdempotentResponse(200, { success: true, data: transaction });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  static async refund(req, res) {
    try {
      const transaction = await DepositService.refundDeposit(req.body);
      res.sendIdempotentResponse(200, { success: true, data: transaction });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  static async getByOrderId(req, res) {
    try {
      const transactions = await DepositService.getTransactionsByOrderId(req.params.orderId);
      res.json({ success: true, data: transactions });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  }
}

module.exports = DepositController;
