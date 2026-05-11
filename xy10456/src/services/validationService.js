const { prepare } = require('../database');

const CLAIM_STATUS = {
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  UNDER_REVIEW: 'UNDER_REVIEW',
  SUPPLEMENT_REQUESTED: 'SUPPLEMENT_REQUESTED',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  CLOSED: 'CLOSED'
};

const STAGES = {
  APPLICATION: 'APPLICATION',
  MATERIAL_CHECK: 'MATERIAL_CHECK',
  REVIEW: 'REVIEW',
  PAYMENT: 'PAYMENT',
  CLOSED: 'CLOSED'
};

const isMaterialExpired = (material) => {
  if (!material.expiry_date) return false;
  return new Date(material.expiry_date) < new Date();
};

const canModifyCoreInfo = (claim) => {
  return claim.status === CLAIM_STATUS.DRAFT || claim.status === CLAIM_STATUS.SUBMITTED;
};

const canAddMaterial = (claim) => {
  return claim.status !== CLAIM_STATUS.CLOSED && 
         claim.status !== CLAIM_STATUS.REJECTED;
};

const canRequestSupplement = (claim) => {
  return claim.status === CLAIM_STATUS.UNDER_REVIEW || 
         claim.status === CLAIM_STATUS.SUBMITTED;
};

const canApprove = (claim) => {
  return claim.status === CLAIM_STATUS.UNDER_REVIEW;
};

const canReject = (claim) => {
  return claim.status === CLAIM_STATUS.UNDER_REVIEW;
};

const canClose = (claim) => {
  return claim.status === CLAIM_STATUS.APPROVED;
};

const getMaterialGaps = (claimId, insuranceTypeId) => {
  const requirements = db.prepare(`
    SELECT * FROM material_requirements 
    WHERE insurance_type_id = ? AND is_required = 1
  `).all(insuranceTypeId);

  const submittedMaterials = db.prepare(`
    SELECT * FROM claim_materials 
    WHERE claim_id = ?
  `).all(claimId);

  const submittedCodes = new Set(submittedMaterials.map(m => m.material_code));
  
  const gaps = [];
  for (const req of requirements) {
    if (!submittedCodes.has(req.material_code)) {
      gaps.push({
        material_code: req.material_code,
        material_name: req.material_name,
        reason: 'MISSING'
      });
    } else {
      const material = submittedMaterials.find(m => m.material_code === req.material_code);
      if (isMaterialExpired(material)) {
        gaps.push({
          material_code: req.material_code,
          material_name: req.material_name,
          reason: 'EXPIRED'
        });
      }
    }
  }
  
  return gaps;
};

const calculateProcessingTime = (claim) => {
  const startTime = new Date(claim.created_at);
  const endTime = claim.closed_at ? new Date(claim.closed_at) : new Date();
  const diffMs = endTime - startTime;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  
  return {
    days: diffDays,
    hours: diffHours,
    total_minutes: Math.floor(diffMs / (1000 * 60))
  };
};

const isDuplicateMaterial = (claimId, materialCode) => {
  const existing = db.prepare(`
    SELECT * FROM claim_materials 
    WHERE claim_id = ? AND material_code = ?
  `).get(claimId, materialCode);
  
  return !!existing;
};

const validateInsuranceTypeMatch = (claimInsuranceTypeId, materialInsuranceTypeId) => {
  return claimInsuranceTypeId === materialInsuranceTypeId;
};

const calculateEstimatedPayout = (claimedAmount, maxPayout, hasGaps) => {
  if (hasGaps) return 0;
  return Math.min(claimedAmount, maxPayout);
};

module.exports = {
  CLAIM_STATUS,
  STAGES,
  isMaterialExpired,
  canModifyCoreInfo,
  canAddMaterial,
  canRequestSupplement,
  canApprove,
  canReject,
  canClose,
  getMaterialGaps,
  calculateProcessingTime,
  isDuplicateMaterial,
  validateInsuranceTypeMatch,
  calculateEstimatedPayout
};
