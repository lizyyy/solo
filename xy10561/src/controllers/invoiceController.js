const invoiceService = require('../services/invoiceService');
const mergeService = require('../services/mergeService');

async function applyForInvoice(req, res, next) {
  try {
    const invoice = invoiceService.applyForInvoice(req.body);
    res.status(201).json({
      success: true,
      data: invoice,
      message: 'Invoice application submitted successfully'
    });
  } catch (error) {
    next(error);
  }
}

async function getInvoices(req, res, next) {
  try {
    const filters = {
      donationId: req.query.donationId,
      status: req.query.status,
      invoiceType: req.query.invoiceType
    };
    const invoices = invoiceService.getAllInvoices(filters);
    res.json({
      success: true,
      data: invoices,
      count: invoices.length,
      filters
    });
  } catch (error) {
    next(error);
  }
}

async function getInvoice(req, res, next) {
  try {
    const { invoiceId } = req.params;
    const invoice = invoiceService.getInvoice(invoiceId);
    if (!invoice) {
      return res.status(404).json({
        success: false,
        error: 'Invoice not found'
      });
    }
    res.json({
      success: true,
      data: invoice
    });
  } catch (error) {
    next(error);
  }
}

async function issueInvoice(req, res, next) {
  try {
    const { invoiceId } = req.params;
    const { operator, reason } = req.body;
    const invoice = invoiceService.issueInvoice(invoiceId, { operator, reason });
    res.json({
      success: true,
      data: invoice,
      message: 'Invoice issued successfully'
    });
  } catch (error) {
    next(error);
  }
}

async function cancelInvoice(req, res, next) {
  try {
    const { invoiceId } = req.params;
    const { operator, reason } = req.body;
    const invoice = invoiceService.cancelInvoice(invoiceId, { operator, reason });
    res.json({
      success: true,
      data: invoice,
      message: 'Invoice cancelled successfully'
    });
  } catch (error) {
    next(error);
  }
}

async function downloadInvoice(req, res, next) {
  try {
    const { invoiceId } = req.params;
    const invoice = invoiceService.downloadInvoice(invoiceId);
    res.json({
      success: true,
      data: invoice,
      message: 'Invoice downloaded successfully'
    });
  } catch (error) {
    next(error);
  }
}

async function correctInvoice(req, res, next) {
  try {
    const { invoiceId } = req.params;
    const { updates, operator, reason } = req.body;
    const invoice = invoiceService.correctInvoice(invoiceId, updates, { operator, reason });
    res.json({
      success: true,
      data: invoice,
      message: 'Invoice corrected successfully'
    });
  } catch (error) {
    next(error);
  }
}

async function createMergeRequest(req, res, next) {
  try {
    const mergeRequest = mergeService.createMergeRequest(req.body);
    res.status(201).json({
      success: true,
      data: mergeRequest,
      message: 'Merge request created successfully'
    });
  } catch (error) {
    next(error);
  }
}

async function getMergeRequests(req, res, next) {
  try {
    const filters = {
      status: req.query.status
    };
    const requests = mergeService.getAllMergeRequests(filters);
    res.json({
      success: true,
      data: requests,
      count: requests.length,
      filters
    });
  } catch (error) {
    next(error);
  }
}

async function getMergeRequest(req, res, next) {
  try {
    const { requestId } = req.params;
    const mergeRequest = mergeService.getMergeRequest(requestId);
    if (!mergeRequest) {
      return res.status(404).json({
        success: false,
        error: 'Merge request not found'
      });
    }
    res.json({
      success: true,
      data: mergeRequest
    });
  } catch (error) {
    next(error);
  }
}

async function processMergeRequest(req, res, next) {
  try {
    const { requestId } = req.params;
    const { operator } = req.body;
    const mergeRequest = mergeService.processMergeRequest(requestId, { operator });
    res.json({
      success: true,
      data: mergeRequest,
      message: 'Merge request processed successfully'
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  applyForInvoice,
  getInvoices,
  getInvoice,
  issueInvoice,
  cancelInvoice,
  downloadInvoice,
  correctInvoice,
  createMergeRequest,
  getMergeRequests,
  getMergeRequest,
  processMergeRequest
};
