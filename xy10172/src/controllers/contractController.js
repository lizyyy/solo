const contractService = require('../services/contractService');
const stateMachineService = require('../services/stateMachineService');

function extractOperator(req) {
  return {
    id: req.headers['x-user-id'] || 'anonymous',
    name: req.headers['x-user-name'] || 'Unknown User',
    email: req.headers['x-user-email'] || 'unknown@example.com',
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.headers['user-agent']
  };
}

function extractRequestId(req) {
  return req.headers['x-request-id'] || null;
}

async function createContract(req, res, next) {
  try {
    const operator = extractOperator(req);
    const requestId = extractRequestId(req);
    const contract = await contractService.createContract(req.body, operator, requestId);
    
    res.status(201).json({
      success: true,
      data: contract,
      message: '合同创建成功'
    });
  } catch (error) {
    next(error);
  }
}

async function getContracts(req, res, next) {
  try {
    const {
      page = 1,
      limit = 50,
      status,
      initiatorId,
      contractNo,
      startDate,
      endDate
    } = req.query;

    const result = await contractService.getContracts({
      page: parseInt(page),
      limit: parseInt(limit),
      status,
      initiatorId,
      contractNo,
      startDate,
      endDate
    });

    res.json({
      success: true,
      data: result.contracts,
      pagination: result.pagination
    });
  } catch (error) {
    next(error);
  }
}

async function getContract(req, res, next) {
  try {
    const { contractId } = req.params;
    const contract = await contractService.getContract(contractId);

    res.json({
      success: true,
      data: contract
    });
  } catch (error) {
    next(error);
  }
}

async function updateContract(req, res, next) {
  try {
    const { contractId } = req.params;
    const operator = extractOperator(req);
    const requestId = extractRequestId(req);
    
    const contract = await contractService.updateContractMetadata(
      contractId,
      req.body,
      operator,
      requestId
    );

    res.json({
      success: true,
      data: contract,
      message: '合同更新成功'
    });
  } catch (error) {
    next(error);
  }
}

async function initiateSigning(req, res, next) {
  try {
    const { contractId } = req.params;
    const operator = extractOperator(req);
    const requestId = extractRequestId(req);

    const contract = await contractService.initiateSigning(
      contractId,
      operator,
      requestId
    );

    res.json({
      success: true,
      data: contract,
      message: '签署流程已发起'
    });
  } catch (error) {
    next(error);
  }
}

async function signContract(req, res, next) {
  try {
    const { contractId } = req.params;
    const { partyId, signature } = req.body;
    const operator = extractOperator(req);
    const requestId = extractRequestId(req);

    const result = await contractService.signContract(
      contractId,
      partyId,
      { signature },
      operator,
      requestId
    );

    res.json({
      success: true,
      data: result,
      message: '签署成功'
    });
  } catch (error) {
    next(error);
  }
}

async function rejectContract(req, res, next) {
  try {
    const { contractId } = req.params;
    const { partyId, reason } = req.body;
    const operator = extractOperator(req);
    const requestId = extractRequestId(req);

    const result = await contractService.rejectContract(
      contractId,
      partyId,
      reason,
      operator,
      requestId
    );

    res.json({
      success: true,
      data: result,
      message: '拒签成功'
    });
  } catch (error) {
    next(error);
  }
}

async function withdrawContract(req, res, next) {
  try {
    const { contractId } = req.params;
    const { reason } = req.body;
    const operator = extractOperator(req);
    const requestId = extractRequestId(req);

    const contract = await contractService.withdrawContract(
      contractId,
      reason,
      operator,
      requestId
    );

    res.json({
      success: true,
      data: contract,
      message: '合同已撤回'
    });
  } catch (error) {
    next(error);
  }
}

async function reinitiateContract(req, res, next) {
  try {
    const { contractId } = req.params;
    const operator = extractOperator(req);
    const requestId = extractRequestId(req);

    const contract = await contractService.reinitiateContract(
      contractId,
      req.body,
      operator,
      requestId
    );

    res.json({
      success: true,
      data: contract,
      message: '合同已重新发起'
    });
  } catch (error) {
    next(error);
  }
}

async function supplementSign(req, res, next) {
  try {
    const { contractId } = req.params;
    const { parties } = req.body;
    const operator = extractOperator(req);
    const requestId = extractRequestId(req);

    const contract = await contractService.supplementSign(
      contractId,
      parties,
      operator,
      requestId
    );

    res.json({
      success: true,
      data: contract,
      message: '补签流程已启动'
    });
  } catch (error) {
    next(error);
  }
}

async function deleteContract(req, res, next) {
  try {
    const { contractId } = req.params;
    const operator = extractOperator(req);
    const requestId = extractRequestId(req);

    const result = await contractService.deleteContract(
      contractId,
      operator,
      requestId
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
}

async function getStateInfo(req, res) {
  res.json({
    success: true,
    data: {
      statuses: stateMachineService.SIGN_STATUSES,
      operations: stateMachineService.OPERATIONS,
      transitions: stateMachineService.STATE_TRANSITIONS
    }
  });
}

async function checkAllowedTransitions(req, res, next) {
  try {
    const { contractId } = req.params;
    const contract = await contractService.getContract(contractId);

    const allowedTransitions = stateMachineService.getAllowedTransitions(contract.status);
    const allowedOperations = [];

    for (const op of Object.values(stateMachineService.OPERATIONS)) {
      const check = stateMachineService.canPerformOperation(contract.status, op);
      if (check.allowed) {
        allowedOperations.push({
          operation: op,
          description: stateMachineService.getOperationDescription(op),
          targetState: check.targetState
        });
      }
    }

    res.json({
      success: true,
      data: {
        currentStatus: contract.status,
        currentStatusDescription: stateMachineService.getStateDescription(contract.status),
        allowedTransitions,
        allowedOperations
      }
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createContract,
  getContracts,
  getContract,
  updateContract,
  initiateSigning,
  signContract,
  rejectContract,
  withdrawContract,
  reinitiateContract,
  supplementSign,
  deleteContract,
  getStateInfo,
  checkAllowedTransitions
};
