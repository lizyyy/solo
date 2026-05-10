const ApprovalService = require('../services/ApprovalService');
const ResponseHandler = require('../utils/responseHandler');

class ApprovalController {
  static async createApprovalRequest(req, res) {
    try {
      const request = ApprovalService.createApprovalRequest(req.body);
      
      return ResponseHandler.created(
        res,
        { request: ApprovalService.generateApprovalReport(request) },
        `审批请求已提交，类型：${request.getApprovalTypeDescription()}`
      );
    } catch (error) {
      return ResponseHandler.error(res, error);
    }
  }

  static async approveRequest(req, res) {
    try {
      const result = ApprovalService.approveApprovalRequest(
        req.params.id,
        req.body.approvedBy,
        req.body.comments || []
      );
      
      return ResponseHandler.success(
        res,
        {
          request: ApprovalService.generateApprovalReport(result.request),
          result: result.result
        },
        result.result.businessSummary.message
      );
    } catch (error) {
      return ResponseHandler.error(res, error);
    }
  }

  static async rejectRequest(req, res) {
    try {
      const result = ApprovalService.rejectApprovalRequest(
        req.params.id,
        req.body.rejectedBy,
        req.body.rejectionReason,
        req.body.comments || []
      );
      
      return ResponseHandler.success(
        res,
        {
          request: ApprovalService.generateApprovalReport(result.request),
          result: result.result
        },
        result.result.businessSummary.message
      );
    } catch (error) {
      return ResponseHandler.error(res, error);
    }
  }

  static async getRequestById(req, res) {
    try {
      const request = ApprovalService.getApprovalRequestById(req.params.id);
      if (!request) {
        return ResponseHandler.notFound(res, '审批请求');
      }
      
      return ResponseHandler.success(
        res,
        { request: ApprovalService.generateApprovalReport(request) },
        `查询成功：审批请求 ${request.id}`
      );
    } catch (error) {
      return ResponseHandler.error(res, error);
    }
  }

  static async getRequestsByContract(req, res) {
    try {
      const requests = ApprovalService.getApprovalRequestsByContractId(req.params.contractId);
      
      return ResponseHandler.success(
        res,
        {
          count: requests.length,
          requests: requests.map(r => ApprovalService.generateApprovalReport(r))
        },
        `共查询到 ${requests.length} 条审批记录`
      );
    } catch (error) {
      return ResponseHandler.error(res, error);
    }
  }

  static async getPendingRequests(req, res) {
    try {
      const requests = ApprovalService.getPendingApprovalRequests();
      
      return ResponseHandler.success(
        res,
        {
          count: requests.length,
          requests: requests.map(r => ApprovalService.generateApprovalReport(r))
        },
        `共有 ${requests.length} 条待审批的请求`
      );
    } catch (error) {
      return ResponseHandler.error(res, error);
    }
  }
}

module.exports = ApprovalController;
