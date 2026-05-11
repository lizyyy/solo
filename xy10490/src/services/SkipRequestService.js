const { SkipRequest, MaintenancePlan, Equipment, MaintenanceRecord } = require('../models');
const { generateSkipRequestId, generateRecordId } = require('../utils/idGenerator');

class SkipRequestService {
  async createSkipRequest(planId, requestData) {
    const plan = await MaintenancePlan.findById(planId);
    if (!plan) {
      const error = new Error('保养计划不存在');
      error.statusCode = 404;
      throw error;
    }

    if (plan.status === 'completed') {
      const error = new Error('已完成的保养计划不能申请跳过');
      error.statusCode = 400;
      throw error;
    }

    if (plan.status === 'skipped') {
      const error = new Error('该保养计划已被跳过');
      error.statusCode = 400;
      throw error;
    }

    const existingPending = await SkipRequest.findOne({
      planId: plan._id,
      status: 'pending'
    });

    if (existingPending) {
      const error = new Error('该保养计划已有待审批的跳过申请');
      error.statusCode = 409;
      throw error;
    }

    const request = await SkipRequest.create({
      requestId: generateSkipRequestId(),
      equipmentId: plan.equipmentId,
      planId: plan._id,
      reason: requestData.reason,
      requestedBy: requestData.requestedBy,
      status: 'pending'
    });

    return request;
  }

  async approveSkipRequest(requestId, approvalData) {
    const request = await SkipRequest.findById(requestId);
    if (!request) {
      const error = new Error('跳过申请不存在');
      error.statusCode = 404;
      throw error;
    }

    if (request.status !== 'pending') {
      const error = new Error(`申请状态为${request.status}，无法审批`);
      error.statusCode = 400;
      throw error;
    }

    const plan = await MaintenancePlan.findById(request.planId);
    const equipment = await Equipment.findOne({ equipmentId: plan.equipmentId });
    const now = new Date();

    request.status = 'approved';
    request.approvedBy = approvalData.approvedBy;
    request.approvedAt = now;
    request.approvalNotes = approvalData.approvalNotes;
    await request.save();

    plan.status = 'skipped';
    plan.skipRequestId = request._id;
    plan.reminderEnabled = false;
    await plan.save();

    await MaintenanceRecord.create({
      recordId: generateRecordId(),
      equipmentId: plan.equipmentId,
      planId: plan._id,
      maintenanceType: plan.planType,
      runningHours: equipment.currentRunningHours,
      completedBy: approvalData.approvedBy,
      completedAt: now,
      status: 'skipped',
      notes: `跳过原因: ${request.reason}`
    });

    const MaintenancePlanService = require('./MaintenancePlanService');
    const nextPlan = await MaintenancePlanService.createPlanAfterSkip(equipment, plan);

    return {
      approvedRequest: request,
      updatedPlan: plan,
      nextPlan
    };
  }

  async rejectSkipRequest(requestId, approvalData) {
    const request = await SkipRequest.findById(requestId);
    if (!request) {
      const error = new Error('跳过申请不存在');
      error.statusCode = 404;
      throw error;
    }

    if (request.status !== 'pending') {
      const error = new Error(`申请状态为${request.status}，无法审批`);
      error.statusCode = 400;
      throw error;
    }

    request.status = 'rejected';
    request.approvedBy = approvalData.approvedBy;
    request.approvedAt = new Date();
    request.approvalNotes = approvalData.approvalNotes;
    await request.save();

    return request;
  }

  async getPendingRequests() {
    return await SkipRequest.find({ status: 'pending' }).sort({ createdAt: -1 });
  }

  async getRequestById(requestId) {
    return await SkipRequest.findById(requestId);
  }
}

module.exports = new SkipRequestService();
