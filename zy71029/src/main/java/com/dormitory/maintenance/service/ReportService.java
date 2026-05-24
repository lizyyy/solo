package com.dormitory.maintenance.service;

import com.dormitory.maintenance.entity.ApprovalRecord;
import com.dormitory.maintenance.entity.AuditLog;
import com.dormitory.maintenance.entity.Complaint;
import com.dormitory.maintenance.entity.MaintenanceOrder;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class ReportService {

    @Autowired
    private MaintenanceOrderService orderService;

    @Autowired
    private ApprovalService approvalService;

    @Autowired
    private ComplaintService complaintService;

    @Autowired
    private AuditLogService auditLogService;

    public Map<String, Object> generateOrderReport(String orderNo) {
        MaintenanceOrder order = orderService.getOrderByNo(orderNo);
        List<ApprovalRecord> approvals = approvalService.getOrderApprovalsByNo(orderNo);
        List<Complaint> complaints = complaintService.getComplaintsByOrderNo(orderNo);
        List<AuditLog> auditTrail = auditLogService.getOrderAuditTrail(orderNo);

        Map<String, Object> report = new HashMap<>();
        report.put("order", extractOrderInfo(order));
        report.put("approvals", approvals.stream().map(this::extractApprovalInfo).toList());
        report.put("complaints", complaints.stream().map(this::extractComplaintInfo).toList());
        report.put("auditTrail", auditTrail.stream().map(this::extractAuditInfo).toList());
        report.put("generatedAt", java.time.LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")));

        return report;
    }

    public String generateOrderReportAsText(String orderNo) {
        Map<String, Object> report = generateOrderReport(orderNo);
        StringBuilder sb = new StringBuilder();

        sb.append("=".repeat(80)).append("\n");
        sb.append("宿舍维修工单审批报告\n");
        sb.append("=".repeat(80)).append("\n\n");

        Map<String, Object> order = (Map<String, Object>) report.get("order");
        sb.append("【工单信息】\n");
        sb.append("- 工单编号: ").append(order.get("orderNo")).append("\n");
        sb.append("- 工单标题: ").append(order.get("title")).append("\n");
        sb.append("- 宿舍楼: ").append(order.get("building")).append("\n");
        sb.append("- 施工队: ").append(order.get("team")).append("\n");
        sb.append("- 计划时间: ").append(order.get("scheduledTime")).append("\n");
        sb.append("- 当前状态: ").append(order.get("status")).append("\n");
        sb.append("- 校验结果: ").append(order.get("validationResult")).append("\n");
        sb.append("- 冲突详情: ").append(order.get("conflictDetail")).append("\n\n");

        List<Map<String, Object>> approvals = (List<Map<String, Object>>) report.get("approvals");
        if (!approvals.isEmpty()) {
            sb.append("【审批记录】\n");
            for (int i = 0; i < approvals.size(); i++) {
                Map<String, Object> a = approvals.get(i);
                sb.append(String.format("%d. 审批人: %s, 结果: %s, 时间: %s\n",
                        i + 1, a.get("approver"), a.get("result"), a.get("approvalTime")));
                sb.append("   备注: ").append(a.get("approvalRemark")).append("\n");
                sb.append("   处置说明: ").append(a.get("handlingInstruction")).append("\n");
            }
            sb.append("\n");
        }

        List<Map<String, Object>> complaints = (List<Map<String, Object>>) report.get("complaints");
        if (!complaints.isEmpty()) {
            sb.append("【投诉记录】\n");
            for (int i = 0; i < complaints.size(); i++) {
                Map<String, Object> c = complaints.get(i);
                sb.append(String.format("%d. 投诉编号: %s, 类型: %s, 状态: %s\n",
                        i + 1, c.get("complaintNo"), c.get("complaintType"), c.get("status")));
                sb.append("   内容: ").append(c.get("content")).append("\n");
                sb.append("   处理结果: ").append(c.get("handleResult")).append("\n");
            }
            sb.append("\n");
        }

        List<Map<String, Object>> auditTrail = (List<Map<String, Object>>) report.get("auditTrail");
        if (!auditTrail.isEmpty()) {
            sb.append("【操作轨迹】\n");
            for (int i = 0; i < auditTrail.size(); i++) {
                Map<String, Object> a = auditTrail.get(i);
                sb.append(String.format("%d. 操作: %s, 操作人: %s, 时间: %s\n",
                        i + 1, a.get("action"), a.get("operator"), a.get("operatedAt")));
                sb.append("   变更原因: ").append(a.get("changeReason")).append("\n");
                sb.append("   变更内容: ").append(a.get("oldValue")).append(" -> ").append(a.get("newValue")).append("\n");
            }
        }

        sb.append("\n").append("=".repeat(80)).append("\n");
        sb.append("报告生成时间: ").append(report.get("generatedAt")).append("\n");
        sb.append("=".repeat(80)).append("\n");

        return sb.toString();
    }

    private Map<String, Object> extractOrderInfo(MaintenanceOrder order) {
        Map<String, Object> info = new HashMap<>();
        info.put("orderNo", order.getOrderNo());
        info.put("batchNo", order.getBatchNo());
        info.put("title", order.getTitle());
        info.put("description", order.getDescription());
        info.put("building", order.getBuilding().getBuildingName());
        info.put("team", order.getTeam() != null ? order.getTeam().getTeamName() : "未分配");
        info.put("roomNo", order.getRoomNo());
        info.put("scheduledTime", order.getScheduledStartTime() + " 至 " + order.getScheduledEndTime());
        info.put("actualStartTime", order.getActualStartTime());
        info.put("actualEndTime", order.getActualEndTime());
        info.put("status", order.getStatus().getDescription());
        info.put("applicant", order.getApplicant());
        info.put("auditor", order.getAuditor());
        info.put("validationResult", order.getValidationResult() != null ? order.getValidationResult() : "无");
        info.put("conflictDetail", order.getConflictDetail() != null ? order.getConflictDetail() : "无");
        info.put("hasConflict", order.getHasConflict());
        info.put("isEmergency", order.getIsEmergency());
        return info;
    }

    private Map<String, Object> extractApprovalInfo(ApprovalRecord approval) {
        Map<String, Object> info = new HashMap<>();
        info.put("approver", approval.getApprover());
        info.put("result", approval.getResult().getDescription());
        info.put("approvalTime", approval.getApprovalTime() != null ?
                approval.getApprovalTime().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")) : "-");
        info.put("approvalLevel", approval.getApprovalLevel());
        info.put("approvalRemark", approval.getApprovalRemark() != null ? approval.getApprovalRemark() : "无");
        info.put("handlingInstruction", approval.getHandlingInstruction() != null ? approval.getHandlingInstruction() : "无");
        info.put("originalTime", (approval.getOriginalStartTime() != null ? approval.getOriginalStartTime() : "-") +
                " 至 " + (approval.getOriginalEndTime() != null ? approval.getOriginalEndTime() : "-"));
        info.put("adjustedTime", (approval.getAdjustedStartTime() != null ? approval.getAdjustedStartTime() : "无调整") +
                " 至 " + (approval.getAdjustedEndTime() != null ? approval.getAdjustedEndTime() : "无调整"));
        return info;
    }

    private Map<String, Object> extractComplaintInfo(Complaint complaint) {
        Map<String, Object> info = new HashMap<>();
        info.put("complaintNo", complaint.getComplaintNo());
        info.put("complaintType", complaint.getComplaintType());
        info.put("content", complaint.getContent());
        info.put("studentName", complaint.getStudentName() != null ? complaint.getStudentName() : "匿名");
        info.put("status", complaint.getStatus().getDescription());
        info.put("handler", complaint.getHandler() != null ? complaint.getHandler() : "未处理");
        info.put("handleResult", complaint.getHandleResult() != null ? complaint.getHandleResult() : "无");
        info.put("handleTime", complaint.getHandleTime() != null ?
                complaint.getHandleTime().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")) : "-");
        return info;
    }

    private Map<String, Object> extractAuditInfo(AuditLog log) {
        Map<String, Object> info = new HashMap<>();
        info.put("action", log.getAction());
        info.put("operator", log.getOperator());
        info.put("operatedAt", log.getOperatedAt().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")));
        info.put("changeReason", log.getChangeReason() != null ? log.getChangeReason() : "无");
        info.put("oldValue", log.getOldValue() != null ? log.getOldValue() : "-");
        info.put("newValue", log.getNewValue() != null ? log.getNewValue() : "-");
        return info;
    }
}
