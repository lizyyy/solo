package com.pottery.kilnqueue.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.pottery.kilnqueue.dto.*;
import com.pottery.kilnqueue.entity.*;
import com.pottery.kilnqueue.enums.DecisionType;
import com.pottery.kilnqueue.enums.QueueStatus;
import com.pottery.kilnqueue.exception.BusinessException;
import com.pottery.kilnqueue.repository.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
public class QueueService {

    private static final Logger log = LoggerFactory.getLogger(QueueService.class);

    private final QueueRecordRepository queueRecordRepository;
    private final WorkRepository workRepository;
    private final StudentRepository studentRepository;
    private final ProcessingLogRepository processingLogRepository;
    private final ValidationService validationService;
    private final ObjectMapper objectMapper;

    public QueueService(QueueRecordRepository queueRecordRepository,
                        WorkRepository workRepository,
                        StudentRepository studentRepository,
                        ProcessingLogRepository processingLogRepository,
                        ValidationService validationService,
                        ObjectMapper objectMapper) {
        this.queueRecordRepository = queueRecordRepository;
        this.workRepository = workRepository;
        this.studentRepository = studentRepository;
        this.processingLogRepository = processingLogRepository;
        this.validationService = validationService;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public QueueResponseDTO submitToQueue(QueueRequestDTO request) {
        Optional<QueueRecord> existingByIdempotent = queueRecordRepository.findByIdempotencyKey(request.getIdempotencyKey());
        if (existingByIdempotent.isPresent()) {
            log.info("检测到幂等请求，返回原有结果: {}", request.getIdempotencyKey());
            return buildResponse(existingByIdempotent.get(), true);
        }

        Optional<QueueRecord> existingByRequestId = queueRecordRepository.findByRequestId(request.getRequestId());
        if (existingByRequestId.isPresent()) {
            throw BusinessException.idempotentConflict(
                "请求ID已存在",
                buildResponse(existingByRequestId.get(), true)
            );
        }

        Student student = getOrCreateStudent(request);
        Work work = getOrCreateWork(request, student);

        QueueRecord record = new QueueRecord();
        record.setRequestId(request.getRequestId());
        record.setIdempotencyKey(request.getIdempotencyKey());
        record.setWork(work);
        record.setStatus(QueueStatus.PENDING);
        record = queueRecordRepository.save(record);

        logProcessing(record, DecisionType.AUTO_APPROVE, null, QueueStatus.PENDING,
            "作品提交排队", "初始提交", request.getOperator());

        return validateAndProcess(record, request.getOperator());
    }

    private QueueResponseDTO validateAndProcess(QueueRecord record, String operator) {
        Work work = record.getWork();
        record.setStatus(QueueStatus.VALIDATING);
        record = queueRecordRepository.save(record);

        ValidationService.ValidationResult glazeResult = validationService.validateGlazeCompatibility(work);
        if (!glazeResult.isValid()) {
            record.setStatus(QueueStatus.CONFLICT_DETECTED);
            try {
                record.setConflictInfo(objectMapper.writeValueAsString(glazeResult.getDetails()));
            } catch (JsonProcessingException e) {
                record.setConflictInfo(glazeResult.getMessage());
            }
            record = queueRecordRepository.save(record);

            logProcessing(record, DecisionType.GLAZE_CONFLICT, QueueStatus.VALIDATING, QueueStatus.CONFLICT_DETECTED,
                glazeResult.getMessage(), glazeResult.getDetails() != null ? glazeResult.getDetails().toString() : null, operator);

            return buildResponse(record, false);
        }

        record.setStatus(QueueStatus.APPROVED);
        Integer maxOrder = queueRecordRepository.findMaxQueueOrder(QueueStatus.APPROVED);
        record.setQueueOrder(maxOrder == null ? 1 : maxOrder + 1);
        record = queueRecordRepository.save(record);

        logProcessing(record, DecisionType.AUTO_APPROVE, QueueStatus.VALIDATING, QueueStatus.APPROVED,
            "验证通过，进入排队", null, operator);

        return buildResponse(record, false);
    }

    @Transactional
    public QueueResponseDTO reschedule(RescheduleRequestDTO request) {
        QueueRecord originalRecord = queueRecordRepository.findByRequestId(request.getOriginalRequestId())
            .orElseThrow(() -> BusinessException.notFound("原排队记录不存在"));

        if (!List.of(QueueStatus.PENDING, QueueStatus.APPROVED, QueueStatus.CONFLICT_DETECTED, QueueStatus.RESCHEDULED)
            .contains(originalRecord.getStatus())) {
            throw BusinessException.invalidStatusTransition("当前状态不允许改期: " + originalRecord.getStatus());
        }

        Optional<QueueRecord> existingByIdempotent = queueRecordRepository.findByIdempotencyKey(request.getNewIdempotencyKey());
        if (existingByIdempotent.isPresent()) {
            log.info("改期请求幂等命中: {}", request.getNewIdempotencyKey());
            return buildResponse(existingByIdempotent.get(), true);
        }

        QueueStatus originalStatus = originalRecord.getStatus();
        originalRecord.setStatus(QueueStatus.RESCHEDULED);
        queueRecordRepository.save(originalRecord);

        logProcessing(originalRecord, DecisionType.RESCHEDULE_REQUEST, originalStatus, QueueStatus.RESCHEDULED,
            request.getReason(), null, request.getOperator());

        QueueRecord newRecord = new QueueRecord();
        newRecord.setRequestId(request.getNewRequestId());
        newRecord.setIdempotencyKey(request.getNewIdempotencyKey());
        newRecord.setWork(originalRecord.getWork());
        newRecord.setIsRescheduled(true);
        newRecord.setOriginalQueueRecordId(originalRecord.getId());
        newRecord.setRescheduleCount(originalRecord.getRescheduleCount() + 1);
        newRecord.setStatus(QueueStatus.PENDING);

        if (request.getInsertToFront() != null && request.getInsertToFront()) {
            newRecord.setQueueOrder(1);
            reorderQueueFrom(1, 1);
        } else if (request.getTargetPosition() != null && request.getTargetPosition() > 0) {
            newRecord.setQueueOrder(request.getTargetPosition());
            reorderQueueFrom(request.getTargetPosition(), 1);
        } else {
            Integer maxOrder = queueRecordRepository.findMaxQueueOrder(QueueStatus.APPROVED);
            newRecord.setQueueOrder(maxOrder == null ? 1 : maxOrder + 1);
        }

        newRecord = queueRecordRepository.save(newRecord);

        logProcessing(newRecord, DecisionType.RESCHEDULE_APPROVE, null, QueueStatus.PENDING,
            "改期后重新排队，原请求ID: " + request.getOriginalRequestId(), request.getReason(), request.getOperator());

        return validateAndProcess(newRecord, request.getOperator());
    }

    private void reorderQueueFrom(int startPosition, int offset) {
        List<QueueRecord> records = queueRecordRepository.findPendingQueueOrdered(QueueStatus.APPROVED);
        for (QueueRecord record : records) {
            if (record.getQueueOrder() >= startPosition) {
                record.setQueueOrder(record.getQueueOrder() + offset);
                queueRecordRepository.save(record);
            }
        }
    }

    @Transactional
    public QueueResponseDTO supplement(SupplementRequestDTO request) {
        QueueRecord record = queueRecordRepository.findByRequestId(request.getRequestId())
            .orElseThrow(() -> BusinessException.notFound("排队记录不存在"));

        if (record.getStatus() != QueueStatus.CONFLICT_DETECTED) {
            throw BusinessException.invalidStatusTransition("当前状态不允许补证: " + record.getStatus());
        }

        if (request.getGlazeCodes() != null) {
            record.getWork().setGlazeCodes(request.getGlazeCodes());
            workRepository.save(record.getWork());
        }

        record.setSupplementInfo(request.getSupplementInfo());
        record = queueRecordRepository.save(record);

        logProcessing(record, DecisionType.SUPPLEMENT_SUBMIT, QueueStatus.CONFLICT_DETECTED, QueueStatus.VALIDATING,
            "提交补证材料", request.getSupplementInfo(), request.getOperator());

        return validateAndProcess(record, request.getOperator());
    }

    @Transactional
    public QueueResponseDTO makeDecision(DecisionRequestDTO request) {
        QueueRecord record = queueRecordRepository.findByRequestId(request.getRequestId())
            .orElseThrow(() -> BusinessException.notFound("排队记录不存在"));

        QueueStatus previousStatus = record.getStatus();

        if (request.getApproved() != null && request.getApproved()) {
            record.setStatus(QueueStatus.APPROVED);
            Integer maxOrder = queueRecordRepository.findMaxQueueOrder(QueueStatus.APPROVED);
            record.setQueueOrder(maxOrder == null ? 1 : maxOrder + 1);
            logProcessing(record, DecisionType.MANUAL_APPROVE, previousStatus, QueueStatus.APPROVED,
                request.getReason(), null, request.getOperator());
        } else {
            record.setStatus(QueueStatus.REJECTED);
            logProcessing(record, DecisionType.MANUAL_REJECT, previousStatus, QueueStatus.REJECTED,
                request.getReason(), null, request.getOperator());
        }

        record = queueRecordRepository.save(record);
        return buildResponse(record, false);
    }

    public QueueResponseDTO getByRequestId(String requestId) {
        QueueRecord record = queueRecordRepository.findByRequestId(requestId)
            .orElseThrow(() -> BusinessException.notFound("排队记录不存在"));
        return buildResponse(record, false);
    }

    public List<QueueResponseDTO> getQueueList(QueueStatus status) {
        List<QueueRecord> records;
        if (status != null) {
            records = queueRecordRepository.findPendingQueueOrdered(status);
        } else {
            records = queueRecordRepository.findAll();
        }
        return records.stream()
            .map(r -> buildResponse(r, false))
            .collect(Collectors.toList());
    }

    private Student getOrCreateStudent(QueueRequestDTO request) {
        return studentRepository.findByStudentNo(request.getStudentNo())
            .orElseGet(() -> {
                Student student = new Student();
                student.setStudentNo(request.getStudentNo());
                student.setName(request.getStudentName() != null ? request.getStudentName() : request.getStudentNo());
                student.setPhone(request.getStudentPhone());
                return studentRepository.save(student);
            });
    }

    private Work getOrCreateWork(QueueRequestDTO request, Student student) {
        return workRepository.findByWorkNo(request.getWorkNo())
            .map(work -> {
                if (request.getGlazeCodes() != null) {
                    work.setGlazeCodes(request.getGlazeCodes());
                }
                if (request.getWorkName() != null) {
                    work.setName(request.getWorkName());
                }
                work.setIsThickBody(request.getIsThickBody());
                work.setWidth(request.getWidth());
                work.setHeight(request.getHeight());
                work.setDepth(request.getDepth());
                return workRepository.save(work);
            })
            .orElseGet(() -> {
                Work work = new Work();
                work.setWorkNo(request.getWorkNo());
                work.setName(request.getWorkName() != null ? request.getWorkName() : request.getWorkNo());
                work.setStudent(student);
                work.setIsThickBody(request.getIsThickBody());
                work.setWidth(request.getWidth());
                work.setHeight(request.getHeight());
                work.setDepth(request.getDepth());
                work.setGlazeCodes(request.getGlazeCodes());
                work.setDescription(request.getDescription());
                return workRepository.save(work);
            });
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

    private QueueResponseDTO buildResponse(QueueRecord record, boolean fromIdempotent) {
        List<ProcessingLog> logs = processingLogRepository.findByQueueRecordIdOrderByCreatedAtDesc(record.getId());
        List<ProcessingLogDTO> logDTOs = logs.stream()
            .map(l -> ProcessingLogDTO.builder()
                .decisionType(l.getDecisionType())
                .previousStatus(l.getPreviousStatus())
                .newStatus(l.getNewStatus())
                .reason(l.getReason())
                .evidence(l.getEvidence())
                .operator(l.getOperator())
                .createdAt(l.getCreatedAt())
                .build())
            .collect(Collectors.toList());

        return QueueResponseDTO.builder()
            .requestId(record.getRequestId())
            .workNo(record.getWork().getWorkNo())
            .workName(record.getWork().getName())
            .status(record.getStatus())
            .queueOrder(record.getQueueOrder())
            .batchNo(record.getBatch() != null ? record.getBatch().getBatchNo() : null)
            .estimatedFiringDate(record.getEstimatedFiringDate())
            .conflictInfo(record.getConflictInfo())
            .isRescheduled(record.getIsRescheduled())
            .rescheduleCount(record.getRescheduleCount())
            .createdAt(record.getCreatedAt())
            .processingLogs(logDTOs)
            .build();
    }
}
