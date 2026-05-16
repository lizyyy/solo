package com.dependency.license.service;

import com.dependency.license.model.*;
import com.dependency.license.repository.*;
import lombok.RequiredArgsConstructor;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVPrinter;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.OutputStreamWriter;
import java.nio.charset.StandardCharsets;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ExportService {
    private final UpgradeBatchRepository batchRepository;
    private final RepositoryApprovalRepository approvalRepository;
    private final DeferralRequestRepository deferralRequestRepository;
    private final AuditLogRepository auditLogRepository;

    public byte[] exportLicenseList(Long batchId) {
        UpgradeBatch batch = batchRepository.findById(batchId).orElseThrow();
        List<RepositoryApproval> approvals = approvalRepository.findByBatchId(batchId);
        List<DeferralRequest> deferrals = deferralRequestRepository.findByApprovalBatchId(batchId);
        List<AuditLog> auditLogs = auditLogRepository.findByEntityTypeAndEntityId("UpgradeBatch", batchId);

        try (ByteArrayOutputStream out = new ByteArrayOutputStream();
             OutputStreamWriter writer = new OutputStreamWriter(out, StandardCharsets.UTF_8);
             CSVPrinter csvPrinter = new CSVPrinter(writer, CSVFormat.DEFAULT
                     .withHeader("批次号", "批次名称", "依赖包", "当前版本", "目标版本",
                             "仓库名称", "负责人", "审批状态", "审批时间", "审批意见",
                             "延期申请", "延期原因", "异常说明"))) {

            for (RepositoryApproval approval : approvals) {
                String deferralInfo = "";
                String deferralReason = "";
                for (DeferralRequest d : deferrals) {
                    if (d.getApproval().getId().equals(approval.getId())) {
                        deferralInfo = d.getRequestedDate().toString();
                        deferralReason = d.getReason();
                        break;
                    }
                }

                String errorInfo = "";
                for (AuditLog log : auditLogs) {
                    if (!log.getSuccess()) {
                        errorInfo = log.getErrorMessage();
                        break;
                    }
                }

                csvPrinter.printRecord(
                        batch.getBatchNo(),
                        batch.getName(),
                        batch.getDependencyPackage().getName(),
                        batch.getDependencyPackage().getCurrentVersion(),
                        batch.getDependencyPackage().getTargetVersion(),
                        approval.getRepository().getName(),
                        approval.getApprover() != null ? approval.getApprover() : approval.getRepository().getMaintainer(),
                        approval.getStatus(),
                        approval.getApprovalTime() != null ? approval.getApprovalTime().toString() : "",
                        approval.getComment() != null ? approval.getComment() : "",
                        deferralInfo,
                        deferralReason,
                        errorInfo
                );
            }

            csvPrinter.flush();
            return out.toByteArray();
        } catch (Exception e) {
            throw new RuntimeException("导出失败", e);
        }
    }

    public byte[] exportAuditLogs() {
        List<AuditLog> logs = auditLogRepository.findAll();

        try (ByteArrayOutputStream out = new ByteArrayOutputStream();
             OutputStreamWriter writer = new OutputStreamWriter(out, StandardCharsets.UTF_8);
             CSVPrinter csvPrinter = new CSVPrinter(writer, CSVFormat.DEFAULT
                     .withHeader("ID", "操作类型", "实体类型", "实体ID", "是否成功",
                             "错误信息", "原始输入", "处理结果", "操作时间"))) {

            for (AuditLog log : logs) {
                csvPrinter.printRecord(
                        log.getId(),
                        log.getOperation(),
                        log.getEntityType(),
                        log.getEntityId(),
                        log.getSuccess(),
                        log.getErrorMessage() != null ? log.getErrorMessage() : "",
                        log.getOriginalInput() != null ? log.getOriginalInput() : "",
                        log.getProcessingResult() != null ? log.getProcessingResult() : "",
                        log.getCreatedAt() != null ? log.getCreatedAt().toString() : ""
                );
            }

            csvPrinter.flush();
            return out.toByteArray();
        } catch (Exception e) {
            throw new RuntimeException("导出失败", e);
        }
    }
}