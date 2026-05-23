const { v4: uuidv4 } = require('uuid');
const prescriptionService = require('../services/prescriptionService');

const createPrescription = async (req, res) => {
  try {
    const result = await prescriptionService.createPrescription(req.body);
    res.status(201).json(result);
  } catch (error) {
    await prescriptionService.recordException({
      prescription_id: null,
      request_id: req.body.request_id || uuidv4(),
      api_path: req.path,
      original_input: JSON.stringify(req.body),
      error_type: 'CREATE_ERROR',
      error_message: error.message,
      processing_result: '创建失败'
    });
    res.status(400).json({ error: error.message });
  }
};

const getPrescription = async (req, res) => {
  try {
    const prescription = await prescriptionService.getPrescriptionById(req.params.id);
    if (!prescription) {
      return res.status(404).json({ error: '处方不存在' });
    }
    res.json(prescription);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const getPrescriptionByNo = async (req, res) => {
  try {
    const prescription = await prescriptionService.getPrescriptionByNo(req.params.no);
    if (!prescription) {
      return res.status(404).json({ error: '处方不存在' });
    }
    res.json(prescription);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const searchPrescriptions = async (req, res) => {
  try {
    const prescriptions = await prescriptionService.searchPrescriptions(req.query);
    res.json(prescriptions);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const updateStatus = async (req, res) => {
  try {
    const prescription = await prescriptionService.updateStatus(
      req.params.id,
      req.body.status,
      req.body
    );
    res.json(prescription);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const addPharmacistReview = async (req, res) => {
  try {
    const prescription = await prescriptionService.addPharmacistReview(
      req.params.id,
      req.body
    );
    res.json(prescription);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const addReturnRecord = async (req, res) => {
  try {
    const prescription = await prescriptionService.addReturnRecord(
      req.params.id,
      req.body
    );
    res.json(prescription);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const createExchangeRequest = async (req, res) => {
  try {
    const prescription = await prescriptionService.createExchangeRequest(
      req.params.id,
      req.body
    );
    res.json(prescription);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const approveExchange = async (req, res) => {
  try {
    const prescription = await prescriptionService.approveExchange(
      req.params.exchangeId,
      req.body
    );
    res.json(prescription);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const manualCorrection = async (req, res) => {
  try {
    const prescription = await prescriptionService.manualCorrection(
      req.params.id,
      req.body
    );
    res.json(prescription);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const generateReport = async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const report = await prescriptionService.generateRetentionReport(start_date, end_date);
    res.json(report);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const exportReport = async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const report = await prescriptionService.generateRetentionReport(start_date, end_date);
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="prescription-report-${Date.now()}.json"`);
    res.send(JSON.stringify(report, null, 2));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const getExceptions = async (req, res) => {
  try {
    const { handled } = req.query;
    const exceptions = await prescriptionService.getExceptions(
      handled !== undefined ? handled === 'true' : null
    );
    res.json(exceptions);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

module.exports = {
  createPrescription,
  getPrescription,
  getPrescriptionByNo,
  searchPrescriptions,
  updateStatus,
  addPharmacistReview,
  addReturnRecord,
  createExchangeRequest,
  approveExchange,
  manualCorrection,
  generateReport,
  exportReport,
  getExceptions
};
