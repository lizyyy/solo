const historyService = require('../services/historyService');
const versionService = require('../services/versionService');

async function getContractFullHistory(req, res, next) {
  try {
    const { contractId } = req.params;
    const history = await historyService.getContractFullHistory(contractId);

    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    next(error);
  }
}

async function getVersionTimeline(req, res, next) {
  try {
    const { contractId } = req.params;
    const timeline = await historyService.getVersionTimeline(contractId);

    res.json({
      success: true,
      data: timeline
    });
  } catch (error) {
    next(error);
  }
}

async function getStateTransitionHistory(req, res, next) {
  try {
    const { contractId } = req.params;
    const history = await historyService.getStateTransitionHistory(contractId);

    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    next(error);
  }
}

async function getCallbackHistory(req, res, next) {
  try {
    const { contractId } = req.params;
    const { page = 1, limit = 50, event, status } = req.query;

    const history = await historyService.getCallbackHistory(contractId, {
      page: parseInt(page),
      limit: parseInt(limit),
      event,
      status
    });

    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    next(error);
  }
}

async function getPartySigningHistory(req, res, next) {
  try {
    const { contractId, partyId } = req.params;
    const history = await historyService.getPartySigningHistory(contractId, partyId);

    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    next(error);
  }
}

async function getCompensationHistory(req, res, next) {
  try {
    const { contractId } = req.params;
    const history = await historyService.getCompensationHistory(contractId);

    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    next(error);
  }
}

async function getVersionDetails(req, res, next) {
  try {
    const { contractId, version } = req.params;
    const versionData = await versionService.getVersionByContractAndVersion(
      contractId,
      parseInt(version)
    );

    if (!versionData) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '版本不存在'
        }
      });
    }

    res.json({
      success: true,
      data: versionData
    });
  } catch (error) {
    next(error);
  }
}

async function compareVersions(req, res, next) {
  try {
    const { contractId, version1, version2 } = req.params;
    const comparison = await versionService.compareVersions(
      contractId,
      parseInt(version1),
      parseInt(version2)
    );

    res.json({
      success: true,
      data: comparison
    });
  } catch (error) {
    next(error);
  }
}

async function getAllVersions(req, res, next) {
  try {
    const { contractId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const result = await versionService.getAllVersions(contractId, {
      page: parseInt(page),
      limit: parseInt(limit)
    });

    res.json({
      success: true,
      data: result.versions,
      pagination: result.pagination
    });
  } catch (error) {
    next(error);
  }
}

async function getFrozenVersions(req, res, next) {
  try {
    const { contractId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const result = await versionService.getFrozenVersions(contractId, {
      page: parseInt(page),
      limit: parseInt(limit)
    });

    res.json({
      success: true,
      data: result.versions,
      pagination: result.pagination
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getContractFullHistory,
  getVersionTimeline,
  getStateTransitionHistory,
  getCallbackHistory,
  getPartySigningHistory,
  getCompensationHistory,
  getVersionDetails,
  compareVersions,
  getAllVersions,
  getFrozenVersions
};
