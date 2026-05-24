package com.pottery.kilnqueue.service;

import com.pottery.kilnqueue.dto.BatchAssignDTO;
import com.pottery.kilnqueue.dto.BatchDTO;
import com.pottery.kilnqueue.dto.QueueResponseDTO;
import com.pottery.kilnqueue.entity.KilnBatch;
import com.pottery.kilnqueue.entity.ProcessingLog;
import com.pottery.kilnqueue.entity.QueueRecord;
import com.pottery.kilnqueue.enums.BatchStatus;
import com.pottery.kilnqueue.enums.DecisionType;
import com.pottery.kilnqueue.enums.QueueStatus;
import com.pottery.kilnqueue.exception.BusinessException;
import com.pottery.kilnqueue.repository.KilnBatchRepository;
import com.pottery.kilnqueue.repository.ProcessingLogRepository;
import com.pottery.kilnqueue.repository.QueueRecordRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class BatchService {

    private static final Logger log = LoggerFactory.getLogger(BatchService.class);

    private final KilnBatchRepository kilnBatchRepository;
    private final QueueRecordRepository queueRecordRepository;
    private final ProcessingLogRepository processingLogRepository;
    private final ValidationService validationService;

    public BatchService(KilnBatchRepository kilnBatchRepository,
                        QueueRecordRepository queueRecordRepository,
                        ProcessingLogRepository processingLogRepository,
                        ValidationService validationService) {
        this.kilnBatchRepository = kilnBatchRepository;
        this.queueRecordRepository = queueRecordRepository;
        this.processingLogRepository = processingLogRepository;
        this.validationService = validationService;
    }

    public List<BatchDTO> getAllBatches(BatchStatus status) {
        List<KilnBatch> batches;
        if (status != null) {
            batches = kilnBatchRepository.findByStatus(status);
        } else {
            batches = kilnBatchRepository.findAll();
        }
        return batches.stream()
            .map(this::buildBatchDTO)
            .collect(Collectors.toList());
    }

    public BatchDTO getByBatchNo(String batchNo) {
        KilnBatch batch = kilnBatchRepository.findByBatchNo(batchNo)
            .orElseThrow(() -> BusinessException.notFound("批次不存在"));
        return buildBatchDTO(batch);
    }

    @Transactional
    public BatchDTO createBatch(BatchDTO dto) {
        if (kilnBatchRepository.existsByBatchNo(dto.getBatchNo())) {
            throw BusinessException.idempotentConflict("批次编号已存在", null);
        }

        KilnBatch batch = new KilnBatch();
        batch.setBatchNo(dto.getBatchNo());
        batch.setName(dto.getName());
        batch.setFiringType(dto.getFiringType());
        batch.setStatus(BatchStatus.DRAFT);
        batch.setTargetTemp(dto.getTargetTemp());
        batch.setScheduledTime(dto.getScheduledTime());
        batch.setMaxWidth(dto.getMaxWidth());
        batch.setMaxHeight(dto.getMaxHeight());
        batch.setMaxDepth(dto.getMaxDepth());
        batch.setMaxWorks(dto.getMaxWorks());
        batch.setNotes(dto.getNotes());

        batch = kilnBatchRepository.save(batch);
        return buildBatchDTO(batch);
    }

    @Transactional
    public BatchDTO lockBatch(String batchNo, String operator) {
        KilnBatch batch = kilnBatchRepository.findByBatchNo(batchNo)
            .orElseThrow(() -> BusinessException.notFound("批次不存在"));

        if (batch.getStatus() != BatchStatus.DRAFT) {
            throw BusinessException.invalidStatusTransition("只有草稿状态的批次可以锁定");
        }

        batch.setStatus(BatchStatus.LOCKED);
        batch = kilnBatchRepository.save(batch);

        List<QueueRecord> records = queueRecordRepository.findByBatchId(batch.getId());
        for (QueueRecord record : records) {
            record.setStatus(QueueStatus.IN_BATCH);
            queueRecordRepository.save(record);
            logProcessing(record, DecisionType.BATCH_ASSIGN, QueueStatus.APPROVED, QueueStatus.IN_BATCH,
                "作品已分配到批次并锁定", "批次: " + batchNo, operator);
        }

        log.info("批次 {} 已锁定，包含 {} 件作品", batchNo, records.size());
        return buildBatchDTO(batch);
    }

    @Transactional
    public BatchDTO unlockBatch(String batchNo, String operator) {
        KilnBatch batch = kilnBatchRepository.findByBatchNo(batchNo)
            .orElseThrow(() -> BusinessException.notFound("批次不存在"));

        if (batch.getStatus() != BatchStatus.LOCKED) {
            throw BusinessException.invalidStatusTransition("只有锁定状态的批次可以解锁");
        }

        batch.setStatus(BatchStatus.DRAFT);
        batch = kilnBatchRepository.save(batch);

        List<QueueRecord> records = queueRecordRepository.findByBatchId(batch.getId());
        for (QueueRecord record : records) {
            record.setStatus(QueueStatus.APPROVED);
            queueRecordRepository.save(record);
        }

        log.info("批次 {} 已解锁", batchNo);
        return buildBatchDTO(batch);
    }

    @Transactional
    public BatchDTO assignWorks(BatchAssignDTO dto) {
        KilnBatch batch = kilnBatchRepository.findByBatchNo(dto.getBatchNo())
            .orElseThrow(() -> BusinessException.notFound("批次不存在"));

        if (batch.getStatus() == BatchStatus.LOCKED || batch.getStatus() == BatchStatus.FIRING) {
            throw BusinessException.batchLocked("批次已锁定或正在烧制，无法修改");
        }

        List<QueueRecord> existingRecords = queueRecordRepository.findByBatchId(batch.getId());
        List<String> errorMessages = new ArrayList<>();

        if (dto.getRequestIds() != null) {
            for (String requestId : dto.getRequestIds()) {
                QueueRecord record = queueRecordRepository.findByRequestId(requestId)
                    .orElse(null);

                if (record == null) {
                    errorMessages.add("排队记录不存在: " + requestId);
                    continue;
                }

                if (record.getStatus() != QueueStatus.APPROVED) {
                    errorMessages.add("作品 " + requestId + " 状态不正确: " + record.getStatus());
                    continue;
                }

                ValidationService.ValidationResult sizeResult = validationService.validateSize(record.getWork(), batch);
                if (!sizeResult.isValid()) {
                    errorMessages.add("作品 " + requestId + " 尺寸超限: " + sizeResult.getMessage());
                    continue;
                }

                ValidationService.ValidationResult glazeResult = validationService.validateBatchGlazeCompatibility(
                    record.getWork(), existingRecords);
                if (!glazeResult.isValid()) {
                    errorMessages.add("作品 " + requestId + " 釉料冲突: " + glazeResult.getMessage());
                    continue;
                }

                if (batch.getMaxWorks() != null && existingRecords.size() >= batch.getMaxWorks()) {
                    errorMessages.add("批次已满，无法添加作品 " + requestId);
                    continue;
                }

                record.setBatch(batch);
                queueRecordRepository.save(record);
                existingRecords.add(record);
            }
        }

        if (!errorMessages.isEmpty()) {
            throw BusinessException.batchLocked(String.join("; ", errorMessages));
        }

        return buildBatchDTO(batch);
    }

    @Transactional
    public BatchDTO removeWorkFromBatch(String batchNo, String requestId, String operator) {
        KilnBatch batch = kilnBatchRepository.findByBatchNo(batchNo)
            .orElseThrow(() -> BusinessException.notFound("批次不存在"));

        if (batch.getStatus() == BatchStatus.LOCKED || batch.getStatus() == BatchStatus.FIRING) {
            throw BusinessException.batchLocked("批次已锁定或正在烧制，无法修改");
        }

        QueueRecord record = queueRecordRepository.findByRequestId(requestId)
            .orElseThrow(() -> BusinessException.notFound("排队记录不存在"));

        if (record.getBatch() == null || !record.getBatch().getId().equals(batch.getId())) {
            throw BusinessException.invalidStatusTransition("作品不在该批次中");
        }

        record.setBatch(null);
        record.setStatus(QueueStatus.APPROVED);
        queueRecordRepository.save(record);

        return buildBatchDTO(batch);
    }

    @Transactional
    public BatchDTO startFiring(String batchNo) {
        KilnBatch batch = kilnBatchRepository.findByBatchNo(batchNo)
            .orElseThrow(() -> BusinessException.notFound("批次不存在"));

        if (batch.getStatus() != BatchStatus.LOCKED) {
            throw BusinessException.invalidStatusTransition("只有锁定状态的批次可以开始烧制");
        }

        batch.setStatus(BatchStatus.FIRING);
        batch.setActualStartTime(java.time.LocalDateTime.now());
        batch = kilnBatchRepository.save(batch);

        return buildBatchDTO(batch);
    }

    @Transactional
    public BatchDTO completeFiring(String batchNo) {
        KilnBatch batch = kilnBatchRepository.findByBatchNo(batchNo)
            .orElseThrow(() -> BusinessException.notFound("批次不存在"));

        if (batch.getStatus() != BatchStatus.FIRING) {
            throw BusinessException.invalidStatusTransition("只有烧制中的批次可以完成");
        }

        batch.setStatus(BatchStatus.COMPLETED);
        batch.setActualEndTime(java.time.LocalDateTime.now());
        batch = kilnBatchRepository.save(batch);

        List<QueueRecord> records = queueRecordRepository.findByBatchId(batch.getId());
        for (QueueRecord record : records) {
            record.setStatus(QueueStatus.FIRED);
            queueRecordRepository.save(record);
        }

        return buildBatchDTO(batch);
    }

    private BatchDTO buildBatchDTO(KilnBatch batch) {
        List<QueueRecord> records = queueRecordRepository.findByBatchIdOrdered(batch.getId());
        List<QueueResponseDTO> workDTOs = records.stream()
            .map(this::buildQueueDTO)
            .collect(Collectors.toList());

        return BatchDTO.builder()
            .batchNo(batch.getBatchNo())
            .name(batch.getName())
            .firingType(batch.getFiringType())
            .status(batch.getStatus())
            .targetTemp(batch.getTargetTemp())
            .scheduledTime(batch.getScheduledTime())
            .actualStartTime(batch.getActualStartTime())
            .actualEndTime(batch.getActualEndTime())
            .maxWidth(batch.getMaxWidth())
            .maxHeight(batch.getMaxHeight())
            .maxDepth(batch.getMaxDepth())
            .maxWorks(batch.getMaxWorks())
            .notes(batch.getNotes())
            .works(workDTOs)
            .createdAt(batch.getCreatedAt())
            .build();
    }

    private QueueResponseDTO buildQueueDTO(QueueRecord record) {
        return QueueResponseDTO.builder()
            .requestId(record.getRequestId())
            .workNo(record.getWork().getWorkNo())
            .workName(record.getWork().getName())
            .status(record.getStatus())
            .queueOrder(record.getQueueOrder())
            .batchNo(record.getBatch() != null ? record.getBatch().getBatchNo() : null)
            .isRescheduled(record.getIsRescheduled())
            .rescheduleCount(record.getRescheduleCount())
            .createdAt(record.getCreatedAt())
            .build();
    }

    private void logProcessing(QueueRecord record, DecisionType decisionType,
                               QueueStatus previousStatus, QueueStatus newStatus,
                               String reason, String evidence, String operator) {
        ProcessingLog logEntry = new ProcessingLog();
        logEntry.setQueueRecord(record);
        logEntry.setDecisionType(decisionType);
        logEntry.setPreviousStatus(previousStatus);
        logEntry.setNewStatus(newStatus);
        logEntry.setReason(reason);
        logEntry.setEvidence(evidence);
        logEntry.setOperator(operator);
        processingLogRepository.save(logEntry);
    }
}
