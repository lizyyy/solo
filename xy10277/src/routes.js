const express = require('express');
const router = express.Router();
const service = require('./dispenseService');
const store = require('./dataStore');

function validateCreateClaim(req, res, next) {
  const { requestId, babyId, batchId } = req.body;
  if (!requestId || !babyId || !batchId) {
    return res.status(400).json({
      status: 'FAIL',
      code: 'MISSING_PARAMS',
      message: '缺少必要参数: requestId, babyId, batchId'
    });
  }
  next();
}

function validateAdvanceClaim(req, res, next) {
  const { claimId } = req.body;
  if (!claimId) {
    return res.status(400).json({
      status: 'FAIL',
      code: 'MISSING_PARAMS',
      message: '缺少必要参数: claimId'
    });
  }
  next();
}

function validateWithdrawClaim(req, res, next) {
  const { claimId, reason } = req.body;
  if (!claimId || !reason) {
    return res.status(400).json({
      status: 'FAIL',
      code: 'MISSING_PARAMS',
      message: '缺少必要参数: claimId, reason'
    });
  }
  next();
}

function validateCorrectBaby(req, res, next) {
  const { babyId } = req.body;
  if (!babyId) {
    return res.status(400).json({
      status: 'FAIL',
      code: 'MISSING_PARAMS',
      message: '缺少必要参数: babyId'
    });
  }
  next();
}

function validateCorrectClaim(req, res, next) {
  const { claimId, correction } = req.body;
  if (!claimId || !correction || !correction.type) {
    return res.status(400).json({
      status: 'FAIL',
      code: 'MISSING_PARAMS',
      message: '缺少必要参数: claimId, correction.type'
    });
  }
  next();
}

router.get('/babies', (req, res) => {
  const babies = store.getAllBabies();
  const validated = babies.map(baby => ({
    ...baby,
    validation: service.validateBabyProfile(baby)
  }));
  res.json({
    status: 'PASS',
    code: 'QUERY_SUCCESS',
    message: '查询成功',
    data: validated
  });
});

router.get('/babies/:babyId', (req, res) => {
  const baby = store.getBaby(req.params.babyId);
  if (!baby) {
    return res.status(404).json({
      status: 'FAIL',
      code: 'BABY_NOT_FOUND',
      message: '宝宝档案不存在'
    });
  }
  const validation = service.validateBabyProfile(baby);
  res.json({
    status: 'PASS',
    code: 'QUERY_SUCCESS',
    message: '查询成功',
    data: {
      ...baby,
      validation
    }
  });
});

router.get('/batches', (req, res) => {
  const batches = store.getAllBatches();
  const validated = batches.map(batch => ({
    ...batch,
    validation: service.validateBatch(batch)
  }));
  res.json({
    status: 'PASS',
    code: 'QUERY_SUCCESS',
    message: '查询成功',
    data: validated
  });
});

router.get('/batches/:batchId', (req, res) => {
  const batch = store.getBatch(req.params.batchId);
  if (!batch) {
    return res.status(404).json({
      status: 'FAIL',
      code: 'BATCH_NOT_FOUND',
      message: '批次不存在'
    });
  }
  const validation = service.validateBatch(batch);
  res.json({
    status: 'PASS',
    code: 'QUERY_SUCCESS',
    message: '查询成功',
    data: {
      ...batch,
      validation
    }
  });
});

router.post('/claims/create', validateCreateClaim, (req, res) => {
  const { requestId, babyId, batchId, operator } = req.body;
  const result = service.createClaim(requestId, babyId, batchId, operator);

  let httpStatus = 200;
  if (result.status === 'FAIL') httpStatus = 400;
  if (result.status === 'MANUAL') httpStatus = 202;

  res.status(httpStatus).json(result);
});

router.post('/claims/advance', validateAdvanceClaim, (req, res) => {
  const { claimId, operator } = req.body;
  const result = service.advanceClaim(claimId, operator);

  let httpStatus = 200;
  if (result.status === 'FAIL') httpStatus = 400;
  if (result.status === 'MANUAL') httpStatus = 202;

  res.status(httpStatus).json(result);
});

router.post('/claims/withdraw', validateWithdrawClaim, (req, res) => {
  const { claimId, reason, operator } = req.body;
  const result = service.withdrawClaim(claimId, reason, operator);

  let httpStatus = 200;
  if (result.status === 'FAIL') httpStatus = 400;

  res.status(httpStatus).json(result);
});

router.post('/babies/correct', validateCorrectBaby, (req, res) => {
  const { babyId, updates, operator } = req.body;
  const result = service.correctBabyProfile(babyId, updates, operator);

  let httpStatus = 200;
  if (result.status === 'FAIL') httpStatus = 400;

  res.status(httpStatus).json(result);
});

router.post('/claims/correct', validateCorrectClaim, (req, res) => {
  const { claimId, correction, operator } = req.body;
  const result = service.correctClaim(claimId, correction, operator);

  let httpStatus = 200;
  if (result.status === 'FAIL') httpStatus = 400;
  if (result.status === 'MANUAL') httpStatus = 202;

  res.status(httpStatus).json(result);
});

router.get('/claims', (req, res) => {
  const claims = store.getAllClaims();
  res.json({
    status: 'PASS',
    code: 'QUERY_SUCCESS',
    message: '查询成功',
    data: claims
  });
});

router.get('/claims/:claimId', (req, res) => {
  const claim = store.getClaim(req.params.claimId);
  if (!claim) {
    return res.status(404).json({
      status: 'FAIL',
      code: 'CLAIM_NOT_FOUND',
      message: '领取记录不存在'
    });
  }
  const history = store.getClaimHistory(req.params.claimId);
  res.json({
    status: 'PASS',
    code: 'QUERY_SUCCESS',
    message: '查询成功',
    data: {
      claim,
      history
    }
  });
});

router.get('/summary', (req, res) => {
  const result = service.queryClaimsSummary();
  res.json(result);
});

router.get('/babies/:babyId/claims', (req, res) => {
  const result = service.queryBabyClaims(req.params.babyId);
  if (result.status === 'FAIL') {
    return res.status(404).json(result);
  }
  res.json(result);
});

router.post('/check/eligibility', (req, res) => {
  const { babyId, batchId } = req.body;
  const baby = store.getBaby(babyId);
  const batch = store.getBatch(batchId);

  if (!baby || !batch) {
    return res.status(400).json({
      status: 'FAIL',
      code: 'NOT_FOUND',
      message: '宝宝或批次不存在'
    });
  }

  const babyValidation = service.validateBabyProfile(baby);
  const batchValidation = service.validateBatch(batch);
  const ageCheck = service.checkAgeEligibility(baby.months, batch.monthRange);
  const allergenCheck = service.checkAllergenSafety(baby.allergies, batch.allergenRisk);
  const duplicateCheck = service.checkDuplicateClaim(babyId, batchId);

  const allChecks = {
    babyProfile: babyValidation,
    batchStatus: batchValidation,
    ageEligibility: ageCheck,
    allergenSafety: allergenCheck,
    duplicateCheck
  };

  const hasInvalid = babyValidation.status === 'INVALID' ||
    batchValidation.status === 'INVALID';
  const hasEligibilityFail = !ageCheck.eligible ||
    !allergenCheck.safe || duplicateCheck.duplicate;
  const hasUncertain = babyValidation.status === 'UNCERTAIN' ||
    batchValidation.status === 'UNCERTAIN';

  let overall = 'PASS';
  if (hasInvalid || hasEligibilityFail) overall = 'FAIL';
  else if (hasUncertain) overall = 'MANUAL';

  res.json({
    status: overall,
    code: 'ELIGIBILITY_CHECKED',
    message: overall === 'PASS' ? '资格检查通过' :
      overall === 'FAIL' ? '资格检查不通过' : '需要人工审核',
    details: allChecks
  });
});

module.exports = router;
