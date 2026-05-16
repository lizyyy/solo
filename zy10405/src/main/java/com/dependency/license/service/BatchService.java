package com.dependency.license.service;

import com.dependency.license.dto.ApprovalRequest;
import com.dependency.license.dto.CreateBatchRequest;
import com.dependency.license.dto.DeferralRequestDto;
import com.dependency.license.exception.BusinessException;
import com.dependency.license.model.*;
import com.dependency.license.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class BatchService {
    private final UpgradeBatchRepository batchRepository;
    private final RepositoryApprovalRepository approvalRepository;
    private final DeferralRequestRepository deferralRequestRepository;
    private final DependencyPackageRepository packageRepository;
    private final RepositoryRepository repositoryRepository;
    private final AuditService auditService;

    private int batchCounter = 0;

    @Transactional
    public UpgradeBatch createBatch(CreateBatchRequest request) {
        DependencyPackage pkg = packageRepository.findById(request.getPackageId())
                .orElseThrow(() -> new BusinessException(404, "依赖包不存在: " + request.getPackageId()));

        String batchNo = generateBatchNo();

        UpgradeBatch batch = new UpgradeBatch();
        batch.setBatchNo(batchNo);
        batch.setName(request.getName());
        batch.setDescription(request.getDescription());
        batch.setDependencyPackage(pkg);
        batch.setPlannedDate(request.getPlannedDate());
        batch.setRiskAssessment(request.getRiskAssessment());
        batch.setCreatedBy(request.getCreatedBy());
        batch.setStatus(BatchStatus.DRAFT);

        UpgradeBatch savedBatch = batchRepository.save(batch);

        for (Long repoId : request.getRepositoryIds()) {
            Repository repo = repositoryRepository.findById(repoId)
                    .orElseThrow(() -> new BusinessException(404, "仓库不存在: " + repoId));

            RepositoryApproval approval = new RepositoryApproval();
            approval.setBatch(savedBatch);
            approval.setRepository(repo);
            approval.setStatus(ApprovalStatus.PENDING);
            approvalRepository.save(approval);
        }

        savedBatch = batchRepository.findById(savedBatch.getId()).orElseThrow();
        auditService.logSuccess("CREATE_BATCH", "UpgradeBatch", savedBatch.getId(), request, savedBatch);
        return savedBatch;
    }

    @Transactional
    public UpgradeBatch submitForApproval(Long batchId) {
        UpgradeBatch batch = getBatchById(batchId);

        if (batch.getStatus() != BatchStatus.DRAFT) {
            throw new BusinessException(400, "批次状态不正确，当前状态: " + batch.getStatus(), 
                    "batchId=" + batchId + ", currentStatus=" + batch.getStatus());
        }

        batch.setStatus(BatchStatus.PENDING_APPROVAL);
        UpgradeBatch saved = batchRepository.save(batch);
        auditService.logSuccess("SUBMIT_BATCH", "UpgradeBatch", batchId, null, saved);
        return saved;
    }

    @Transactional
    public RepositoryApproval approve(Long approvalId, ApprovalRequest request) {
        RepositoryApproval approval = approvalRepository.findById(approvalId)
                .orElseThrow(() -> new BusinessException(404, "审批记录不存在: " + approvalId));

        if (approval.getStatus() != ApprovalStatus.PENDING) {
            log.info("幂等校验：审批已完成，跳过重复操作 - approvalId: {}, currentStatus: {}", 
                    approvalId, approval.getStatus());
            auditService.logSuccess("APPROVE_IDEMPOTENT", "RepositoryApproval", approvalId, request, 
                    "跳过重复审批 - 当前状态: " + approval.getStatus());
            return approval;
        }

        approval.setStatus(request.getApproved() ? ApprovalStatus.APPROVED : ApprovalStatus.REJECTED);
        approval.setApprover(request.getApprover());
        approval.setApprovalTime(LocalDateTime.now());
        approval.setComment(request.getComment());
        approval.setImpactAssessment(request.getImpactAssessment());

        RepositoryApproval saved = approvalRepository.save(approval);
        checkAndUpdateBatchStatus(approval.getBatch().getId());
        auditService.logSuccess("APPROVE", "RepositoryApproval", approvalId, request, saved);
        return saved;
    }

    @Transactional
    public DeferralRequest requestDeferral(Long approvalId, DeferralRequestDto request) {
        RepositoryApproval approval = approvalRepository.findById(approvalId)
                .orElseThrow(() -> new BusinessException(404, "审批记录不存在: " + approvalId));

        if (approval.getStatus() == ApprovalStatus.APPROVED) {
            throw new BusinessException(400, "已批准的升级不能申请延期", "approvalId=" + approvalId);
        }

        List<DeferralRequest> existingRequests = deferralRequestRepository.findByApprovalId(approvalId);
        for (DeferralRequest existing : existingRequests) {
            if (existing.getApproved() == null) {
                throw new BusinessException(409, "已有待审核的延期申请", "approvalId=" + approvalId);
            }
        }

        approval.setStatus(ApprovalStatus.DEFERRED);
        approvalRepository.save(approval);

        DeferralRequest deferral = new DeferralRequest();
        deferral.setApproval(approval);
        deferral.setRequestedDate(request.getRequestedDate());
        deferral.setReason(request.getReason());
        deferral.setRequestedBy(request.getRequestedBy());
        deferral.setJustification(request.getJustification());

        Deferral saved = deferralRequestRepository.save(deferral);
        auditService.logSuccess("DEFERRAL_REQUEST", "DeferralRequest", saved.getId(), request, saved);
        return saved;
    }

    @Transactional
    public UpgradeBatch startUpgrade(Long batchId) {
        UpgradeBatch batch = getBatchById(batchId);

        if (batch.getStatus() != BatchStatus.PENDING_APPROVAL) {
            throw new BusinessException(400, "批次状态不正确，当前状态: " + batch.getStatus(),
                    "batchId=" + batchId + ", currentStatus=" + batch.getStatus());
        }

        long approvedCount = approvalRepository.countByBatchIdAndStatus(batchId, ApprovalStatus.APPROVED);
        long totalCount = approvalRepository.findByBatchId(batchId).size();

        if (approvedCount < totalCount) {
            throw new BusinessException(400, 
                    String.format("还有 %d 个仓库未完成审批，无法开始升级", totalCount - approvedCount),
                    "approved=" + approvedCount + ", total=" + totalCount);
        }

        batch.setStatus(BatchStatus.IN_PROGRESS);
        batch.setActualDate(LocalDateTime.now());
        UpgradeBatch saved = batchRepository.save(batch);
        auditService.logSuccess("START_UPGRADE", "UpgradeBatch", batchId, null, saved);
        return saved;
    }

    @Transactional
    public UpgradeBatch completeBatch(Long batchId) {
        UpgradeBatch batch = getBatchById(batchId);

        if (batch.getStatus() != BatchStatus.IN_PROGRESS) {
            throw new BusinessException(400, "批次状态不正确，当前状态: " + batch.getStatus(),
                    "batchId=" + batchId + ", currentStatus=" + batch.getStatus());
        }

        if (batch.getStatus() == BatchStatus.COMPLETED) {
            log.info("幂等校验：批次已完成，跳过重复操作 - batchId: {}", batchId);
            return batch;
        }

        batch.setStatus(BatchStatus.COMPLETED);
        UpgradeBatch saved = batchRepository.save(batch);
        auditService.logSuccess("COMPLETE_BATCH", "UpgradeBatch", batchId, null, saved);
        return saved;
    }

    @Transactional
    public RepositoryApproval manualCorrect(Long approvalId, ApprovalStatus newStatus, String operator, String reason) {
        RepositoryApproval approval = approvalRepository.findById(approvalId)
                .orElseThrow(() -> new BusinessException(404, "审批记录不存在: " + approvalId));

        ApprovalStatus oldStatus = approval.getStatus();
        approval.setStatus(newStatus);
        approval.setApprover(operator);
        approval.setApprovalTime(LocalDateTime.now());
        approval.setComment("人工修正: " + reason);

        RepositoryApproval saved = approvalRepository.save(approval);
        checkAndUpdateBatchStatus(approval.getBatch().getId());
        auditService.logSuccess("MANUAL_CORRECT", "RepositoryApproval", approvalId,
                "oldStatus=" + oldStatus + ", newStatus=" + newStatus + ", reason=" + reason, saved);
        return saved;
    }

    private void checkAndUpdateBatchStatus(Long batchId) {
        UpgradeBatch batch = getBatchById(batchId);
        List<RepositoryApproval> approvals = approvalRepository.findByBatchId(batchId);

        boolean allApproved = approvals.stream()
                .allMatch(a -> a.getStatus() == ApprovalStatus.APPROVED);

        if (allApproved && batch.getStatus() == BatchStatus.PENDING_APPROVAL) {
            log.info("所有仓库已批准，批次可进行升级 - batchId: {}", batchId);
        }
    }

    public List<UpgradeBatch> getAllBatches() {
        return batchRepository.findAll();
    }

    public UpgradeBatch getBatchById(Long id) {
        return batchRepository.findById(id)
                .orElseThrow(() -> new BusinessException(404, "批次不存在: " + id));
    }

    public List<RepositoryApproval> getApprovalsByBatch(Long batchId) {
        return approvalRepository.findByBatchId(batchId);
    }

    public List<DeferralRequest> getDeferralsByBatch(Long batchId) {
        return deferralRequestRepository.findByApprovalBatchId(batchId);
    }

    private synchronized String generateBatchNo() {
        String dateStr = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        batchCounter++;
        return String.format("BATCH-%s-%04d", dateStr, batchCounter);
    }
}