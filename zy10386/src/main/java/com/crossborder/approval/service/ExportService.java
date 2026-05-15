package com.crossborder.approval.service;

import com.crossborder.approval.model.entity.*;
import com.crossborder.approval.repository.AuditLogRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.format.DateTimeFormatter;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class ExportService {

    private final ApplicationService applicationService;
    private final ApprovalService approvalService;
    private final EvidenceService evidenceService;
    private final TokenService tokenService;
    private final AuditLogRepository auditLogRepository;

    private static final DateTimeFormatter FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    public String exportTroubleshootingReport(String applicationNo) {
        DataAccessApplication application = applicationService.getApplicationByNo(applicationNo);

        StringBuilder report = new StringBuilder();
        report.append("=".repeat(80)).append("\n");
        report.append("跨境数据访问审批 - 问题排查汇总报告\n");
        report.append("=".repeat(80)).append("\n\n");

        report.append("【1. 申请基本信息】\n");
        report.append("申请编号: ").append(application.getApplicationNo()).append("\n");
        report.append("申请人: ").append(application.getApplicantName()).append(" (").append(application.getApplicantId()).append(")\n");
        report.append("数据域: ").append(application.getDataDomain().getName()).append(" (").append(application.getDataDomain().getCode()).append(")\n");
        report.append("目标地区: ").append(application.getTargetRegion()).append("\n");
        report.append("访问理由: ").append(application.getAccessReason()).append("\n");
        report.append("当前状态: ").append(application.getStatus()).append("\n");
        report.append("创建时间: ").append(application.getCreatedAt().format(FORMATTER)).append("\n");
        report.append("更新时间: ").append(application.getUpdatedAt().format(FORMATTER)).append("\n\n");

        report.append("【2. 审批流程历史】\n");
        List<ApprovalChain> approvals = approvalService.getApprovalHistory(application.getId());
        if (approvals.isEmpty()) {
            report.append("暂无审批记录\n");
        } else {
            for (ApprovalChain approval : approvals) {
                report.append("- 第").append(approval.getApprovalLevel()).append("级审批: ");
                report.append(approval.getApproverName()).append(" (").append(approval.getApproverId()).append(")\n");
                report.append("  结果: ").append(approval.getResult()).append("\n");
                if (approval.getComment() != null) {
                    report.append("  意见: ").append(approval.getComment()).append("\n");
                }
                if (approval.getApprovedAt() != null) {
                    report.append("  时间: ").append(approval.getApprovedAt().format(FORMATTER)).append("\n");
                }
                report.append("\n");
            }
        }

        report.append("【3. 令牌信息】\n");
        AccessToken token = tokenService.getTokenByApplication(application.getId());
        if (token == null) {
            report.append("未签发令牌\n");
        } else {
            report.append("令牌标识: ").append(token.getToken(), 0, Math.min(20, token.getToken().length())).append("...\n");
            report.append("签发时间: ").append(token.getIssuedAt().format(FORMATTER)).append("\n");
            report.append("过期时间: ").append(token.getExpiresAt().format(FORMATTER)).append("\n");
            report.append("是否活跃: ").append(token.getIsActive() ? "是" : "否").append("\n");
            report.append("访问次数: ").append(token.getAccessCount()).append("\n");
            if (token.getLastAccessTime() != null) {
                report.append("最后访问: ").append(token.getLastAccessTime().format(FORMATTER)).append("\n");
            }
            if (token.getRevokedAt() != null) {
                report.append("吊销时间: ").append(token.getRevokedAt().format(FORMATTER)).append("\n");
                report.append("吊销原因: ").append(token.getRevokeReason()).append("\n");
            }
        }
        report.append("\n");

        report.append("【4. 审计日志时间线】\n");
        List<AuditLog> auditLogs = auditLogRepository.findByApplicationIdOrderByTimestampDesc(application.getId());
        if (auditLogs.isEmpty()) {
            report.append("暂无审计日志\n");
        } else {
            for (AuditLog log : auditLogs) {
                report.append("- [").append(log.getTimestamp().format(FORMATTER)).append("] ");
                report.append(log.getAction()).append(" - ");
                report.append(log.getOperatorName() != null ? log.getOperatorName() : "系统");
                if (log.getDetails() != null) {
                    report.append(" | ").append(log.getDetails());
                }
                report.append("\n");
            }
        }
        report.append("\n");

        report.append("【5. 取证记录】\n");
        List<EvidenceRecord> evidences = evidenceService.getEvidenceByApplication(application.getId());
        if (evidences.isEmpty()) {
            report.append("暂无取证记录\n");
        } else {
            for (EvidenceRecord evidence : evidences) {
                report.append("- [").append(evidence.getCollectedAt().format(FORMATTER)).append("] ");
                report.append(evidence.getEvidenceType()).append("\n");
                report.append("  内容: ").append(evidence.getEvidenceContent()).append("\n");
                report.append("  哈希: ").append(evidence.getEvidenceHash()).append("\n\n");
            }
        }

        report.append("=".repeat(80)).append("\n");
        report.append("报告生成时间: ").append(java.time.LocalDateTime.now().format(FORMATTER)).append("\n");
        report.append("=".repeat(80)).append("\n");

        log.info("问题排查报告已导出: {}", applicationNo);
        return report.toString();
    }
}
