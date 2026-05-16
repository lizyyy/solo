package com.privacy.export.service;

import com.privacy.export.dto.CreateExportRequest;
import com.privacy.export.dto.ManualCorrectionRequest;
import com.privacy.export.dto.StatusTransitionRequest;
import com.privacy.export.entity.*;
import com.privacy.export.enums.ApprovalNodeType;
import com.privacy.export.enums.ExportRequestStatus;
import com.privacy.export.exception.BusinessException;
import com.privacy.export.exception.ErrorCode;
import com.privacy.export.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class ExportRequestService {

    private final ExportRequestRepository exportRequestRepository;
    private final ConsentVersionRepository consentVersionRepository;
    private final ExportScopeItemRepository exportScopeItemRepository;
    private final ApprovalNodeRepository approvalNodeRepository;
    private final PackagingTaskRepository packagingTaskRepository;
    private final DeliveryRecordRepository deliveryRecordRepository;

    @Transactional
    public ExportRequest createExportRequest(CreateExportRequest request) {
        log.info("Creating export request for user: {}", request.getUserId());

        ConsentVersion consentVersion = consentVersionRepository.findByVersionCode(request.getConsentVersionCode())
                .orElseThrow(() -> new BusinessException(ErrorCode.CONSENT_VERSION_NOT_FOUND, request.getConsentVersionCode()));

        validateConsentVersion(consentVersion);

        String requestNo = generateRequestNo();

        ExportRequest exportRequest = ExportRequest.builder()
                .requestNo(requestNo)
                .userId(request.getUserId())
                .userName(request.getUserName())
                .userEmail(request.getUserEmail())
                .userPhone(request.getUserPhone())
                .consentVersionCode(request.getConsentVersionCode())
                .consentSignature(request.getConsentSignature())
                .consentTimestamp(request.getConsentTimestamp())
                .status(ExportRequestStatus.DRAFT)
                .originalInput(request.getOriginalInput())
                .createdBy(request.getCreatedBy())
                .build();

        exportRequest = exportRequestRepository.save(exportRequest);

        List<ExportScopeItem> scopeItems = createScopeItems(exportRequest, request);
        exportScopeItemRepository.saveAll(scopeItems);

        createApprovalWorkflow(exportRequest);

        log.info("Export request created with requestNo: {}", requestNo);
        return exportRequest;
    }

    @Transactional
    public ExportRequest transitionStatus(String requestNo, StatusTransitionRequest request) {
        log.info("Transitioning status for requestNo: {} to {}", requestNo, request.getTargetStatus());

        ExportRequest exportRequest = exportRequestRepository.findByRequestNo(requestNo)
                .orElseThrow(() -> new BusinessException(ErrorCode.EXPORT_REQUEST_NOT_FOUND, requestNo));

        ExportRequestStatus currentStatus = exportRequest.getStatus();

        if (currentStatus.isTerminal()) {
            throw new BusinessException(ErrorCode.REQUEST_ALREADY_COMPLETED, currentStatus.name());
        }

        if (!currentStatus.canTransitionTo(request.getTargetStatus())) {
            throw new BusinessException(ErrorCode.INVALID_STATUS_TRANSITION, 
                    currentStatus.name() + " -> " + request.getTargetStatus().name());
        }

        updateApprovalNodeForStatus(exportRequest, request.getTargetStatus(), request);

        if (request.getTargetStatus() == ExportRequestStatus.READY_FOR_PACKAGING) {
            createPackagingTask(exportRequest);
        }

        if (request.getTargetStatus() == ExportRequestStatus.READY_FOR_DELIVERY) {
            createDeliveryRecord(exportRequest);
        }

        exportRequest.setStatus(request.getTargetStatus());
        exportRequest.setStatusReason(request.getReason());
        exportRequest.setProcessingConclusion(request.getProcessingConclusion());
        exportRequest.setStatusChangedAt(LocalDateTime.now());
        exportRequest.setStatusChangedBy(request.getOperator());

        return exportRequestRepository.save(exportRequest);
    }

    @Transactional
    public ExportRequest applyManualCorrection(String requestNo, ManualCorrectionRequest request) {
        log.info("Applying manual correction for requestNo: {}", requestNo);

        ExportRequest exportRequest = exportRequestRepository.findByRequestNo(requestNo)
                .orElseThrow(() -> new BusinessException(ErrorCode.EXPORT_REQUEST_NOT_FOUND, requestNo));

        if (exportRequest.getStatus() != ExportRequestStatus.NEEDS_MANUAL_CORRECTION) {
            throw new BusinessException(ErrorCode.INVALID_STATUS_TRANSITION, 
                    "Manual correction only allowed from NEEDS_MANUAL_CORRECTION status");
        }

        if (request.getNewConsentVersionCode() != null) {
            ConsentVersion consentVersion = consentVersionRepository.findByVersionCode(request.getNewConsentVersionCode())
                    .orElseThrow(() -> new BusinessException(ErrorCode.CONSENT_VERSION_NOT_FOUND, request.getNewConsentVersionCode()));
            validateConsentVersion(consentVersion);
            exportRequest.setConsentVersionCode(request.getNewConsentVersionCode());
        }

        if (request.getUpdatedScopeItems() != null && !request.getUpdatedScopeItems().isEmpty()) {
            List<ExportScopeItem> existingItems = exportScopeItemRepository.findByExportRequestId(exportRequest.getId());
            exportScopeItemRepository.deleteAll(existingItems);

            List<ExportScopeItem> newScopeItems = request.getUpdatedScopeItems().stream()
                    .map(item -> ExportScopeItem.builder()
                            .exportRequest(exportRequest)
                            .category(item.getCategory())
                            .categoryName(item.getCategory().getDescription())
                            .fieldName(item.getFieldName())
                            .fieldDescription(item.getFieldDescription())
                            .isIncluded(item.getIsIncluded())
                            .createdBy(request.getCorrectedBy())
                            .build())
                    .toList();
            exportScopeItemRepository.saveAll(newScopeItems);
        }

        exportRequest.setStatus(ExportRequestStatus.DRAFT);
        exportRequest.setStatusReason(request.getCorrectionReason());
        exportRequest.setProcessingConclusion(request.getProcessingConclusion());
        exportRequest.setStatusChangedAt(LocalDateTime.now());
        exportRequest.setStatusChangedBy(request.getCorrectedBy());

        return exportRequestRepository.save(exportRequest);
    }

    public ExportRequest getExportRequest(String requestNo) {
        return exportRequestRepository.findByRequestNo(requestNo)
                .orElseThrow(() -> new BusinessException(ErrorCode.EXPORT_REQUEST_NOT_FOUND, requestNo));
    }

    public List<ExportRequest> getExportRequestsByUser(String userId) {
        return exportRequestRepository.findByUserId(userId);
    }

    public List<ExportRequest> getExportRequestsByStatus(ExportRequestStatus status) {
        return exportRequestRepository.findByStatus(status);
    }

    private String generateRequestNo() {
        String datePart = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss"));
        String randomPart = UUID.randomUUID().toString().substring(0, 6).toUpperCase();
        return "EXP-" + datePart + "-" + randomPart;
    }

    private void validateConsentVersion(ConsentVersion consentVersion) {
        LocalDateTime now = LocalDateTime.now();
        if (!consentVersion.getIsActive()) {
            throw new BusinessException(ErrorCode.CONSENT_VERSION_EXPIRED, "Version is not active");
        }
        if (consentVersion.getEffectiveDate().isAfter(now)) {
            throw new BusinessException(ErrorCode.CONSENT_VERSION_EXPIRED, "Version is not effective yet");
        }
        if (consentVersion.getExpiryDate() != null && consentVersion.getExpiryDate().isBefore(now)) {
            throw new BusinessException(ErrorCode.CONSENT_VERSION_EXPIRED, "Version has expired");
        }
    }

    private List<ExportScopeItem> createScopeItems(ExportRequest exportRequest, CreateExportRequest request) {
        return request.getScopeItems().stream()
                .map(item -> ExportScopeItem.builder()
                        .exportRequest(exportRequest)
                        .category(item.getCategory())
                        .categoryName(item.getCategory().getDescription())
                        .fieldName(item.getFieldName())
                        .fieldDescription(item.getFieldDescription())
                        .isIncluded(item.getIsIncluded())
                        .createdBy(request.getCreatedBy())
                        .build())
                .toList();
    }

    private void createApprovalWorkflow(ExportRequest exportRequest) {
        List<ApprovalNode> nodes = new ArrayList<>();

        nodes.add(ApprovalNode.builder()
                .exportRequest(exportRequest)
                .nodeType(ApprovalNodeType.CONSENT_VALIDATION)
                .nodeName("同意版本校验")
                .sequence(1)
                .targetStatus(ExportRequestStatus.CONSENT_VALIDATED)
                .rejectStatus(ExportRequestStatus.CONSENT_VALIDATION_FAILED)
                .approvalCriteria("同意版本有效且在有效期内")
                .assignedRole("SYSTEM")
                .createdBy(exportRequest.getCreatedBy())
                .build());

        nodes.add(ApprovalNode.builder()
                .exportRequest(exportRequest)
                .nodeType(ApprovalNodeType.LEGAL_REVIEW)
                .nodeName("法务审批")
                .sequence(2)
                .targetStatus(ExportRequestStatus.PENDING_SCOPE_VALIDATION)
                .rejectStatus(ExportRequestStatus.LEGAL_REJECTED)
                .approvalCriteria("导出范围符合合规要求")
                .assignedRole("LEGAL")
                .createdBy(exportRequest.getCreatedBy())
                .build());

        nodes.add(ApprovalNode.builder()
                .exportRequest(exportRequest)
                .nodeType(ApprovalNodeType.SCOPE_VALIDATION)
                .nodeName("导出范围校验")
                .sequence(3)
                .targetStatus(ExportRequestStatus.SCOPE_VALIDATED)
                .rejectStatus(ExportRequestStatus.SCOPE_VALIDATION_FAILED)
                .approvalCriteria("所有导出字段均为可读且符合范围定义")
                .assignedRole("SYSTEM")
                .createdBy(exportRequest.getCreatedBy())
                .build());

        nodes.add(ApprovalNode.builder()
                .exportRequest(exportRequest)
                .nodeType(ApprovalNodeType.PACKAGING_REVIEW)
                .nodeName("打包审核")
                .sequence(4)
                .targetStatus(ExportRequestStatus.PACKAGING_COMPLETED)
                .rejectStatus(ExportRequestStatus.PACKAGING_FAILED)
                .approvalCriteria("打包文件完整且校验通过")
                .assignedRole("SYSTEM")
                .createdBy(exportRequest.getCreatedBy())
                .build());

        nodes.add(ApprovalNode.builder()
                .exportRequest(exportRequest)
                .nodeType(ApprovalNodeType.DELIVERY_CONFIRMATION)
                .nodeName("交付确认")
                .sequence(5)
                .targetStatus(ExportRequestStatus.DELIVERED)
                .rejectStatus(ExportRequestStatus.DELIVERY_FAILED)
                .approvalCriteria("用户成功接收并确认")
                .assignedRole("SYSTEM")
                .createdBy(exportRequest.getCreatedBy())
                .build());

        approvalNodeRepository.saveAll(nodes);
    }

    private void updateApprovalNodeForStatus(ExportRequest exportRequest, ExportRequestStatus targetStatus, StatusTransitionRequest request) {
        ApprovalNodeType nodeType = switch (targetStatus) {
            case CONSENT_VALIDATED, CONSENT_VALIDATION_FAILED -> ApprovalNodeType.CONSENT_VALIDATION;
            case PENDING_SCOPE_VALIDATION, LEGAL_REJECTED -> ApprovalNodeType.LEGAL_REVIEW;
            case SCOPE_VALIDATED, SCOPE_VALIDATION_FAILED -> ApprovalNodeType.SCOPE_VALIDATION;
            case PACKAGING_COMPLETED, PACKAGING_FAILED -> ApprovalNodeType.PACKAGING_REVIEW;
            case DELIVERED, DELIVERY_FAILED -> ApprovalNodeType.DELIVERY_CONFIRMATION;
            default -> null;
        };

        if (nodeType != null) {
            approvalNodeRepository.findByExportRequestIdAndNodeType(exportRequest.getId(), nodeType)
                    .ifPresent(node -> {
                        node.setIsCompleted(true);
                        node.setIsApproved(!targetStatus.name().contains("FAILED") && targetStatus != ExportRequestStatus.LEGAL_REJECTED);
                        node.setApprovalComments(request.getReason());
                        node.setCompletedAt(LocalDateTime.now());
                        node.setCompletedBy(request.getOperator());
                        node.setProcessingResult(request.getProcessingConclusion());
                        approvalNodeRepository.save(node);
                    });
        }
    }

    private void createPackagingTask(ExportRequest exportRequest) {
        if (packagingTaskRepository.existsByExportRequestId(exportRequest.getId())) {
            return;
        }

        PackagingTask task = PackagingTask.builder()
                .exportRequest(exportRequest)
                .taskId("PKG-" + exportRequest.getRequestNo())
                .packageFormat("ZIP")
                .createdBy(exportRequest.getCreatedBy())
                .build();

        packagingTaskRepository.save(task);
    }

    private void createDeliveryRecord(ExportRequest exportRequest) {
        if (deliveryRecordRepository.existsByExportRequestId(exportRequest.getId())) {
            return;
        }

        DeliveryRecord record = DeliveryRecord.builder()
                .exportRequest(exportRequest)
                .deliveryId("DLV-" + exportRequest.getRequestNo())
                .deliveryMethod("EMAIL")
                .recipientEmail(exportRequest.getUserEmail())
                .recipientPhone(exportRequest.getUserPhone())
                .createdBy(exportRequest.getCreatedBy())
                .build();

        deliveryRecordRepository.save(record);
    }

    public List<ApprovalNode> getApprovalNodes(String requestNo) {
        ExportRequest exportRequest = getExportRequest(requestNo);
        return approvalNodeRepository.findByExportRequestIdOrderBySequenceAsc(exportRequest.getId());
    }

    public List<ExportScopeItem> getScopeItems(String requestNo) {
        ExportRequest exportRequest = getExportRequest(requestNo);
        return exportScopeItemRepository.findByExportRequestId(exportRequest.getId());
    }

    public PackagingTask getPackagingTask(String requestNo) {
        ExportRequest exportRequest = getExportRequest(requestNo);
        return packagingTaskRepository.findByExportRequestId(exportRequest.getId()).orElse(null);
    }

    public DeliveryRecord getDeliveryRecord(String requestNo) {
        ExportRequest exportRequest = getExportRequest(requestNo);
        return deliveryRecordRepository.findByExportRequestId(exportRequest.getId()).orElse(null);
    }
}
