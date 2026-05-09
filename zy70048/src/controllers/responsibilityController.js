const ResponsibilityService = require('../services/ResponsibilityService');

exports.assignResponsibility = async (req, res, next) => {
  try {
    const responsibility = await ResponsibilityService.assignResponsibility(
      req.params.id,
      req.body
    );
    res.status(201).json({
      success: true,
      data: responsibility
    });
  } catch (error) {
    next(error);
  }
};

exports.getResponsibilities = async (req, res, next) => {
  try {
    const responsibilities = await ResponsibilityService.getResponsibilityByLineStop(
      req.params.id
    );
    res.json({
      success: true,
      data: responsibilities
    });
  } catch (error) {
    next(error);
  }
};

exports.appealResponsibility = async (req, res, next) => {
  try {
    const result = await ResponsibilityService.appealResponsibility(
      req.params.responsibilityId,
      req.body.operator,
      req.body.appealReason
    );
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

exports.finalizeResponsibility = async (req, res, next) => {
  try {
    const result = await ResponsibilityService.finalizeResponsibility(
      req.params.responsibilityId,
      req.body.operator
    );
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};
