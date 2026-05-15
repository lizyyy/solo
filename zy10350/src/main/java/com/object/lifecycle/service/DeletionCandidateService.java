package com.object.lifecycle.service;

import com.object.lifecycle.dto.CreateDeletionCandidateRequest;
import com.object.lifecycle.entity.DeletionCandidate;
import com.object.lifecycle.entity.LifecycleRule;
import com.object.lifecycle.enums.TaskStatus;
import com.object.lifecycle.exception.BusinessException;
import com.object.lifecycle.repository.DeletionCandidateRepository;
import com.object.lifecycle.repository.LifecycleRuleRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class DeletionCandidateService {

    private final DeletionCandidateRepository candidateRepository;
    private final LifecycleRuleRepository ruleRepository;
    private final AuditLogService auditLogService;
    private final RetentionExceptionService exceptionService;
    private final ExecutionProofService proofService;

    @Transactional
    public DeletionCandidate createCandidate(CreateDeletionCandidateRequest request) {
        LifecycleRule rule = ruleRepository.findById(request.getRuleId())
                .orElseThrow(() -> new BusinessException(404, "规则不存在"));

        if (exceptionService.hasActiveException(request.getObjectKey(), request.getBucketName())) {
            throw new BusinessException(400, "该对象存在保留例外，不能加入删除候选");
        }

        if (candidateRepository.existsByRuleIdAndObjectKeyAndBucketName(
                request.getRuleId(), request.getObjectKey(), request.getBucketName())) {
            throw new BusinessException(400, "该规则下已存在相同对象的删除候选");
        }

        DeletionCandidate candidate = new DeletionCandidate();
        candidate.setObjectKey(request.getObjectKey());
        candidate.setBucketName(request.getBucketName());
        candidate.setObjectSize(request.getObjectSize());
        candidate.setRule(rule);
        candidate.setLastModifiedDate(request.getLastModifiedDate());
        candidate.setScheduledDeletionDate(request.getScheduledDeletionDate() != null
                ? request.getScheduledDeletionDate() : LocalDateTime.now().plusDays(30));
        candidate.setStatus(TaskStatus.PENDING);
        candidate.setHasException(false);

        DeletionCandidate saved = candidateRepository.save(candidate);
        auditLogService.logAction("DeletionCandidate", saved.getId().toString(), "CREATE", null, null);
        proofService.createProof("CREATE_DELETION_CANDIDATE", rule.getRuleId(), null,
                saved.getObjectKey(), saved.getBucketName(), true, null, null);
        log.info("创建删除候选: id={}, ruleId={}, objectKey={}",
                saved.getId(), rule.getRuleId(), saved.getObjectKey());
        return saved;
    }

    public DeletionCandidate getCandidateById(Long id) {
        return candidateRepository.findById(id)
                .orElseThrow(() -> new BusinessException(404, "删除候选不存在"));
    }

    public List<DeletionCandidate> getAllCandidates() {
        return candidateRepository.findAll();
    }

    public List<DeletionCandidate> getCandidatesByStatus(TaskStatus status) {
        return candidateRepository.findByStatus(status);
    }

    public List<DeletionCandidate> getCandidatesByRuleId(Long ruleId) {
        return candidateRepository.findByRuleId(ruleId);
    }

    @Transactional
    public DeletionCandidate markAsDeleted(Long id) {
        DeletionCandidate candidate = getCandidateById(id);
        if (candidate.getStatus() != TaskStatus.PENDING) {
            throw new BusinessException(400, "只有待处理状态的候选才能标记删除");
        }

        if (exceptionService.hasActiveException(candidate.getObjectKey(), candidate.getBucketName())) {
            throw new BusinessException(400, "该对象存在保留例外，不能删除");
        }

        TaskStatus oldStatus = candidate.getStatus();
        candidate.setStatus(TaskStatus.COMPLETED);
        candidate.setDeletionTime(LocalDateTime.now());
        DeletionCandidate saved = candidateRepository.save(candidate);
        auditLogService.logAction("DeletionCandidate", saved.getId().toString(), "DELETE",
                "status", oldStatus.name(), TaskStatus.COMPLETED.name());
        proofService.createProof("EXECUTE_DELETION", saved.getRule().getRuleId(), null,
                saved.getObjectKey(), saved.getBucketName(), true, "删除成功", null);
        log.info("执行对象删除: candidateId={}, objectKey={}", id, candidate.getObjectKey());
        return saved;
    }

    @Transactional
    public DeletionCandidate markAsException(Long id, String reason) {
        DeletionCandidate candidate = getCandidateById(id);
        candidate.setHasException(true);
        DeletionCandidate saved = candidateRepository.save(candidate);
        auditLogService.logAction("DeletionCandidate", saved.getId().toString(), "EXCEPTION",
                "hasException", "false", "true");
        log.info("标记删除候选为例外: candidateId={}, reason={}", id, reason);
        return saved;
    }

    @Transactional
    public DeletionCandidate cancelCandidate(Long id) {
        DeletionCandidate candidate = getCandidateById(id);
        if (candidate.getStatus() == TaskStatus.COMPLETED || candidate.getStatus() == TaskStatus.FAILED) {
            throw new BusinessException(400, "已完成或已失败的候选不能撤销");
        }

        TaskStatus oldStatus = candidate.getStatus();
        candidate.setStatus(TaskStatus.CANCELLED);
        DeletionCandidate saved = candidateRepository.save(candidate);
        auditLogService.logAction("DeletionCandidate", saved.getId().toString(), "CANCEL",
                "status", oldStatus.name(), TaskStatus.CANCELLED.name());
        log.info("撤销删除候选: candidateId={}", id);
        return saved;
    }
}
