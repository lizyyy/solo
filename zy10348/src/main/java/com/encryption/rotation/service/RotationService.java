package com.encryption.rotation.service;

import com.encryption.rotation.exception.RotationException;
import com.encryption.rotation.model.dto.CreateRotationRequest;
import com.encryption.rotation.model.dto.RotationReport;
import com.encryption.rotation.model.entity.*;
import com.encryption.rotation.model.enums.FailureType;
import com.encryption.rotation.model.enums.RotationStatus;
import com.encryption.rotation.model.enums.TaskStatus;
import com.encryption.rotation.model.enums.VerificationStatus;
import com.encryption.rotation.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Random;
import java.util.Set;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class RotationService {

    private final RotationBatchRepository batchRepository;
    private final ReEncryptionTaskRepository taskRepository;
    private final FailureRecordRepository failureRecordRepository;
    private final VerificationRecordRepository verificationRecordRepository;
    private final KeyVersionRepository keyVersionRepository;
    private final TenantRepository tenantRepository;
    private final RotationStateMachine stateMachine;

    @Transactional
    public RotationBatch createRotation(CreateRotationRequest request) {
        validateTenant(request.getTenantId());
        validateKeys(request.getTenantId(), request.getSourceKeyId(), request.getTargetKeyId());

        String dataSignature = generateDataSignature(request.getDataIdentifiers());
        
        Set<RotationStatus> activeStatuses = new HashSet<>(Arrays.asList(
            RotationStatus.PENDING,
            RotationStatus.VALIDATING,
            RotationStatus.IN_PROGRESS,
            RotationStatus.PARTIAL_SUCCESS,
            RotationStatus.VERIFYING
        ));
        
        RotationBatch existingBatch = batchRepository
            .findByTenantIdAndSourceKeyIdAndTargetKeyIdAndDataSignatureAndStatusIn(
                request.getTenantId(),
                request.getSourceKeyId(),
                request.getTargetKeyId(),
                dataSignature,
                activeStatuses
            )
            .orElse(null);
            
        if (existingBatch != null) {
            log.warn("检测到重复提交：租户{}、源密钥{}、目标密钥{}、相同数据标识的批次已存在，返回已有批次: {}",
                request.getTenantId(), request.getSourceKeyId(), request.getTargetKeyId(), existingBatch.getBatchNumber());
            return existingBatch;
        }

        String batchNumber = generateBatchNumber();
        
        if (batchRepository.existsByBatchNumber(batchNumber)) {
            throw new RotationException("BATCH_EXISTS", "批次号已存在: " + batchNumber);
        }

        RotationBatch batch = new RotationBatch();
        batch.setBatchNumber(batchNumber);
        batch.setTenantId(request.getTenantId());
        batch.setSourceKeyId(request.getSourceKeyId());
        batch.setTargetKeyId(request.getTargetKeyId());
        batch.setCreatedBy(request.getCreatedBy());
        batch.setReason(request.getReason());
        batch.setTotalTaskCount(request.getDataIdentifiers().size());
        batch.setDataSignature(dataSignature);
        batch = batchRepository.save(batch);

        for (String dataIdentifier : request.getDataIdentifiers()) {
            if (taskRepository.existsByBatchIdAndDataIdentifier(batch.getId(), dataIdentifier)) {
                log.warn("批次{}中数据标识{}已存在，跳过重复创建", batch.getId(), dataIdentifier);
                continue;
            }
            ReEncryptionTask task = new ReEncryptionTask();
            task.setBatchId(batch.getId());
            task.setTenantId(request.getTenantId());
            task.setDataIdentifier(dataIdentifier);
            task.setDataType("DEFAULT");
            taskRepository.save(task);
        }

        log.info("创建轮换批次成功: {}, 任务数: {}", batchNumber, request.getDataIdentifiers().size());
        return batch;
    }
    
    private String generateDataSignature(List<String> dataIdentifiers) {
        try {
            List<String> sortedIdentifiers = new java.util.ArrayList<>(dataIdentifiers);
            Collections.sort(sortedIdentifiers);
            String content = String.join(",", sortedIdentifiers);
            
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(content.getBytes(StandardCharsets.UTF_8));
            
            StringBuilder hexString = new StringBuilder();
            for (byte b : hash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) {
                    hexString.append('0');
                }
                hexString.append(hex);
            }
            return hexString.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new RotationException("SIGNATURE_ERROR", "生成数据签名失败: " + e.getMessage());
        }
    }

    @Transactional
    public RotationBatch startRotation(String batchId) {
        RotationBatch batch = getBatchOrThrow(batchId);
        
        stateMachine.validateTransition(batch.getStatus(), RotationStatus.VALIDATING);
        batch.setStatus(RotationStatus.VALIDATING);
        batch.setStartedAt(LocalDateTime.now());
        batch = batchRepository.save(batch);

        try {
            validateBatchBeforeStart(batch);
        } catch (Exception e) {
            batch.setStatus(RotationStatus.FAILED);
            batch.setErrorMessage(e.getMessage());
            batchRepository.save(batch);
            throw e;
        }

        stateMachine.validateTransition(batch.getStatus(), RotationStatus.IN_PROGRESS);
        batch.setStatus(RotationStatus.IN_PROGRESS);
        return batchRepository.save(batch);
    }

    @Transactional
    public void processTask(String taskId, boolean simulateFailure) {
        ReEncryptionTask task = taskRepository.findById(taskId)
            .orElseThrow(() -> new RotationException("TASK_NOT_FOUND", "任务不存在: " + taskId));

        if (task.getStatus() == TaskStatus.SUCCESS) {
            log.warn("任务{}已成功完成，跳过重复处理", taskId);
            return;
        }

        task.setStatus(TaskStatus.PROCESSING);
        task.setStartedAt(LocalDateTime.now());
        taskRepository.save(task);

        try {
            if (simulateFailure) {
                throw new RuntimeException("模拟重加密失败: 密钥解密错误");
            }
            
            Thread.sleep(new Random().nextInt(100) + 50);
            
            task.setStatus(TaskStatus.SUCCESS);
            task.setCompletedAt(LocalDateTime.now());
            log.info("任务{}处理成功", taskId);
        } catch (Exception e) {
            task.setStatus(TaskStatus.FAILED);
            task.setCompletedAt(LocalDateTime.now());
            task.setErrorDetail(e.getMessage());
            task.setRetryCount(task.getRetryCount() + 1);
            
            recordFailure(task.getBatchId(), taskId, task.getTenantId(), e);
            log.error("任务{}处理失败: {}", taskId, e.getMessage());
        }

        taskRepository.save(task);
        updateBatchProgress(task.getBatchId());
    }

    @Transactional
    public RotationBatch cancelRotation(String batchId, String reason) {
        RotationBatch batch = getBatchOrThrow(batchId);
        
        if (!stateMachine.canCancel(batch.getStatus())) {
            throw new RotationException("INVALID_OPERATION", "当前状态不支持取消: " + batch.getStatus());
        }

        stateMachine.validateTransition(batch.getStatus(), RotationStatus.CANCELLED);
        batch.setStatus(RotationStatus.CANCELLED);
        batch.setErrorMessage(reason);
        batch.setCompletedAt(LocalDateTime.now());

        List<ReEncryptionTask> pendingTasks = taskRepository.findByBatchIdAndStatusOrderByCreatedAt(
            batchId, TaskStatus.PENDING);
        for (ReEncryptionTask task : pendingTasks) {
            task.setStatus(TaskStatus.SKIPPED);
            task.setCompletedAt(LocalDateTime.now());
            taskRepository.save(task);
        }

        updateBatchProgress(batchId);
        log.info("批次{}已取消", batchId);
        return batchRepository.save(batch);
    }

    @Transactional
    public RotationBatch startVerification(String batchId, String operator) {
        RotationBatch batch = getBatchOrThrow(batchId);
        
        stateMachine.validateTransition(batch.getStatus(), RotationStatus.VERIFYING);
        batch.setStatus(RotationStatus.VERIFYING);
        batch = batchRepository.save(batch);

        List<ReEncryptionTask> successTasks = taskRepository.findByBatchIdAndStatusOrderByCreatedAt(
            batchId, TaskStatus.SUCCESS);
        
        int sampleSize = Math.max(1, (int) Math.ceil(successTasks.size() * 0.1));
        Random random = new Random();
        
        for (int i = 0; i < Math.min(sampleSize, successTasks.size()); i++) {
            int index = random.nextInt(successTasks.size());
            ReEncryptionTask task = successTasks.get(index);
            
            VerificationRecord record = new VerificationRecord();
            record.setBatchId(batchId);
            record.setTaskId(task.getId());
            record.setTenantId(batch.getTenantId());
            record.setVerifiedBy(operator);
            record.setIsSampled(true);
            record.setStatus(VerificationStatus.IN_PROGRESS);
            verificationRecordRepository.save(record);
        }

        log.info("批次{}开始验证，抽样任务数: {}", batchId, sampleSize);
        return batch;
    }

    @Transactional
    public RotationBatch completeRotation(String batchId) {
        RotationBatch batch = getBatchOrThrow(batchId);
        
        stateMachine.validateTransition(batch.getStatus(), RotationStatus.COMPLETED);
        batch.setStatus(RotationStatus.COMPLETED);
        batch.setCompletedAt(LocalDateTime.now());
        
        updateBatchProgress(batchId);
        log.info("批次{}已完成", batchId);
        return batchRepository.save(batch);
    }

    public RotationReport generateReport(String batchId) {
        RotationBatch batch = getBatchOrThrow(batchId);
        
        RotationReport report = RotationReport.builder()
            .batchId(batch.getId())
            .batchNumber(batch.getBatchNumber())
            .tenantId(batch.getTenantId())
            .status(batch.getStatus())
            .totalTaskCount(batch.getTotalTaskCount())
            .successCount(batch.getSuccessCount())
            .failedCount(batch.getFailedCount())
            .skippedCount(batch.getSkippedCount())
            .startedAt(batch.getStartedAt())
            .completedAt(batch.getCompletedAt())
            .createdBy(batch.getCreatedBy())
            .reason(batch.getReason())
            .build();

        if (batch.getTotalTaskCount() > 0) {
            double successRate = (batch.getSuccessCount() * 100.0) / batch.getTotalTaskCount();
            report.setSuccessRate(Math.round(successRate * 100.0) / 100.0);
        }

        if (batch.getStartedAt() != null && batch.getCompletedAt() != null) {
            long seconds = Duration.between(batch.getStartedAt(), batch.getCompletedAt()).getSeconds();
            report.setDurationInSeconds(seconds);
        }

        return report;
    }

    public RotationBatch getBatch(String batchId) {
        return getBatchOrThrow(batchId);
    }

    public List<RotationBatch> getBatchHistory(String tenantId) {
        return batchRepository.findByTenantIdOrderByCreatedAtDesc(tenantId);
    }

    public List<ReEncryptionTask> getTasks(String batchId) {
        return taskRepository.findByBatchIdOrderByCreatedAt(batchId);
    }

    public List<FailureRecord> getFailures(String batchId) {
        return failureRecordRepository.findByBatchIdOrderByCreatedAtDesc(batchId);
    }

    public List<VerificationRecord> getVerifications(String batchId) {
        return verificationRecordRepository.findByBatchIdOrderByCreatedAtDesc(batchId);
    }

    private void validateTenant(String tenantId) {
        if (!tenantRepository.existsById(tenantId)) {
            throw new RotationException("TENANT_NOT_FOUND", "租户不存在: " + tenantId);
        }
    }

    private void validateKeys(String tenantId, String sourceKeyId, String targetKeyId) {
        if (sourceKeyId.equals(targetKeyId)) {
            throw new RotationException("SAME_KEY", "源密钥和目标密钥不能相同");
        }
        
        KeyVersion sourceKey = keyVersionRepository.findById(sourceKeyId)
            .orElseThrow(() -> new RotationException("KEY_NOT_FOUND", "源密钥不存在: " + sourceKeyId));
        
        KeyVersion targetKey = keyVersionRepository.findById(targetKeyId)
            .orElseThrow(() -> new RotationException("KEY_NOT_FOUND", "目标密钥不存在: " + targetKeyId));
        
        if (!sourceKey.getTenantId().equals(tenantId) || !targetKey.getTenantId().equals(tenantId)) {
            throw new RotationException("KEY_TENANT_MISMATCH", "密钥不属于当前租户");
        }
    }

    private void validateBatchBeforeStart(RotationBatch batch) {
        long taskCount = taskRepository.findByBatchIdOrderByCreatedAt(batch.getId()).size();
        if (taskCount == 0) {
            throw new RotationException("NO_TASKS", "批次中没有任务");
        }
        if (taskCount != batch.getTotalTaskCount()) {
            log.warn("批次{}任务数不匹配: 预期{}, 实际{}", 
                batch.getId(), batch.getTotalTaskCount(), taskCount);
        }
    }

    private RotationBatch getBatchOrThrow(String batchId) {
        return batchRepository.findById(batchId)
            .orElseThrow(() -> new RotationException("BATCH_NOT_FOUND", "批次不存在: " + batchId));
    }

    private void updateBatchProgress(String batchId) {
        RotationBatch batch = getBatchOrThrow(batchId);
        
        long successCount = taskRepository.countByBatchIdAndStatus(batchId, TaskStatus.SUCCESS);
        long failedCount = taskRepository.countByBatchIdAndStatus(batchId, TaskStatus.FAILED);
        long skippedCount = taskRepository.countByBatchIdAndStatus(batchId, TaskStatus.SKIPPED);
        
        batch.setSuccessCount((int) successCount);
        batch.setFailedCount((int) failedCount);
        batch.setSkippedCount((int) skippedCount);
        
        if (!stateMachine.isTerminalStatus(batch.getStatus())) {
            long totalProcessed = successCount + failedCount + skippedCount;
            if (totalProcessed >= batch.getTotalTaskCount()) {
                if (failedCount == 0) {
                    batch.setStatus(RotationStatus.VERIFYING);
                } else {
                    batch.setStatus(RotationStatus.PARTIAL_SUCCESS);
                }
            }
        }
        
        batchRepository.save(batch);
    }

    private void recordFailure(String batchId, String taskId, String tenantId, Exception e) {
        FailureRecord record = new FailureRecord();
        record.setBatchId(batchId);
        record.setTaskId(taskId);
        record.setTenantId(tenantId);
        record.setFailureType(FailureType.DECRYPTION_ERROR);
        record.setErrorMessage(e.getMessage());
        record.setStackTrace(e.getStackTrace() != null ? e.getStackTrace()[0].toString() : null);
        record.setRecoverable(true);
        failureRecordRepository.save(record);
    }

    private String generateBatchNumber() {
        String date = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        String uuid = UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        return "ROT-" + date + "-" + uuid;
    }
}
