const donationService = require('../services/donationService');

async function createProject(req, res, next) {
  try {
    const { name, description } = req.body;
    const project = donationService.createProject(name, description);
    res.status(201).json({
      success: true,
      data: project,
      message: 'Project created successfully'
    });
  } catch (error) {
    next(error);
  }
}

async function getProjects(req, res, next) {
  try {
    const projects = donationService.getAllProjects();
    res.json({
      success: true,
      data: projects,
      count: projects.length
    });
  } catch (error) {
    next(error);
  }
}

async function getProject(req, res, next) {
  try {
    const { projectId } = req.params;
    const project = donationService.getProject(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found'
      });
    }
    res.json({
      success: true,
      data: project
    });
  } catch (error) {
    next(error);
  }
}

async function createDonation(req, res, next) {
  try {
    const donation = donationService.createDonation(req.body);
    res.status(201).json({
      success: true,
      data: donation,
      message: 'Donation created successfully'
    });
  } catch (error) {
    next(error);
  }
}

async function getDonations(req, res, next) {
  try {
    const filters = {
      projectId: req.query.projectId,
      status: req.query.status,
      donorType: req.query.donorType
    };
    const donations = donationService.getAllDonations(filters);
    res.json({
      success: true,
      data: donations,
      count: donations.length,
      filters
    });
  } catch (error) {
    next(error);
  }
}

async function getDonation(req, res, next) {
  try {
    const { donationId } = req.params;
    const donation = donationService.getDonation(donationId);
    if (!donation) {
      return res.status(404).json({
        success: false,
        error: 'Donation not found'
      });
    }
    res.json({
      success: true,
      data: donation
    });
  } catch (error) {
    next(error);
  }
}

async function confirmDonation(req, res, next) {
  try {
    const { donationId } = req.params;
    const { operator, reason } = req.body;
    const donation = donationService.confirmDonation(donationId, { operator, reason });
    res.json({
      success: true,
      data: donation,
      message: 'Donation confirmed successfully'
    });
  } catch (error) {
    next(error);
  }
}

async function refundDonation(req, res, next) {
  try {
    const { donationId } = req.params;
    const { operator, reason } = req.body;
    const donation = donationService.refundDonation(donationId, { operator, reason });
    res.json({
      success: true,
      data: donation,
      message: 'Donation refunded successfully'
    });
  } catch (error) {
    next(error);
  }
}

async function addFundUsage(req, res, next) {
  try {
    const { projectId } = req.params;
    const { amount, purpose, description, operator } = req.body;
    const usage = donationService.addFundUsage(projectId, amount, purpose, description, operator);
    res.status(201).json({
      success: true,
      data: usage,
      message: 'Fund usage recorded successfully'
    });
  } catch (error) {
    next(error);
  }
}

async function getProjectFundUsage(req, res, next) {
  try {
    const { projectId } = req.params;
    const usages = donationService.getProjectFundUsage(projectId);
    const summary = donationService.getProjectFundSummary(projectId);
    res.json({
      success: true,
      data: {
        summary,
        usages
      }
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createProject,
  getProjects,
  getProject,
  createDonation,
  getDonations,
  getDonation,
  confirmDonation,
  refundDonation,
  addFundUsage,
  getProjectFundUsage
};
