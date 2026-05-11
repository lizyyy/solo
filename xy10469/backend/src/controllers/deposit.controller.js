const Deposit = require('../models/Deposit.model');
const depositService = require('../services/deposit.service');

exports.getAllTransactions = async (req, res) => {
  try {
    const transactions = await depositService.getDepositTransactions(req.query);
    res.json({
      success: true,
      data: transactions
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getTransactionById = async (req, res) => {
  try {
    const transaction = await Deposit.findById(req.params.id)
      .populate('merchantId', 'name')
      .populate('applicationId', 'applicationNo');
    
    if (!transaction) {
      return res.status(404).json({ success: false, message: '交易记录不存在' });
    }
    res.json({
      success: true,
      data: transaction
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.confirmPayment = async (req, res) => {
  try {
    const { paymentMethod } = req.body;
    const transaction = await depositService.confirmPayment(req.params.id, paymentMethod);
    res.json({
      success: true,
      data: transaction,
      message: '付款确认成功'
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.getDepositSummary = async (req, res) => {
  try {
    const summary = await depositService.getDepositSummary();
    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};