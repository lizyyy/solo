const PlantRentalService = require('../services/PlantRentalService');
const RenewalContract = require('../models/RenewalContract');
const RenewalBill = require('../models/RenewalBill');
const HistoryService = require('../utils/history');

exports.createContract = async (req, res, next) => {
  try {
    const { request_id, operated_by, ...data } = req.body;
    const result = await PlantRentalService.createRenewalContract(data, request_id, operated_by);
    res.json({
      success: true,
      is_duplicate: result.isDuplicate,
      data: result.data
    });
  } catch (err) {
    next(err);
  }
};

exports.confirmContract = async (req, res, next) => {
  try {
    const { operated_by } = req.body;
    const contract = await PlantRentalService.confirmRenewalContract(req.params.id, operated_by);
    res.json({
      success: true,
      data: contract
    });
  } catch (err) {
    next(err);
  }
};

exports.cancelContract = async (req, res, next) => {
  try {
    const { reason, operated_by } = req.body;
    const contract = await PlantRentalService.cancelRenewalContract(req.params.id, reason, operated_by);
    res.json({
      success: true,
      data: contract
    });
  } catch (err) {
    next(err);
  }
};

exports.generateBill = async (req, res, next) => {
  try {
    const { operated_by } = req.body;
    const bill = await PlantRentalService.generateRenewalBill(req.params.id, operated_by);
    res.json({
      success: true,
      data: bill
    });
  } catch (err) {
    next(err);
  }
};

exports.issueBill = async (req, res, next) => {
  try {
    const { operated_by } = req.body;
    const bill = await PlantRentalService.issueBill(req.params.id, operated_by);
    res.json({
      success: true,
      data: bill
    });
  } catch (err) {
    next(err);
  }
};

exports.markBillPaid = async (req, res, next) => {
  try {
    const { operated_by } = req.body;
    const bill = await PlantRentalService.markBillPaid(req.params.id, operated_by);
    res.json({
      success: true,
      data: bill
    });
  } catch (err) {
    next(err);
  }
};

exports.getContract = async (req, res, next) => {
  try {
    const contract = await RenewalContract.getById(req.params.id);
    res.json({
      success: true,
      data: contract
    });
  } catch (err) {
    next(err);
  }
};

exports.getAllContracts = async (req, res, next) => {
  try {
    const { status } = req.query;
    const contracts = await RenewalContract.getAll(status);
    res.json({
      success: true,
      data: contracts
    });
  } catch (err) {
    next(err);
  }
};

exports.getBill = async (req, res, next) => {
  try {
    const bill = await RenewalBill.getById(req.params.id);
    res.json({
      success: true,
      data: bill
    });
  } catch (err) {
    next(err);
  }
};

exports.getAllBills = async (req, res, next) => {
  try {
    const { status } = req.query;
    const bills = await RenewalBill.getAll(status);
    res.json({
      success: true,
      data: bills
    });
  } catch (err) {
    next(err);
  }
};

exports.getContractHistory = async (req, res, next) => {
  try {
    const history = await HistoryService.getHistory(req.params.id, 'renewal');
    res.json({
      success: true,
      data: history
    });
  } catch (err) {
    next(err);
  }
};

exports.getBillHistory = async (req, res, next) => {
  try {
    const history = await HistoryService.getHistory(req.params.id, 'bill');
    res.json({
      success: true,
      data: history
    });
  } catch (err) {
    next(err);
  }
};
