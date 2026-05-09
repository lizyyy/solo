const Contract = require('../models/Contract');
const stateMachineService = require('./stateMachineService');
const versionService = require('./versionService');
const callbackService = require('./callbackService');
const auditService = require('./auditService');
const { v4: uuidv4 } = require('uuid');

const PARTY_STATUS = Contract.getPartyStatuses();

function generateContractNo() {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `CTR-${dateStr}-${random}`;
}

async function createContract(data, operator, requestId) {
  const {
    title,
    description,
    parties,
    pdfMetadata,
    callbackUrl,
    effectiveDate,
    expirationDate,
    metadata
  } = data;

  const contract = new Contract({
    contractNo: generateContractNo(),
    title,
    description,
    status: stateMachineService.SIGN_STATUSES.DRAFT,
    parties: parties.map((party, index) => ({
      id: party.id || `PARTY-${index + 1}-${uuidv4().slice(0, 6).toUpperCase()}`,
      name: party.name,
      email: party.email,
      phone: party.phone,
      status: PARTY_STATUS.PENDING
    })),
    pdfMetadata,
    callbackUrl,
    initiator: {
      id: operator.id,
      name: operator.name,
      email: operator.email
    },
    effectiveDate: effectiveDate ? new Date(effectiveDate) : undefined,
    expirationDate: expirationDate ? new Date(expirationDate) : undefined,
    metadata: metadata ? new Map(Object.entries(metadata)) : undefined
  });

  await contract.save();

  await versionService.createVersion(contract, operator.id, false);

  await auditService.logContractCreation(contract, operator, requestId);

  if (callbackUrl) {
    await callbackService.createAndExecuteCallback(
      contract,
      callbackService.CALLBACK_EVENTS.CONTRACT_CREATED,
      {
        contractId: contract._id,
        contractNo: contract.contractNo,
        status: contract.status,
        timestamp: new Date().toISOString()
      },
      { operationId: auditService.generateOperationId() }
    );
  }

  return contract;
}

async function initiateSigning(contractId, operator, requestId, options = {}) {
  const contract = await Contract.findById(contractId);

  if (!contract) {
    throw new Error('合同不存在');
  }

  if (contract.isDeleted) {
    throw new Error('合同已删除');
  }

  const opCheck = stateMachineService.canPerformOperation(
    contract.status,
    stateMachineService.OPERATIONS.INITIATE
  );

  if (!opCheck.allowed) {
    throw new Error(opCheck.reason);
  }

  if (contract.parties.length === 0) {
    throw new Error('合同没有签署方');
  }

  const previousState = {
    status: contract.status,
    version: contract.currentVersion
  };

  contract.previousStatus = contract.status;
  contract.status = stateMachineService.SIGN_STATUSES.INITIATED;
  contract.lastOperationId = auditService.generateOperationId();

  await contract.save();

  await versionService.freezeVersion(
    contract._id,
    contract.currentVersion,
    operator.id,
    '发起签署前自动冻结',
    requestId
  );

  await auditService.logInitiateSigning(contract, operator, requestId, previousState);

  if (contract.callbackUrl) {
    await callbackService.createAndExecuteCallback(
      contract,
      callbackService.CALLBACK_EVENTS.SIGNING_INITIATED,
      {
        contractId: contract._id,
        contractNo: contract.contractNo,
        status: contract.status,
        initiator: contract.initiator,
        parties: contract.parties.map(p => ({
          id: p.id,
          name: p.name,
          email: p.email
        })),
        timestamp: new Date().toISOString()
      },
      { operationId: contract.lastOperationId }
    );
  }

  return contract;
}

async function signContract(contractId, partyId, signatureData, operator, requestId) {
  const contract = await Contract.findById(contractId);

  if (!contract) {
    throw new Error('合同不存在');
  }

  if (contract.isDeleted) {
    throw new Error('合同已删除');
  }

  const opCheck = stateMachineService.canPerformOperation(
    contract.status,
    stateMachineService.OPERATIONS.SIGN
  );

  if (!opCheck.allowed) {
    throw new Error(opCheck.reason);
  }

  const party = contract.parties.find(p => p.id === partyId);

  if (!party) {
    throw new Error(`签署方 ${partyId} 不存在`);
  }

  if (party.status === PARTY_STATUS.SIGNED) {
    throw new Error('该签署方已签署');
  }

  if (party.status === PARTY_STATUS.REJECTED) {
    throw new Error('该签署方已拒签');
  }

  party.status = PARTY_STATUS.SIGNED;
  party.signedAt = new Date();
  party.signature = signatureData.signature;
  party.ip = operator.ip;
  party.userAgent = operator.userAgent;

  const signedCount = contract.parties.filter(p => p.status === PARTY_STATUS.SIGNED).length;
  const totalParties = contract.parties.length;

  if (signedCount === totalParties) {
    contract.previousStatus = contract.status;
    contract.status = stateMachineService.SIGN_STATUSES.COMPLETED;
  } else if (signedCount > 0 && signedCount < totalParties) {
    contract.previousStatus = contract.status;
    contract.status = stateMachineService.SIGN_STATUSES.PARTIALLY_SIGNED;
  } else {
    contract.previousStatus = contract.status;
    contract.status = stateMachineService.SIGN_STATUSES.IN_SIGNING;
  }

  contract.lastOperationId = auditService.generateOperationId();

  await contract.save();

  await auditService.logSign(contract, party, operator, requestId);

  if (contract.callbackUrl) {
    const event = contract.status === stateMachineService.SIGN_STATUSES.COMPLETED
      ? callbackService.CALLBACK_EVENTS.CONTRACT_COMPLETED
      : callbackService.CALLBACK_EVENTS.PARTY_SIGNED;

    await callbackService.createAndExecuteCallback(
      contract,
      event,
      {
        contractId: contract._id,
        contractNo: contract.contractNo,
        status: contract.status,
        party: {
          id: party.id,
          name: party.name,
          email: party.email,
          signedAt: party.signedAt
        },
        signedCount,
        totalParties,
        timestamp: new Date().toISOString()
      },
      { operationId: contract.lastOperationId }
    );
  }

  if (contract.status === stateMachineService.SIGN_STATUSES.COMPLETED) {
    await auditService.logComplete(contract, operator, requestId);
  }

  return { contract, party };
}

async function rejectContract(contractId, partyId, reason, operator, requestId) {
  const contract = await Contract.findById(contractId);

  if (!contract) {
    throw new Error('合同不存在');
  }

  if (contract.isDeleted) {
    throw new Error('合同已删除');
  }

  const opCheck = stateMachineService.canPerformOperation(
    contract.status,
    stateMachineService.OPERATIONS.REJECT
  );

  if (!opCheck.allowed) {
    throw new Error(opCheck.reason);
  }

  const party = contract.parties.find(p => p.id === partyId);

  if (!party) {
    throw new Error(`签署方 ${partyId} 不存在`);
  }

  if (party.status === PARTY_STATUS.SIGNED) {
    throw new Error('该签署方已签署，无法拒签');
  }

  if (party.status === PARTY_STATUS.REJECTED) {
    throw new Error('该签署方已拒签');
  }

  party.status = PARTY_STATUS.REJECTED;
  contract.previousStatus = contract.status;
  contract.status = stateMachineService.SIGN_STATUSES.REJECTED;
  contract.lastOperationId = auditService.generateOperationId();

  await contract.save();

  await auditService.logReject(contract, party, operator, requestId, reason);

  if (contract.callbackUrl) {
    await callbackService.createAndExecuteCallback(
      contract,
      callbackService.CALLBACK_EVENTS.PARTY_REJECTED,
      {
        contractId: contract._id,
        contractNo: contract.contractNo,
        status: contract.status,
        party: {
          id: party.id,
          name: party.name,
          email: party.email
        },
        reason,
        timestamp: new Date().toISOString()
      },
      { operationId: contract.lastOperationId }
    );
  }

  return { contract, party };
}

async function withdrawContract(contractId, reason, operator, requestId) {
  const contract = await Contract.findById(contractId);

  if (!contract) {
    throw new Error('合同不存在');
  }

  if (contract.isDeleted) {
    throw new Error('合同已删除');
  }

  const opCheck = stateMachineService.canPerformOperation(
    contract.status,
    stateMachineService.OPERATIONS.WITHDRAW
  );

  if (!opCheck.allowed) {
    throw new Error(opCheck.reason);
  }

  const previousState = {
    status: contract.status,
    version: contract.currentVersion
  };

  contract.previousStatus = contract.status;
  contract.status = stateMachineService.SIGN_STATUSES.WITHDRAWN;
  contract.lastOperationId = auditService.generateOperationId();

  await contract.save();

  await auditService.logWithdraw(contract, operator, requestId, reason, previousState);

  if (contract.callbackUrl) {
    await callbackService.createAndExecuteCallback(
      contract,
      callbackService.CALLBACK_EVENTS.CONTRACT_WITHDRAWN,
      {
        contractId: contract._id,
        contractNo: contract.contractNo,
        status: contract.status,
        reason,
        previousStatus: previousState.status,
        timestamp: new Date().toISOString()
      },
      { operationId: contract.lastOperationId }
    );
  }

  return contract;
}

async function reinitiateContract(contractId, updates, operator, requestId) {
  const contract = await Contract.findById(contractId);

  if (!contract) {
    throw new Error('合同不存在');
  }

  if (contract.isDeleted) {
    throw new Error('合同已删除');
  }

  const opCheck = stateMachineService.canPerformOperation(
    contract.status,
    stateMachineService.OPERATIONS.REINITIATE
  );

  if (!opCheck.allowed) {
    throw new Error(opCheck.reason);
  }

  const previousState = {
    status: contract.status,
    version: contract.currentVersion
  };

  if (updates) {
    if (updates.title) contract.title = updates.title;
    if (updates.description) contract.description = updates.description;
    if (updates.pdfMetadata) contract.pdfMetadata = { ...contract.pdfMetadata, ...updates.pdfMetadata };
    if (updates.callbackUrl) contract.callbackUrl = updates.callbackUrl;
    if (updates.effectiveDate) contract.effectiveDate = new Date(updates.effectiveDate);
    if (updates.expirationDate) contract.expirationDate = new Date(updates.expirationDate);
    if (updates.metadata) {
      contract.metadata = new Map([...(contract.metadata || []), ...Object.entries(updates.metadata)]);
    }

    if (updates.parties) {
      contract.parties = updates.parties.map((party, index) => ({
        id: party.id || `PARTY-${index + 1}-${uuidv4().slice(0, 6).toUpperCase()}`,
        name: party.name,
        email: party.email,
        phone: party.phone,
        status: PARTY_STATUS.PENDING
      }));
    }
  }

  contract.previousStatus = contract.status;
  contract.status = stateMachineService.SIGN_STATUSES.REINITIATED;
  contract.currentVersion += 1;
  contract.lastOperationId = auditService.generateOperationId();

  await contract.save();

  await versionService.createVersion(contract, operator.id, true, '重新发起前自动冻结');

  await auditService.logReinitiate(contract, operator, requestId, previousState);

  if (contract.callbackUrl) {
    await callbackService.createAndExecuteCallback(
      contract,
      callbackService.CALLBACK_EVENTS.CONTRACT_REINITIATED,
      {
        contractId: contract._id,
        contractNo: contract.contractNo,
        status: contract.status,
        newVersion: contract.currentVersion,
        previousStatus: previousState.status,
        timestamp: new Date().toISOString()
      },
      { operationId: contract.lastOperationId }
    );
  }

  return contract;
}

async function supplementSign(contractId, additionalParties, operator, requestId) {
  const contract = await Contract.findById(contractId);

  if (!contract) {
    throw new Error('合同不存在');
  }

  if (contract.isDeleted) {
    throw new Error('合同已删除');
  }

  const opCheck = stateMachineService.canPerformOperation(
    contract.status,
    stateMachineService.OPERATIONS.SUPPLEMENT_SIGN
  );

  if (!opCheck.allowed) {
    throw new Error(opCheck.reason);
  }

  const existingPartyIds = contract.parties.map(p => p.id);
  const startIndex = contract.parties.length;

  const newParties = additionalParties.map((party, index) => ({
    id: party.id || `PARTY-${startIndex + index + 1}-${uuidv4().slice(0, 6).toUpperCase()}`,
    name: party.name,
    email: party.email,
    phone: party.phone,
    status: PARTY_STATUS.PENDING
  }));

  contract.parties = [...contract.parties, ...newParties];
  contract.previousStatus = contract.status;
  contract.status = stateMachineService.SIGN_STATUSES.IN_SIGNING;
  contract.currentVersion += 1;
  contract.lastOperationId = auditService.generateOperationId();

  await contract.save();

  await versionService.createVersion(contract, operator.id, true, '补签前自动冻结');

  await auditService.logSupplementSign(contract, operator, requestId);

  return contract;
}

async function getContract(contractId) {
  const contract = await Contract.findById(contractId).lean();
  if (!contract) {
    throw new Error('合同不存在');
  }
  return contract;
}

async function getContracts(options = {}) {
  const {
    page = 1,
    limit = 50,
    status,
    initiatorId,
    contractNo,
    startDate,
    endDate
  } = options;

  const query = { isDeleted: false };

  if (status) {
    query.status = status;
  }

  if (initiatorId) {
    query['initiator.id'] = initiatorId;
  }

  if (contractNo) {
    query.contractNo = { $regex: contractNo, $options: 'i' };
  }

  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }

  const skip = (page - 1) * limit;

  const [contracts, total] = await Promise.all([
    Contract.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Contract.countDocuments(query)
  ]);

  return {
    contracts,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
}

async function updateContractMetadata(contractId, updates, operator, requestId) {
  const contract = await Contract.findById(contractId);

  if (!contract) {
    throw new Error('合同不存在');
  }

  if (contract.isDeleted) {
    throw new Error('合同已删除');
  }

  if (contract.status !== stateMachineService.SIGN_STATUSES.DRAFT) {
    throw new Error('只能在草稿状态下更新合同');
  }

  const previousState = {
    status: contract.status,
    version: contract.currentVersion,
    parties: contract.parties,
    metadata: contract.metadata
  };

  if (updates.title) contract.title = updates.title;
  if (updates.description) contract.description = updates.description;
  if (updates.parties) {
    contract.parties = updates.parties.map((party, index) => ({
      id: party.id || `PARTY-${index + 1}-${uuidv4().slice(0, 6).toUpperCase()}`,
      name: party.name,
      email: party.email,
      phone: party.phone,
      status: PARTY_STATUS.PENDING
    }));
  }
  if (updates.pdfMetadata) contract.pdfMetadata = { ...contract.pdfMetadata, ...updates.pdfMetadata };
  if (updates.callbackUrl) contract.callbackUrl = updates.callbackUrl;
  if (updates.effectiveDate) contract.effectiveDate = new Date(updates.effectiveDate);
  if (updates.expirationDate) contract.expirationDate = new Date(updates.expirationDate);
  if (updates.metadata) {
    contract.metadata = new Map([...(contract.metadata || []), ...Object.entries(updates.metadata)]);
  }

  await contract.save();

  await versionService.createVersion(contract, operator.id, false);

  await auditService.logContractUpdate(contract, operator, requestId, previousState);

  return contract;
}

async function deleteContract(contractId, operator, requestId) {
  const contract = await Contract.findById(contractId);

  if (!contract) {
    throw new Error('合同不存在');
  }

  if (contract.isDeleted) {
    throw new Error('合同已删除');
  }

  if (contract.status !== stateMachineService.SIGN_STATUSES.DRAFT) {
    throw new Error('只能删除草稿状态的合同');
  }

  contract.isDeleted = true;
  await contract.save();

  await auditService.createAuditLog({
    action: 'delete_contract',
    description: `删除合同 ${contract.contractNo}`,
    contractId: contract._id,
    contractNo: contract.contractNo,
    operator,
    requestId,
    source: 'api'
  });

  return { success: true, message: '合同已删除' };
}

module.exports = {
  createContract,
  initiateSigning,
  signContract,
  rejectContract,
  withdrawContract,
  reinitiateContract,
  supplementSign,
  getContract,
  getContracts,
  updateContractMetadata,
  deleteContract,
  generateContractNo
};
