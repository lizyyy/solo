package com.metadata.repair.service;

import com.metadata.repair.dto.*;
import com.metadata.repair.entity.*;
import com.metadata.repair.enums.*;
import com.metadata.repair.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class MetadataRepairService {
    private final AttachmentRepository attachmentRepository;
    private final RepairBatchRepository repairBatchRepository;
    private final RepairExceptionRepository repairExceptionRepository;
    private final RepairHistoryRepository repairHistoryRepository;

    @Transactional
    public ApiResponse<BatchResponse> createBatch(CreateBatchRequest request) {
        if (repairBatchRepository.existsByBatchNo(request.getBatchNo())) {
            RepairBatch existingBatch = repairBatchRepository.findByBatchNo(request.getBatchNo()).get();
            log.info("批次已存在，直接返回: {}", request.getBatchNo());
            return ApiResponse.success("批次已存在，返回现有数据", convertToBatchResponse(existingBatch));
        }

        RepairBatch batch = new RepairBatch();
        batch.setBatchNo(request.getBatchNo());
        batch.setBatchName(request.getBatchName() != null ? request.getBatchName() : "修复批次-" + request.getBatchNo());
        batch.setOperator(request.getOperator());
        batch.setDescription(request.getDescription());
        batch.setStatus(RepairStatus.CREATED);
        batch.setTotalCount(request.getAttachments().size());
        batch.setAttachmentFileIds(request.getAttachments().stream()
                .map(AttachmentDTO::getFileId)
                .collect(Collectors.toList()));

        saveAttachments(request.getAttachments());

        repairBatchRepository.save(batch);
        saveHistory(batch.getBatchNo(), null, RepairStatus.CREATED, request.getOperator(), "批次创建成功");

        log.info("批次创建成功: {}", batch.getBatchNo());
        return ApiResponse.success("批次创建成功", convertToBatchResponse(batch));
    }

    @Transactional
    public ApiResponse<BatchResponse> validateBatch(String batchNo, String operator) {
        RepairBatch batch = repairBatchRepository.findByBatchNo(batchNo)
                .orElseThrow(() -> new RuntimeException("批次不存在: " + batchNo));

        if (batch.getStatus() != RepairStatus.CREATED) {
            return ApiResponse.success("批次状态不是CREATED，无需重复校验", convertToBatchResponse(batch));
        }

        updateStatus(batch, RepairStatus.VALIDATING, operator, "开始校验");

        int validationErrorCount = 0;
        for (String fileId : batch.getAttachmentFileIds()) {
            Attachment attachment = attachmentRepository.findByFileId(fileId).orElse(null);
            if (attachment == null) {
                validationErrorCount++;
                saveException(batchNo, fileId, "VALIDATION_FAILED", "附件不存在", null, "VALIDATION");
                continue;
            }

            List<String> missingFields = new ArrayList<>();
            
            if (attachment.getBusinessNo() == null || attachment.getBusinessNo().trim().isEmpty()) {
                missingFields.add("业务单号(businessNo)");
            }
            
            if (attachment.getFileName() == null || attachment.getFileName().trim().isEmpty()) {
                missingFields.add("文件名(fileName)");
            }

            if (!missingFields.isEmpty()) {
                validationErrorCount++;
                String errorMsg = "关键元数据缺失: " + String.join(", ", missingFields);
                saveException(batchNo, fileId, "MISSING_CRITICAL_METADATA", errorMsg, null, "VALIDATION");
                log.warn("附件 {} 校验失败: {}", fileId, errorMsg);
            }
        }

        batch.setFailedCount(validationErrorCount);
        batch.setSuccessCount(batch.getTotalCount() - validationErrorCount);

        String resultMsg;
        if (validationErrorCount > 0) {
            resultMsg = "校验完成，发现 " + validationErrorCount + " 个附件存在元数据问题";
        } else {
            resultMsg = "校验完成，所有附件元数据完整";
        }
        
        updateStatus(batch, RepairStatus.VALIDATED, operator, resultMsg);

        log.info("批次校验完成: {}, 异常数: {}", batchNo, validationErrorCount);
        return ApiResponse.success(resultMsg, convertToBatchResponse(batch));
    }

    @Transactional
    public ApiResponse<BatchResponse> startRepair(String batchNo, String operator) {
        RepairBatch batch = repairBatchRepository.findByBatchNo(batchNo)
                .orElseThrow(() -> new RuntimeException("批次不存在: " + batchNo));

        if (batch.getStatus() == RepairStatus.SUCCESS || batch.getStatus() == RepairStatus.FAILED) {
            return ApiResponse.success("批次已完成，无需重复处理", convertToBatchResponse(batch));
        }

        if (batch.getStatus() != RepairStatus.VALIDATED) {
            return ApiResponse.error(400, "批次未经过校验，不能开始修复");
        }

        updateStatus(batch, RepairStatus.PROCESSING, operator, "开始修复处理");

        int successCount = 0;
        int failedCount = 0;
        int skippedCount = 0;
        int partialFixedCount = 0;
        List<String> successFiles = new ArrayList<>();

        for (String fileId : batch.getAttachmentFileIds()) {
            try {
                Attachment attachment = attachmentRepository.findByFileId(fileId).orElse(null);
                if (attachment == null) {
                    skippedCount++;
                    continue;
                }

                if (attachment.getMetadataComplete()) {
                    skippedCount++;
                    continue;
                }

                List<String> repairResults = new ArrayList<>();
                List<String> repairFailures = new ArrayList<>();

                boolean criticalFixed = performCriticalMetadataRepair(attachment, repairResults, repairFailures);
                performOptionalMetadataRepair(attachment, repairResults);
                performPermissionInference(attachment, repairResults);

                if (criticalFixed) {
                    attachment.setMetadataComplete(repairFailures.isEmpty());
                    attachmentRepository.save(attachment);
                    
                    if (repairFailures.isEmpty()) {
                        successCount++;
                        successFiles.add(fileId);
                        log.info("附件 {} 修复完成: {}", fileId, String.join("; ", repairResults));
                    } else {
                        partialFixedCount++;
                        String errorMsg = "部分元数据无法自动修复: " + String.join(", ", repairFailures);
                        saveException(batchNo, fileId, "PARTIAL_REPAIR_FAILED", errorMsg, null, "REPAIR");
                        log.warn("附件 {} 部分修复失败: {}", fileId, errorMsg);
                    }
                } else {
                    failedCount++;
                    String errorMsg = "关键元数据修复失败，存在不可恢复的缺失";
                    saveException(batchNo, fileId, "CRITICAL_REPAIR_FAILED", errorMsg, null, "REPAIR");
                    log.error("附件 {} 修复失败: {}", fileId, errorMsg);
                }

            } catch (Exception e) {
                failedCount++;
                saveException(batchNo, fileId, "REPAIR_EXCEPTION", "修复过程异常: " + e.getMessage(),
                        Arrays.toString(e.getStackTrace()), "REPAIR");
                log.error("附件 {} 修复异常: {}", fileId, e.getMessage(), e);
            }
        }

        batch.setSuccessCount(successCount);
        batch.setFailedCount(failedCount + partialFixedCount);
        batch.setSkippedCount(skippedCount);
        batch.setCompletedAt(LocalDateTime.now());

        RepairStatus finalStatus;
        String statusRemark;
        if (failedCount == 0 && partialFixedCount == 0 && skippedCount == 0) {
            finalStatus = RepairStatus.SUCCESS;
            statusRemark = "全部修复成功";
        } else if (successCount > 0) {
            finalStatus = RepairStatus.PARTIAL_SUCCESS;
            statusRemark = String.format("部分修复成功: %d个成功, %d个失败, %d个跳过", successCount, failedCount + partialFixedCount, skippedCount);
        } else {
            finalStatus = RepairStatus.FAILED;
            statusRemark = "全部修复失败";
        }

        updateStatus(batch, finalStatus, operator, statusRemark);

        log.info("批次修复完成: {}, 状态: {}", batchNo, finalStatus);
        return ApiResponse.success(statusRemark, convertToBatchResponse(batch));
    }

    private boolean performCriticalMetadataRepair(Attachment attachment, List<String> results, List<String> failures) {
        if (attachment.getBusinessNo() == null || attachment.getBusinessNo().trim().isEmpty()) {
            failures.add("业务单号缺失，无法自动推断");
        }

        if (attachment.getFileName() == null || attachment.getFileName().trim().isEmpty()) {
            if (attachment.getFileId() != null) {
                attachment.setFileName("file_" + attachment.getFileId() + ".dat");
                results.add("文件名自动补全为: " + attachment.getFileName());
            } else {
                failures.add("文件名缺失且无法补全（缺少FileId）");
            }
        }

        return failures.isEmpty();
    }

    private void performOptionalMetadataRepair(Attachment attachment, List<String> results) {
        if (attachment.getFileType() == null && attachment.getFileName() != null) {
            String fileName = attachment.getFileName();
            if (fileName.contains(".")) {
                attachment.setFileType(fileName.substring(fileName.lastIndexOf(".") + 1).toUpperCase());
                results.add("文件类型自动推断为: " + attachment.getFileType());
            } else {
                attachment.setFileType("UNKNOWN");
                results.add("文件类型设为: UNKNOWN");
            }
        }

        if (attachment.getUploadTime() == null) {
            attachment.setUploadTime(LocalDateTime.now());
            results.add("上传时间设为当前时间");
        }

        if (attachment.getFileSize() == null) {
            attachment.setFileSize(0L);
            results.add("文件大小设为: 0");
        }
    }

    private void performPermissionInference(Attachment attachment, List<String> results) {
        if (attachment.getPermissionLevel() != null) {
            return;
        }

        SourceSystem source = attachment.getSourceSystem();
        String fileName = attachment.getFileName();
        String businessNo = attachment.getBusinessNo();

        PermissionLevel inferredLevel;

        if (source == SourceSystem.FINANCE ||
                (fileName != null && (fileName.contains("财务") || fileName.contains("budget") || fileName.contains("finance")))) {
            inferredLevel = PermissionLevel.CONFIDENTIAL;
            results.add("权限级别推断为: CONFIDENTIAL (财务系统)");
        } else if (source == SourceSystem.EHR ||
                (fileName != null && (fileName.contains("人事") || fileName.contains("salary") || fileName.contains("employee")))) {
            inferredLevel = PermissionLevel.RESTRICTED;
            results.add("权限级别推断为: RESTRICTED (人事系统)");
        } else if (source == SourceSystem.CRM ||
                (fileName != null && (fileName.contains("客户") || fileName.contains("customer")))) {
            inferredLevel = PermissionLevel.INTERNAL;
            results.add("权限级别推断为: INTERNAL (客户系统)");
        } else if (source == SourceSystem.OA || source == SourceSystem.ERP) {
            inferredLevel = PermissionLevel.INTERNAL;
            results.add("权限级别推断为: INTERNAL (办公/ERP系统)");
        } else {
            inferredLevel = PermissionLevel.INTERNAL;
            results.add("权限级别默认设为: INTERNAL");
        }

        attachment.setPermissionLevel(inferredLevel);

        if (source == null) {
            attachment.setSourceSystem(SourceSystem.UNKNOWN);
            results.add("来源系统默认设为: UNKNOWN");
        }
    }

    public ApiResponse<BatchResponse> getBatchStatus(String batchNo) {
        RepairBatch batch = repairBatchRepository.findByBatchNo(batchNo)
                .orElseThrow(() -> new RuntimeException("批次不存在: " + batchNo));
        return ApiResponse.success(convertToBatchResponse(batch));
    }

    public ApiResponse<List<BatchResponse>> listBatches() {
        List<RepairBatch> batches = repairBatchRepository.findAll();
        List<BatchResponse> responses = batches.stream()
                .map(this::convertToBatchResponse)
                .collect(Collectors.toList());
        return ApiResponse.success(responses);
    }

    public ApiResponse<RepairReport> getRepairReport(String batchNo) {
        RepairBatch batch = repairBatchRepository.findByBatchNo(batchNo)
                .orElseThrow(() -> new RuntimeException("批次不存在: " + batchNo));

        RepairReport report = new RepairReport();
        report.setBatchNo(batch.getBatchNo());
        report.setBatchName(batch.getBatchName());
        report.setStatus(batch.getStatus().name());
        report.setOperator(batch.getOperator());
        report.setTotalCount(batch.getTotalCount());
        report.setSuccessCount(batch.getSuccessCount());
        report.setFailedCount(batch.getFailedCount());
        report.setSkippedCount(batch.getSkippedCount());

        if (batch.getTotalCount() > 0) {
            report.setSuccessRate((double) batch.getSuccessCount() / batch.getTotalCount() * 100);
        }

        List<RepairException> exceptions = repairExceptionRepository.findByBatchNo(batchNo);
        report.setExceptions(exceptions);

        List<String> failedFiles = exceptions.stream()
                .map(RepairException::getFileId)
                .filter(Objects::nonNull)
                .distinct()
                .collect(Collectors.toList());

        List<String> successFiles = new ArrayList<>(batch.getAttachmentFileIds());
        successFiles.removeAll(failedFiles);
        report.setSuccessFiles(successFiles);

        if (batch.getCreatedAt() != null && batch.getCompletedAt() != null) {
            report.setStartTime(batch.getCreatedAt());
            report.setEndTime(batch.getCompletedAt());
            report.setDurationSeconds(Duration.between(batch.getCreatedAt(), batch.getCompletedAt()).getSeconds());
        }

        return ApiResponse.success(report);
    }

    public ApiResponse<List<RepairHistory>> getBatchHistory(String batchNo) {
        List<RepairHistory> history = repairHistoryRepository.findByBatchNoOrderByCreatedAtDesc(batchNo);
        return ApiResponse.success(history);
    }

    public ApiResponse<List<RepairException>> getBatchExceptions(String batchNo) {
        List<RepairException> exceptions = repairExceptionRepository.findByBatchNo(batchNo);
        return ApiResponse.success(exceptions);
    }

    private void saveAttachments(List<AttachmentDTO> dtos) {
        for (AttachmentDTO dto : dtos) {
            if (!attachmentRepository.existsByFileId(dto.getFileId())) {
                Attachment attachment = new Attachment();
                attachment.setFileId(dto.getFileId());
                attachment.setFileName(dto.getFileName());
                attachment.setFileType(dto.getFileType());
                attachment.setFileSize(dto.getFileSize());
                attachment.setBusinessNo(dto.getBusinessNo());
                attachment.setUploader(dto.getUploader());

                if (dto.getSourceSystem() != null) {
                    try {
                        attachment.setSourceSystem(SourceSystem.valueOf(dto.getSourceSystem().toUpperCase()));
                    } catch (Exception e) {
                        attachment.setSourceSystem(SourceSystem.UNKNOWN);
                    }
                }

                if (dto.getPermissionLevel() != null) {
                    try {
                        attachment.setPermissionLevel(PermissionLevel.valueOf(dto.getPermissionLevel().toUpperCase()));
                    } catch (Exception ignored) {
                    }
                }

                attachmentRepository.save(attachment);
            }
        }
    }

    private void updateStatus(RepairBatch batch, RepairStatus newStatus, String operator, String remark) {
        RepairStatus previousStatus = batch.getStatus();
        batch.setStatus(newStatus);
        repairBatchRepository.save(batch);
        saveHistory(batch.getBatchNo(), previousStatus, newStatus, operator, remark);
    }

    private void saveHistory(String batchNo, RepairStatus previousStatus, RepairStatus newStatus,
                             String operator, String remark) {
        RepairHistory history = new RepairHistory();
        history.setBatchNo(batchNo);
        history.setPreviousStatus(previousStatus);
        history.setNewStatus(newStatus);
        history.setOperator(operator);
        history.setRemark(remark);
        repairHistoryRepository.save(history);
    }

    private void saveException(String batchNo, String fileId, String errorCode, String errorMessage,
                               String stackTrace, String errorStage) {
        RepairException exception = new RepairException();
        exception.setBatchNo(batchNo);
        exception.setFileId(fileId);
        exception.setErrorCode(errorCode);
        exception.setErrorMessage(errorMessage);
        exception.setStackTrace(stackTrace);
        exception.setErrorStage(errorStage);
        repairExceptionRepository.save(exception);
    }

    private BatchResponse convertToBatchResponse(RepairBatch batch) {
        BatchResponse response = new BatchResponse();
        response.setBatchNo(batch.getBatchNo());
        response.setBatchName(batch.getBatchName());
        response.setStatus(batch.getStatus());
        response.setOperator(batch.getOperator());
        response.setDescription(batch.getDescription());
        response.setTotalCount(batch.getTotalCount());
        response.setSuccessCount(batch.getSuccessCount());
        response.setFailedCount(batch.getFailedCount());
        response.setSkippedCount(batch.getSkippedCount());
        response.setCreatedAt(batch.getCreatedAt());
        response.setUpdatedAt(batch.getUpdatedAt());
        response.setCompletedAt(batch.getCompletedAt());
        return response;
    }
}
