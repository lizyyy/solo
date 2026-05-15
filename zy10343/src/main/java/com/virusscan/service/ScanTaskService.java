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
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
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

    private static final Set<TaskStatus> ACTIVE_STATUSES;
    private static final Set<TaskStatus> TERMINAL_STATUSES;
    private static final Set<TaskStatus> EMPTY_SET;
    private static final Map<TaskStatus, Set<TaskStatus>> ALLOWED_TRANSITIONS;

    static {
        Set<TaskStatus> active = new HashSet<>();
        active.add(TaskStatus.PENDING);
        active.add(TaskStatus.SCANNING);
        ACTIVE_STATUSES = Collections.unmodifiableSet(active);

        Set<TaskStatus> terminal = new HashSet<>();
        terminal.add(TaskStatus.CLEAN);
        terminal.add(TaskStatus.INFECTED);
        terminal.add(TaskStatus.CANCELLED);
        TERMINAL_STATUSES = Collections.unmodifiableSet(terminal);

        EMPTY_SET = Collections.unmodifiableSet(new HashSet<TaskStatus>());

        Map<TaskStatus, Set<TaskStatus>> transitions = new HashMap<>();

        Set<TaskStatus> fromPending = new HashSet<>();
        fromPending.add(TaskStatus.SCANNING);
        fromPending.add(TaskStatus.CANCELLED);
        fromPending.add(TaskStatus.FAILED);
        transitions.put(TaskStatus.PENDING, Collections.unmodifiableSet(fromPending));

        Set<TaskStatus> fromScanning = new HashSet<>();
        fromScanning.add(TaskStatus.CLEAN);
        fromScanning.add(TaskStatus.INFECTED);
        fromScanning.add(TaskStatus.FAILED);
        fromScanning.add(TaskStatus.CANCELLED);
        transitions.put(TaskStatus.SCANNING, Collections.unmodifiableSet(fromScanning));

        Set<TaskStatus> fromInfected = new HashSet<>();
        fromInfected.add(TaskStatus.QUARANTINED);
        transitions.put(TaskStatus.INFECTED, Collections.unmodifiableSet(fromInfected));

        Set<TaskStatus> fromQuarantined = new HashSet<>();
        fromQuarantined.add(TaskStatus.RELEASED);
        transitions.put(TaskStatus.QUARANTINED, Collections.unmodifiableSet(fromQuarantined));

        Set<TaskStatus> fromFailed = new HashSet<>();
        fromFailed.add(TaskStatus.PENDING);
        transitions.put(TaskStatus.FAILED, Collections.unmodifiableSet(fromFailed));

        transitions.put(TaskStatus.CANCELLED, Collections.unmodifiableSet(new HashSet<TaskStatus>()));
        transitions.put(TaskStatus.CLEAN, Collections.unmodifiableSet(new HashSet<TaskStatus>()));
        transitions.put(TaskStatus.RELEASED, Collections.unmodifiableSet(new HashSet<TaskStatus>()));

        ALLOWED_TRANSITIONS = Collections.unmodifiableMap(transitions);
    }

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

            if (TERMINAL_STATUSES.contains(targetStatus)) {
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
        return ALLOWED_TRANSITIONS.getOrDefault(current, EMPTY_SET).contains(target);
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

        NotificationType type;
        switch (task.getStatus()) {
            case CLEAN:
                type = NotificationType.SCAN_COMPLETE;
                break;
            case INFECTED:
                type = NotificationType.VIRUS_DETECTED;
                break;
            case FAILED:
                type = NotificationType.SCAN_FAILED;
                break;
            case QUARANTINED:
                type = NotificationType.FILE_QUARANTINED;
                break;
            default:
                type = null;
        }

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

        Map<String, Object> result = new HashMap<>();
        result.put("statusDistribution", statusCount);
        result.put("totalTasks", (long) allTasks.size());
        result.put("quarantineCount", quarantineCount);
        result.put("releasedCount", releasedCount);
        return Collections.unmodifiableMap(result);
    }
}