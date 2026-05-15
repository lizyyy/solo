package com.object.lifecycle.service;

import com.object.lifecycle.dto.CreateRetentionExceptionRequest;
import com.object.lifecycle.entity.LifecycleRule;
import com.object.lifecycle.entity.RetentionException;
import com.object.lifecycle.exception.BusinessException;
import com.object.lifecycle.repository.LifecycleRuleRepository;
import com.object.lifecycle.repository.RetentionExceptionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class RetentionExceptionService {

    private final RetentionExceptionRepository exceptionRepository;
    private final LifecycleRuleRepository ruleRepository;
    private final AuditLogService auditLogService;
    private final ExecutionProofService proofService;

    public boolean hasActiveException(String objectKey, String bucketName) {
        List<RetentionException> exceptions = exceptionRepository.findActiveExceptions(
                objectKey, bucketName, LocalDateTime.now());
        return !exceptions.isEmpty();
    }

    public List<RetentionException> getActiveExceptions(String objectKey, String bucketName) {
        return exceptionRepository.findActiveExceptions(objectKey, bucketName, LocalDateTime.now());
    }

    public List<RetentionException> getAllExceptions() {
        return exceptionRepository.findAll();
    }

    public List<RetentionException> getExceptionsByObject(String objectKey, String bucketName) {
        return exceptionRepository.findByObjectKeyAndBucketName(objectKey, bucketName);
    }

    public RetentionException getExceptionById(Long id) {
        return exceptionRepository.findById(id)
                .orElseThrow(() -> new BusinessException(404, "保留例外不存在"));
    }

    @Transactional
    public RetentionException createException(CreateRetentionExceptionRequest request) {
        if (exceptionRepository.existsByObjectKeyAndBucketNameAndRuleId(
                request.getObjectKey(), request.getBucketName(), request.getRuleId())) {
            throw new BusinessException(400, "该对象已存在保留例外");
        }

        if (request.getEffectiveTo().isBefore(request.getEffectiveFrom())) {
            throw new BusinessException(400, "生效结束时间不能早于开始时间");
        }

        RetentionException exception = new RetentionException();
        exception.setObjectKey(request.getObjectKey());
        exception.setBucketName(request.getBucketName());
        exception.setReason(request.getReason());
        exception.setReasonCode(request.getReasonCode());
        exception.setEffectiveFrom(request.getEffectiveFrom());
        exception.setEffectiveTo(request.getEffectiveTo());
        exception.setEnabled(true);

        if (request.getRuleId() != null) {
            LifecycleRule rule = ruleRepository.findById(request.getRuleId())
                    .orElseThrow(() -> new BusinessException(404, "规则不存在"));
            exception.setRule(rule);
        }

        RetentionException saved = exceptionRepository.save(exception);
        auditLogService.logAction("RetentionException", saved.getId().toString(), "CREATE", null, null);
        proofService.createProof("CREATE_RETENTION_EXCEPTION",
                saved.getRule() != null ? saved.getRule().getRuleId() : null,
                null, saved.getObjectKey(), saved.getBucketName(), true, null, null);
        log.info("创建保留例外: id={}, objectKey={}", saved.getId(), saved.getObjectKey());
        return saved;
    }

    @Transactional
    public RetentionException toggleException(Long id, boolean enabled) {
        RetentionException exception = getExceptionById(id);
        boolean oldEnabled = exception.getEnabled();
        exception.setEnabled(enabled);
        RetentionException saved = exceptionRepository.save(exception);
        auditLogService.logAction("RetentionException", saved.getId().toString(), "TOGGLE",
                "enabled", String.valueOf(oldEnabled), String.valueOf(enabled));
        log.info("更新保留例外状态: id={}, enabled={}", id, enabled);
        return saved;
    }

    @Transactional
    public void deleteException(Long id) {
        RetentionException exception = getExceptionById(id);
        exceptionRepository.delete(exception);
        auditLogService.logAction("RetentionException", id.toString(), "DELETE", null, null);
        log.info("删除保留例外: id={}", id);
    }
}
