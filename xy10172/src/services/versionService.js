const ContractVersion = require('../models/ContractVersion');
const Contract = require('../models/Contract');
const auditService = require('./auditService');

async function createVersion(contract, createdBy, freeze = false, freezeReason = null) {
  const versionData = {
    contractId: contract._id,
    version: contract.currentVersion,
    contractNo: contract.contractNo,
    title: contract.title,
    description: contract.description,
    status: contract.status,
    parties: contract.parties,
    pdfMetadata: contract.pdfMetadata,
    callbackUrl: contract.callbackUrl,
    initiator: contract.initiator,
    effectiveDate: contract.effectiveDate,
    expirationDate: contract.expirationDate,
    metadata: contract.metadata,
    createdBy
  };

  const version = new ContractVersion(versionData);
  
  if (freeze) {
    version.isFrozen = true;
    version.frozenAt = new Date();
    version.frozenBy = createdBy;
    version.freezeReason = freezeReason || '发起签署前自动冻结';
  }

  await version.save();
  return version;
}

async function getLatestVersion(contractId) {
  return ContractVersion.findOne({ contractId })
    .sort({ version: -1 })
    .lean();
}

async function getVersionByContractAndVersion(contractId, version) {
  return ContractVersion.findOne({ contractId, version }).lean();
}

async function getAllVersions(contractId, options = {}) {
  const { page = 1, limit = 20 } = options;
  const skip = (page - 1) * limit;

  const [versions, total] = await Promise.all([
    ContractVersion.find({ contractId })
      .sort({ version: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    ContractVersion.countDocuments({ contractId })
  ]);

  return {
    versions,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
}

async function freezeVersion(contractId, version, userId, reason, requestId) {
  const contractVersion = await ContractVersion.findOne({ contractId, version });
  
  if (!contractVersion) {
    throw new Error(`版本 ${version} 不存在`);
  }

  if (contractVersion.isFrozen) {
    throw new Error('版本已冻结，无法重复冻结');
  }

  contractVersion.isFrozen = true;
  contractVersion.frozenAt = new Date();
  contractVersion.frozenBy = userId;
  contractVersion.freezeReason = reason;

  await contractVersion.save();

  await auditService.logFreezeVersion(contractVersion, { id: userId }, requestId);

  return contractVersion;
}

async function compareVersions(contractId, version1, version2) {
  const v1 = await ContractVersion.findOne({ contractId, version: version1 }).lean();
  const v2 = await ContractVersion.findOne({ contractId, version: version2 }).lean();

  if (!v1 || !v2) {
    throw new Error('指定的版本不存在');
  }

  const differences = [];

  if (v1.title !== v2.title) {
    differences.push({
      field: 'title',
      version1: v1.title,
      version2: v2.title
    });
  }

  if (v1.description !== v2.description) {
    differences.push({
      field: 'description',
      version1: v1.description,
      version2: v2.description
    });
  }

  if (v1.status !== v2.status) {
    differences.push({
      field: 'status',
      version1: v1.status,
      version2: v2.status
    });
  }

  if (JSON.stringify(v1.parties) !== JSON.stringify(v2.parties)) {
    differences.push({
      field: 'parties',
      version1: v1.parties,
      version2: v2.parties
    });
  }

  if (JSON.stringify(v1.pdfMetadata) !== JSON.stringify(v2.pdfMetadata)) {
    differences.push({
      field: 'pdfMetadata',
      version1: v1.pdfMetadata,
      version2: v2.pdfMetadata
    });
  }

  return {
    version1,
    version2,
    differences,
    hasDifferences: differences.length > 0
  };
}

async function restoreFromVersion(contractId, version, userId, requestId) {
  const contractVersion = await ContractVersion.findOne({ contractId, version });
  
  if (!contractVersion) {
    throw new Error(`版本 ${version} 不存在`);
  }

  const contract = await Contract.findById(contractId);
  
  if (!contract) {
    throw new Error('合同不存在');
  }

  if (contract.isDeleted) {
    throw new Error('合同已删除');
  }

  const previousState = {
    status: contract.status,
    version: contract.currentVersion,
    parties: contract.parties,
    metadata: contract.metadata
  };

  const newVersion = contract.currentVersion + 1;

  contract.title = contractVersion.title;
  contract.description = contractVersion.description;
  contract.parties = contractVersion.parties;
  contract.pdfMetadata = contractVersion.pdfMetadata;
  contract.callbackUrl = contractVersion.callbackUrl;
  contract.effectiveDate = contractVersion.effectiveDate;
  contract.expirationDate = contractVersion.expirationDate;
  contract.metadata = contractVersion.metadata;
  contract.currentVersion = newVersion;

  await contract.save();

  await createVersion(contract, userId, false);

  await auditService.logContractUpdate(contract, { id: userId }, requestId, previousState);

  return contract;
}

async function getFrozenVersions(contractId, options = {}) {
  const { page = 1, limit = 20 } = options;
  const skip = (page - 1) * limit;

  const [versions, total] = await Promise.all([
    ContractVersion.find({ contractId, isFrozen: true })
      .sort({ version: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    ContractVersion.countDocuments({ contractId, isFrozen: true })
  ]);

  return {
    versions,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
}

module.exports = {
  createVersion,
  getLatestVersion,
  getVersionByContractAndVersion,
  getAllVersions,
  freezeVersion,
  compareVersions,
  restoreFromVersion,
  getFrozenVersions
};
