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

        List<String> invalidFiles = new ArrayList<>();
        for (String fileId : batch.getAttachmentFileIds()) {
            Attachment attachment = attachmentRepository.findByFileId(fileId).orElse(null);
            if (attachment == null) {
                invalidFiles.add(fileId);
                saveException(batchNo, fileId, "VALIDATION_FAILED", "附件不存在", null, "VALIDATION");
            }
        }

        batch.setFailedCount(invalidFiles.size());
        batch.setSuccessCount(batch.getTotalCount() - invalidFiles.size());

        updateStatus(batch, RepairStatus.VALIDATED, operator, "校验完成，无效文件: " + invalidFiles.size());

        log.info("批次校验完成: {}, 无效文件: {}", batchNo, invalidFiles.size());
        return ApiResponse.success("校验完成", convertToBatchResponse(batch));
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

                performMetadataRepair(attachment);
                performPermissionInference(attachment);

                attachment.setMetadataComplete(true);
                attachmentRepository.save(attachment);

                successCount++;
                successFiles.add(fileId);
            } catch (Exception e) {
                failedCount++;
                saveException(batchNo, fileId, "REPAIR_FAILED", e.getMessage(),
                        Arrays.toString(e.getStackTrace()), "REPAIR");
                log.error("修复失败: {}, 错误: {}", fileId, e.getMessage());
            }
        }

        batch.setSuccessCount(successCount);
        batch.setFailedCount(failedCount);
        batch.setSkippedCount(skippedCount);
        batch.setCompletedAt(LocalDateTime.now());

        RepairStatus finalStatus;
        if (failedCount == 0 && skippedCount == 0) {
            finalStatus = RepairStatus.SUCCESS;
        } else if (successCount > 0) {
            finalStatus = RepairStatus.PARTIAL_SUCCESS;
        } else {
            finalStatus = RepairStatus.FAILED;
        }

        updateStatus(batch, finalStatus, operator, "修复完成，成功: " + successCount + ", 失败: " + failedCount);

        log.info("批次修复完成: {}, 状态: {}", batchNo, finalStatus);
        return ApiResponse.success("修复完成", convertToBatchResponse(batch));
    }

    private void performMetadataRepair(Attachment attachment) {
        if (attachment.getFileName() == null && attachment.getFileId() != null) {
            attachment.setFileName("file_" + attachment.getFileId() + ".dat");
        }

        if (attachment.getFileType() == null && attachment.getFileName() != null) {
            String fileName = attachment.getFileName();
            if (fileName.contains(".")) {
                attachment.setFileType(fileName.substring(fileName.lastIndexOf(".") + 1).toUpperCase());
            } else {
                attachment.setFileType("UNKNOWN");
            }
        }

        if (attachment.getUploadTime() == null) {
            attachment.setUploadTime(LocalDateTime.now());
        }

        if (attachment.getFileSize() == null) {
            attachment.setFileSize(0L);
        }
    }

    private void performPermissionInference(Attachment attachment) {
        if (attachment.getPermissionLevel() != null) {
            return;
        }

        String businessNo = attachment.getBusinessNo();
        SourceSystem source = attachment.getSourceSystem();
        String fileName = attachment.getFileName();

        if (source == SourceSystem.FINANCE ||
                (fileName != null && (fileName.contains("财务") || fileName.contains("budget") || fileName.contains("finance")))) {
            attachment.setPermissionLevel(PermissionLevel.CONFIDENTIAL);
        } else if (source == SourceSystem.EHR ||
                (fileName != null && (fileName.contains("人事") || fileName.contains("salary") || fileName.contains("employee")))) {
            attachment.setPermissionLevel(PermissionLevel.RESTRICTED);
        } else if (source == SourceSystem.CRM ||
                (fileName != null && (fileName.contains("客户") || fileName.contains("customer")))) {
            attachment.setPermissionLevel(PermissionLevel.INTERNAL);
        } else {
            attachment.setPermissionLevel(PermissionLevel.INTERNAL);
        }

        if (source == null) {
            attachment.setSourceSystem(SourceSystem.UNKNOWN);
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
