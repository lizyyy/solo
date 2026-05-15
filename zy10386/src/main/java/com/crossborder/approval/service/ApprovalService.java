package com.crossborder.approval.service;

import com.crossborder.approval.exception.BusinessException;
import com.crossborder.approval.model.dto.ApprovalRequest;
import com.crossborder.approval.model.entity.ApprovalChain;
import com.crossborder.approval.model.entity.DataAccessApplication;
import com.crossborder.approval.model.entity.DataDomain;
import com.crossborder.approval.model.enums.ApplicationStatus;
import com.crossborder.approval.model.enums.ApprovalResult;
import com.crossborder.approval.repository.ApprovalChainRepository;
import com.crossborder.approval.repository.DataAccessApplicationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class ApprovalService {

    private final ApprovalChainRepository approvalChainRepository;
    private final DataAccessApplicationRepository applicationRepository;
    private final AuditService auditService;

    @Transactional
    public DataAccessApplication approve(Long applicationId, ApprovalRequest request) {
        DataAccessApplication application = applicationRepository.findById(applicationId)
                .orElseThrow(() -> new BusinessException("申请不存在: " + applicationId));

        if (application.getStatus() != ApplicationStatus.PENDING_APPROVAL) {
            throw new BusinessException("只有待审批状态的申请可以审批");
        }

        int currentLevel = application.getCurrentApprovalLevel();
        int requiredLevels = getRequiredApprovalLevels(application.getDataDomain());

        ApprovalChain approvalChain = new ApprovalChain();
        approvalChain.setApplication(application);
        approvalChain.setApprovalLevel(currentLevel);
        approvalChain.setApproverId(request.getApproverId());
        approvalChain.setApproverName(request.getApproverName());
        approvalChain.setResult(request.getResult());
        approvalChain.setComment(request.getComment());
        approvalChain.setApprovedAt(LocalDateTime.now());

        approvalChainRepository.save(approvalChain);

        if (request.getResult() == ApprovalResult.REJECTED) {
            application.setStatus(ApplicationStatus.REJECTED);
            application.setRejectReason(request.getComment());
            auditService.logAction(application, "APPROVAL_REJECTED",
                    request.getApproverId(), request.getApproverName(),
                    "审批被拒绝，级别: " + currentLevel + ", 原因: " + request.getComment());
        } else if (request.getResult() == ApprovalResult.APPROVED) {
            if (currentLevel >= requiredLevels) {
                application.setStatus(ApplicationStatus.APPROVED);
                auditService.logAction(application, "APPROVAL_COMPLETED",
                        request.getApproverId(), request.getApproverName(),
                        "审批流程全部完成，共 " + requiredLevels + " 级");
            } else {
                application.setCurrentApprovalLevel(currentLevel + 1);
                auditService.logAction(application, "APPROVAL_LEVEL_PASSED",
                        request.getApproverId(), request.getApproverName(),
                        "第 " + currentLevel + " 级审批通过，进入第 " + (currentLevel + 1) + " 级");
            }
        }

        return applicationRepository.save(application);
    }

    public List<ApprovalChain> getApprovalHistory(Long applicationId) {
        return approvalChainRepository.findByApplicationIdOrderByApprovalLevel(applicationId);
    }

    private int getRequiredApprovalLevels(DataDomain dataDomain) {
        if (Boolean.TRUE.equals(dataDomain.getRequiresSpecialApproval())) {
            return 3;
        }
        int sensitivityLevel = dataDomain.getSensitivityLevel() != null ? dataDomain.getSensitivityLevel() : 2;
        return switch (sensitivityLevel) {
            case 1 -> 1;
            case 2 -> 2;
            case 3 -> 3;
            default -> 2;
        };
    }
}
