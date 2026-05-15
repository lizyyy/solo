package com.virusscan.service;

import com.virusscan.dto.CreateScanTaskRequest;
import com.virusscan.dto.ReleaseFileRequest;
import com.virusscan.dto.TaskStatusUpdateRequest;
import com.virusscan.entity.*;
import com.virusscan.enums.NotificationStatus;
import com.virusscan.enums.NotificationType;
import com.virusscan.enums.ScanEngine;
import com.virusscan.enums.TaskStatus;
import com.virusscan.exception.BusinessException;
import com.virusscan.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class ScanTaskService {

    private final UploadFileRepository uploadFileRepository;
    private final ScanTaskRepository scanTaskRepository;
    private final QuarantineRepository quarantineRepository;
    private final ReleaseCertificateRepository releaseCertificateRepository;
    private final FailureReasonRepository failureReasonRepository;
    private final NotificationRecordRepository notificationRecordRepository;

    private static final Set<TaskStatus> ACTIVE_STATUSES = Set.of(
            TaskStatus.PENDING, TaskStatus.SCANNING
    );

    private static final Map<TaskStatus, Set<TaskStatus>> ALLOWED_TRANSITIONS = Map.ofEntries(
            Map.entry(TaskStatus.PENDING, Set.of(TaskStatus.SCANNING, TaskStatus.CANCELLED, TaskStatus.FAILED)),
            Map.entry(TaskStatus.SCANNING, Set.of(TaskStatus.CLEAN, TaskStatus.INFECTED, TaskStatus.FAILED, TaskStatus.CANCELLED)),
            Map.entry(TaskStatus.INFECTED, Set.of(TaskStatus.QUARANTINED)),
            Map.entry(TaskStatus.QUARANTINED, Set.of(TaskStatus.RELEASED)),
            Map.entry(TaskStatus.FAILED, Set.of(TaskStatus.PENDING)),
            Map.entry(TaskStatus.CANCELLED, Set.of()),
            Map.entry(TaskStatus.CLEAN, Set.of()),
            Map.entry(TaskStatus.RELEASED, Set.of())
    );

    @Transactional
    public ScanTask createScanTask(CreateScanTaskRequest request) {
        if (request.getRequestId() != null && scanTaskRepository.existsByRequestId(request.getRequestId())) {
            log.info("重复请求，返回已有任务: requestId={}", request.getRequestId());
            return scanTaskRepository.findByRequestId(request.getRequestId()).orElseThrow();
        }

        if (scanTaskRepository.existsByFileIdAndStatusIn(request.getFileId(), List.copyOf(ACTIVE_STATUSES))) {
            throw new BusinessException(409, "该文件已有正在处理的扫描任务");
        }

        UploadFile uploadFile = uploadFileRepository.findByFileId(request.getFileId())
                .orElseGet(() -> {
                    UploadFile newFile = new UploadFile();
                    newFile.setFileId(request.getFileId());
                    newFile.setFileName(request.getFileName());
                    newFile.setFileSize(request.getFileSize());
                    newFile.setFileHash(request.getFileHash());
                    newFile.setContentType(request.getContentType());
                    newFile.setFilePath(request.getFilePath());
                    newFile.setUploadedBy(request.getUploadedBy());
                    newFile.setSourceSystem(request.getSourceSystem());
                    return uploadFileRepository.save(newFile);
                });

        ScanTask task = new ScanTask();
        task.setTaskId("TASK-" + UUID.randomUUID().toString().replace("-", "").substring(0, 24).toUpperCase());
        task.setFileId(uploadFile.getFileId());
        task.setRequestId(request.getRequestId());
        task.setStatus(TaskStatus.PENDING);
        task.setScanEngine(ScanEngine.CLAMAV);
        task.setRequestedBy(request.getRequestedBy());
        task.setCallbackUrl(request.getCallbackUrl());
        task.setMaxRetry(request.getMaxRetry());
        task.setRetryCount(0);

        return scanTaskRepository.save(task);
    }

    @Transactional
    public ScanTask updateTaskStatus(String taskId, TaskStatusUpdateRequest request) {
        ScanTask task = scanTaskRepository.findByTaskId(taskId)
                .orElseThrow(() -> new BusinessException(404, "任务不存在: " + taskId));

        TaskStatus currentStatus = task.getStatus();
        TaskStatus targetStatus = request.getTargetStatus();

        if (!isValidTransition(currentStatus, targetStatus)) {
            throw new IllegalStateException(
                    String.format("不允许的状态转换: %s -> %s", currentStatus, targetStatus)
            );
        }

        if (targetStatus == TaskStatus.SCANNING) {
            task.setStartTime(LocalDateTime.now());
        }

        if (targetStatus == TaskStatus.FAILED) {
            createFailureRecord(task, request);

            if (task.getRetryCount() < task.getMaxRetry()) {
                task.setRetryCount(task.getRetryCount() + 1);
                task.setStatus(TaskStatus.PENDING);
                log.info("任务失败，准备重试 ({}/{}): {}", task.getRetryCount(), task.getMaxRetry(), taskId);
            } else {
                task.setStatus(TaskStatus.FAILED);
                task.setEndTime(LocalDateTime.now());
            }
        } else {
            task.setStatus(targetStatus);

            if (request.getScanResult() != null) {
                task.setScanResult(request.getScanResult());
            }
            if (request.getVirusDetails() != null) {
                task.setVirusDetails(request.getVirusDetails());
            }

            if (Set.of(TaskStatus.CLEAN, TaskStatus.INFECTED, TaskStatus.CANCELLED).contains(targetStatus)) {
                task.setEndTime(LocalDateTime.now());
            }

            if (targetStatus == TaskStatus.INFECTED) {
                createQuarantineRecord(task, request);
            }
        }

        ScanTask savedTask = scanTaskRepository.save(task);
        createNotificationIfNeeded(savedTask);

        return savedTask;
    }

    private boolean isValidTransition(TaskStatus current, TaskStatus target) {
        return ALLOWED_TRANSITIONS.getOrDefault(current, Set.of()).contains(target);
    }

    private void createFailureRecord(ScanTask task, TaskStatusUpdateRequest request) {
        FailureReason failure = new FailureReason();
        failure.setFailureId("FAIL-" + UUID.randomUUID().toString().replace("-", "").substring(0, 24).toUpperCase());
        failure.setTaskId(task.getTaskId());
        failure.setFileId(task.getFileId());
        failure.setErrorCode(request.getErrorCode() != null ? request.getErrorCode() : "UNKNOWN_ERROR");
        failure.setErrorMessage(request.getErrorMessage() != null ? request.getErrorMessage() : "扫描任务失败");
        failure.setRetryable(true);
        failureReasonRepository.save(failure);
    }

    private void createQuarantineRecord(ScanTask task, TaskStatusUpdateRequest request) {
        Quarantine quarantine = new Quarantine();
        quarantine.setQuarantineId("QUAR-" + UUID.randomUUID().toString().replace("-", "").substring(0, 24).toUpperCase());
        quarantine.setFileId(task.getFileId());
        quarantine.setTaskId(task.getTaskId());
        quarantine.setFileName(uploadFileRepository.findByFileId(task.getFileId())
                .map(UploadFile::getFileName).orElse("unknown"));
        quarantine.setQuarantinePath("/quarantine/" + task.getFileId());
        quarantine.setVirusReason(request.getVirusDetails());
        quarantine.setQuarantinedBy(request.getOperator());
        quarantine.setIsReleased(false);
        quarantineRepository.save(quarantine);
    }

    private void createNotificationIfNeeded(ScanTask task) {
        if (task.getCallbackUrl() == null) {
            return;
        }

        NotificationType type = switch (task.getStatus()) {
            case CLEAN -> NotificationType.SCAN_COMPLETE;
            case INFECTED -> NotificationType.VIRUS_DETECTED;
            case FAILED -> NotificationType.SCAN_FAILED;
            case QUARANTINED -> NotificationType.FILE_QUARANTINED;
            default -> null;
        };

        if (type != null) {
            NotificationRecord notification = new NotificationRecord();
            notification.setNotificationId("NOTI-" + UUID.randomUUID().toString().replace("-", "").substring(0, 24).toUpperCase());
            notification.setTaskId(task.getTaskId());
            notification.setFileId(task.getFileId());
            notification.setNotificationType(type);
            notification.setStatus(NotificationStatus.PENDING);
            notification.setRecipient(task.getCallbackUrl());
            notification.setSubject("扫描任务状态变更通知: " + task.getStatus());
            notification.setContent("任务ID: " + task.getTaskId() + ", 状态: " + task.getStatus());
            notificationRecordRepository.save(notification);
        }
    }

    @Transactional
    public ReleaseCertificate releaseFile(ReleaseFileRequest request) {
        Quarantine quarantine = quarantineRepository.findByQuarantineId(request.getQuarantineId())
                .orElseThrow(() -> new BusinessException(404, "隔离记录不存在: " + request.getQuarantineId()));

        if (!quarantine.getFileId().equals(request.getFileId())) {
            throw new BusinessException(400, "文件ID不匹配");
        }

        if (quarantine.getIsReleased()) {
            throw new BusinessException(409, "该文件已被放行");
        }

        ScanTask task = scanTaskRepository.findByTaskId(quarantine.getTaskId())
                .orElseThrow(() -> new BusinessException(404, "关联任务不存在"));

        ReleaseCertificate certificate = new ReleaseCertificate();
        certificate.setCertificateId("CERT-" + UUID.randomUUID().toString().replace("-", "").substring(0, 24).toUpperCase());
        certificate.setFileId(request.getFileId());
        certificate.setTaskId(quarantine.getTaskId());
        certificate.setQuarantineId(request.getQuarantineId());
        certificate.setFileName(quarantine.getFileName());
        certificate.setReleaseReason(request.getReleaseReason());
        certificate.setReleasedBy(request.getReleasedBy());
        certificate.setApproverSignature(request.getApproverSignature());
        ReleaseCertificate savedCert = releaseCertificateRepository.save(certificate);

        quarantine.setIsReleased(true);
        quarantineRepository.save(quarantine);

        task.setStatus(TaskStatus.RELEASED);
        scanTaskRepository.save(task);

        return savedCert;
    }

    public ScanTask getTaskByTaskId(String taskId) {
        return scanTaskRepository.findByTaskId(taskId)
                .orElseThrow(() -> new BusinessException(404, "任务不存在: " + taskId));
    }

    public List<ScanTask> getTasksByFileId(String fileId) {
        return scanTaskRepository.findByFileId(fileId);
    }

    public List<ScanTask> getTasksByStatus(TaskStatus status) {
        return scanTaskRepository.findByStatus(status);
    }

    public List<ScanTask> getTasksByTimeRange(LocalDateTime start, LocalDateTime end) {
        return scanTaskRepository.findByCreateTimeBetween(start, end);
    }

    public Quarantine getQuarantineByQuarantineId(String quarantineId) {
        return quarantineRepository.findByQuarantineId(quarantineId)
                .orElseThrow(() -> new BusinessException(404, "隔离记录不存在: " + quarantineId));
    }

    public List<Quarantine> getQuarantinedFiles() {
        return quarantineRepository.findByIsReleasedFalse();
    }

    public List<FailureReason> getFailureReasonsByTaskId(String taskId) {
        return failureReasonRepository.findByTaskId(taskId);
    }

    public List<NotificationRecord> getNotificationsByTaskId(String taskId) {
        return notificationRecordRepository.findByTaskId(taskId);
    }

    public Map<String, Object> getTaskStatistics() {
        List<ScanTask> allTasks = scanTaskRepository.findAll();
        Map<TaskStatus, Long> statusCount = allTasks.stream()
                .collect(Collectors.groupingBy(ScanTask::getStatus, Collectors.counting()));

        long quarantineCount = quarantineRepository.count();
        long releasedCount = releaseCertificateRepository.count();

        return Map.of(
                "statusDistribution", statusCount,
                "totalTasks", allTasks.size(),
                "quarantineCount", quarantineCount,
                "releasedCount", releasedCount
        );
    }
}