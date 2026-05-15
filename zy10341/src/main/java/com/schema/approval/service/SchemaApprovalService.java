package com.schema.approval.service;

import com.schema.approval.dto.ApprovalRequest;
import com.schema.approval.dto.SchemaRegisterRequest;
import com.schema.approval.entity.*;
import com.schema.approval.enums.SchemaStatus;
import com.schema.approval.exception.BusinessException;
import com.schema.approval.exception.ErrorCode;
import com.schema.approval.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class SchemaApprovalService {
    private final SchemaVersionRepository schemaVersionRepository;
    private final EventTopicService eventTopicService;
    private final CompatibilityCheckRepository compatibilityCheckRepository;
    private final ApprovalRecordRepository approvalRecordRepository;
    private final ConsumerRepository consumerRepository;
    private final PublishRecordRepository publishRecordRepository;
    private final CompatibilityCheckerService compatibilityCheckerService;
    private final ConsumerNotificationRepository consumerNotificationRepository;

    @Transactional
    public SchemaVersion registerSchema(SchemaRegisterRequest request) {
        if (schemaVersionRepository.existsByRequestId(request.getRequestId())) {
            log.info("Duplicate request detected, returning existing schema for requestId: {}", request.getRequestId());
            return schemaVersionRepository.findByRequestId(request.getRequestId()).orElseThrow();
        }

        EventTopic topic = eventTopicService.getTopicOrThrow(request.getTopicName());
        Integer maxVersion = schemaVersionRepository.findMaxVersionByTopic(topic);
        Integer newVersion = maxVersion == null ? 1 : maxVersion + 1;

        SchemaVersion schemaVersion = new SchemaVersion();
        schemaVersion.setTopic(topic);
        schemaVersion.setVersion(newVersion);
        schemaVersion.setSchemaContent(request.getSchemaContent());
        schemaVersion.setDescription(request.getDescription());
        schemaVersion.setRequestId(request.getRequestId());
        schemaVersion.setCreatedBy(request.getCreatedBy());
        schemaVersion.setStatus(SchemaStatus.DRAFT);

        return schemaVersionRepository.save(schemaVersion);
    }

    @Transactional
    public SchemaVersion triggerCompatibilityCheck(Long schemaVersionId, String operator) {
        SchemaVersion schemaVersion = getSchemaVersionOrThrow(schemaVersionId);

        if (schemaVersion.getStatus() != SchemaStatus.DRAFT && 
            schemaVersion.getStatus() != SchemaStatus.COMPATIBILITY_CHECK_FAILED) {
            throw new BusinessException(
                "Cannot trigger compatibility check from current status: " + schemaVersion.getStatus(),
                ErrorCode.INVALID_STATUS_TRANSITION
            );
        }

        schemaVersion.setStatus(SchemaStatus.PENDING_COMPATIBILITY_CHECK);
        schemaVersion.setUpdatedBy(operator);
        schemaVersionRepository.save(schemaVersion);

        long startTime = System.currentTimeMillis();
        CompatibilityCheckerService.CompatibilityCheckResult result = 
                compatibilityCheckerService.checkCompatibility(schemaVersion);
        long checkDuration = System.currentTimeMillis() - startTime;

        CompatibilityCheck checkRecord = new CompatibilityCheck();
        checkRecord.setSchemaVersion(schemaVersion);
        checkRecord.setCheckResult(result.isCompatible());
        checkRecord.setCheckDetails(result.getDetails());
        checkRecord.setCreatedBy(operator);
        checkRecord.setCheckDurationMs(checkDuration);
        checkRecord.setCheckerService("schema-registry");
        checkRecord.setComparedWithVersion(null);
        compatibilityCheckRepository.save(checkRecord);

        if (result.isCompatible()) {
            schemaVersion.setStatus(SchemaStatus.COMPATIBILITY_CHECK_PASSED);
        } else {
            schemaVersion.setStatus(SchemaStatus.COMPATIBILITY_CHECK_FAILED);
            throw new BusinessException(
                result.getDetails(),
                ErrorCode.COMPATIBILITY_CHECK_FAILED
            );
        }

        schemaVersion.setUpdatedBy(operator);
        return schemaVersionRepository.save(schemaVersion);
    }

    @Transactional
    public SchemaVersion submitForApproval(Long schemaVersionId, String operator) {
        SchemaVersion schemaVersion = getSchemaVersionOrThrow(schemaVersionId);

        if (schemaVersion.getStatus() != SchemaStatus.COMPATIBILITY_CHECK_PASSED) {
            throw new BusinessException(
                "Schema must pass compatibility check before approval",
                ErrorCode.INVALID_STATUS_TRANSITION
            );
        }

        schemaVersion.setStatus(SchemaStatus.PENDING_APPROVAL);
        schemaVersion.setUpdatedBy(operator);
        return schemaVersionRepository.save(schemaVersion);
    }

    @Transactional
    public SchemaVersion processApproval(ApprovalRequest request) {
        SchemaVersion schemaVersion = getSchemaVersionOrThrow(request.getSchemaVersionId());

        if (schemaVersion.getStatus() != SchemaStatus.PENDING_APPROVAL) {
            throw new BusinessException(
                "Schema is not pending approval",
                ErrorCode.INVALID_STATUS_TRANSITION
            );
        }

        ApprovalRecord approvalRecord = new ApprovalRecord();
        approvalRecord.setSchemaVersion(schemaVersion);
        approvalRecord.setApprover(request.getApprover());
        approvalRecord.setApprovalComment(request.getApprovalComment());
        approvalRecord.setIsApproved(request.getIsApproved());
        approvalRecord.setApprovalStep(request.getApprovalStep());
        approvalRecord.setTotalSteps(request.getTotalSteps());
        approvalRecord.setCreatedBy(request.getApprover());
        approvalRecordRepository.save(approvalRecord);

        if (request.getIsApproved()) {
            if (request.getApprovalStep().equals(request.getTotalSteps())) {
                schemaVersion.setStatus(SchemaStatus.APPROVED);
            }
        } else {
            schemaVersion.setStatus(SchemaStatus.REJECTED);
        }

        schemaVersion.setUpdatedBy(request.getApprover());
        return schemaVersionRepository.save(schemaVersion);
    }

    @Transactional
    public SchemaVersion publishSchema(Long schemaVersionId, String operator) {
        SchemaVersion schemaVersion = getSchemaVersionOrThrow(schemaVersionId);

        if (schemaVersion.getStatus() != SchemaStatus.APPROVED) {
            throw new BusinessException(
                "Schema must be approved before publishing",
                ErrorCode.SCHEMA_NOT_APPROVED
            );
        }

        if (schemaVersion.getIsPublished()) {
            throw new BusinessException(
                "Schema already published",
                ErrorCode.SCHEMA_ALREADY_PUBLISHED
            );
        }

        schemaVersionRepository.findByTopicAndIsLatestTrue(schemaVersion.getTopic())
                .ifPresent(latest -> {
                    latest.setIsLatest(false);
                    latest.setUpdatedBy(operator);
                    schemaVersionRepository.save(latest);
                });

        schemaVersion.setStatus(SchemaStatus.PUBLISHED);
        schemaVersion.setIsPublished(true);
        schemaVersion.setIsLatest(true);
        schemaVersion.setUpdatedBy(operator);
        schemaVersionRepository.save(schemaVersion);

        PublishRecord publishRecord = new PublishRecord();
        publishRecord.setSchemaVersion(schemaVersion);
        publishRecord.setPublishTarget("schema-registry");
        publishRecord.setPublishStatus("SUCCESS");
        publishRecord.setPublishedSchemaId("SCHEMA-" + schemaVersion.getId());
        publishRecord.setCreatedBy(operator);
        publishRecordRepository.save(publishRecord);

        notifyConsumers(schemaVersion);

        return schemaVersion;
    }

    private void notifyConsumers(SchemaVersion schemaVersion) {
        List<Consumer> consumers = consumerRepository
                .findByTopicAndIsActiveTrueAndNotifyOnSchemaChangeTrue(schemaVersion.getTopic());

        log.info("Notifying {} consumers about schema change for topic: {}",
                consumers.size(), schemaVersion.getTopic().getTopicName());

        consumers.forEach(consumer -> {
            log.info("Notifying consumer: {} (service: {})",
                    consumer.getConsumerGroup(), consumer.getServiceName());

            ConsumerNotification notification = new ConsumerNotification();
            notification.setSchemaVersion(schemaVersion);
            notification.setConsumer(consumer);
            notification.setNotificationStatus("SENT");
            notification.setNotificationDetails("Notification sent to consumer group: " 
                    + consumer.getConsumerGroup() + ", service: " + consumer.getServiceName());
            notification.setCreatedBy("system");
            consumerNotificationRepository.save(notification);
        });
    }

    public List<ConsumerNotification> getConsumerNotificationHistory(Long schemaVersionId) {
        SchemaVersion schemaVersion = getSchemaVersionOrThrow(schemaVersionId);
        return consumerNotificationRepository.findBySchemaVersionOrderByCreatedAtDesc(schemaVersion);
    }

    public SchemaVersion getSchemaVersionOrThrow(Long schemaVersionId) {
        return schemaVersionRepository.findById(schemaVersionId)
                .orElseThrow(() -> new BusinessException(
                    "Schema version not found: " + schemaVersionId,
                    ErrorCode.SCHEMA_VERSION_NOT_FOUND
                ));
    }

    public List<SchemaVersion> getSchemaVersionsByTopic(String topicName) {
        EventTopic topic = eventTopicService.getTopicOrThrow(topicName);
        return schemaVersionRepository.findByTopicOrderByVersionDesc(topic);
    }

    public Optional<SchemaVersion> getSchemaVersionByRequestId(String requestId) {
        return schemaVersionRepository.findByRequestId(requestId);
    }

    public List<CompatibilityCheck> getCompatibilityCheckHistory(Long schemaVersionId) {
        SchemaVersion schemaVersion = getSchemaVersionOrThrow(schemaVersionId);
        return compatibilityCheckRepository.findBySchemaVersionOrderByCreatedAtDesc(schemaVersion);
    }

    public List<ApprovalRecord> getApprovalHistory(Long schemaVersionId) {
        SchemaVersion schemaVersion = getSchemaVersionOrThrow(schemaVersionId);
        return approvalRecordRepository.findBySchemaVersionOrderByCreatedAtDesc(schemaVersion);
    }

    public List<PublishRecord> getPublishHistory(Long schemaVersionId) {
        SchemaVersion schemaVersion = getSchemaVersionOrThrow(schemaVersionId);
        return publishRecordRepository.findBySchemaVersionOrderByCreatedAtDesc(schemaVersion);
    }
}
