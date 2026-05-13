package com.quota.arbitration.service;

import com.quota.arbitration.dto.ApprovalRequest;
import com.quota.arbitration.dto.BorrowApplicationRequest;
import com.quota.arbitration.dto.ReturnRequest;
import com.quota.arbitration.entity.*;
import com.quota.arbitration.enums.ApplicationStatus;
import com.quota.arbitration.enums.ApprovalResult;
import com.quota.arbitration.exception.BusinessException;
import com.quota.arbitration.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class QuotaBorrowService {
    private final BorrowApplicationRepository applicationRepository;
    private final CustomerQuotaRepository customerQuotaRepository;
    private final SharedPoolRepository sharedPoolRepository;
    private final ReturnPlanRepository returnPlanRepository;
    private final ApprovalOpinionRepository approvalOpinionRepository;
    private final DeductionDetailRepository deductionDetailRepository;

    @Transactional
    public BorrowApplication createApplication(BorrowApplicationRequest request) {
        if (applicationRepository.existsByApplicationNo(request.getApplicationNo())) {
            throw new BusinessException("DUPLICATE_APPLICATION", 
                "申请编号已存在: " + request.getApplicationNo());
        }

        CustomerQuota customerQuota = customerQuotaRepository.findByCustomerId(request.getCustomerId())
            .orElseThrow(() -> new BusinessException("CUSTOMER_NOT_FOUND", 
                "客户配额不存在: " + request.getCustomerId()));

        SharedPool sharedPool = sharedPoolRepository.findByPoolCode(request.getPoolCode())
            .orElseThrow(() -> new BusinessException("POOL_NOT_FOUND", 
                "共享池不存在: " + request.getPoolCode()));

        if (!sharedPool.getIsActive()) {
            throw new BusinessException("POOL_INACTIVE", "共享池已停用");
        }

        if (request.getRequestAmount().compareTo(sharedPool.getMaxBorrowPerApplication()) > 0) {
            throw new BusinessException("EXCEED_MAX_BORROW", 
                "申请金额超过单笔最大限额: " + sharedPool.getMaxBorrowPerApplication());
        }

        if (request.getRequestAmount().compareTo(sharedPool.getAvailableAmount()) > 0) {
            throw new BusinessException("INSUFFICIENT_POOL_AMOUNT", 
                "共享池可用额度不足");
        }

        BorrowApplication application = new BorrowApplication();
        application.setApplicationNo(request.getApplicationNo());
        application.setCustomerId(request.getCustomerId());
        application.setCustomerName(customerQuota.getCustomerName());
        application.setPoolCode(request.getPoolCode());
        application.setRequestAmount(request.getRequestAmount());
        application.setBorrowDays(request.getBorrowDays());
        application.setBorrowReason(request.getBorrowReason());
        application.setApplicant(request.getApplicant());
        application.setStatus(ApplicationStatus.DRAFT);

        return applicationRepository.save(application);
    }

    @Transactional
    public BorrowApplication submitForApproval(Long applicationId) {
        BorrowApplication application = applicationRepository.findById(applicationId)
            .orElseThrow(() -> new BusinessException("APPLICATION_NOT_FOUND", "申请不存在"));

        if (application.getStatus() != ApplicationStatus.DRAFT) {
            throw new BusinessException("INVALID_STATUS", "只有草稿状态可以提交审批");
        }

        application.setStatus(ApplicationStatus.PENDING_APPROVAL);
        return applicationRepository.save(application);
    }

    @Transactional
    public BorrowApplication approve(ApprovalRequest request) {
        BorrowApplication application = applicationRepository.findById(request.getApplicationId())
            .orElseThrow(() -> new BusinessException("APPLICATION_NOT_FOUND", "申请不存在"));

        if (application.getStatus() != ApplicationStatus.PENDING_APPROVAL) {
            throw new BusinessException("INVALID_STATUS", "只有待审批状态可以审批");
        }

        ApprovalOpinion opinion = new ApprovalOpinion();
        opinion.setApplicationId(application.getId());
        opinion.setApplicationNo(application.getApplicationNo());
        opinion.setResult(request.getResult());
        opinion.setOpinion(request.getOpinion());
        opinion.setApprover(request.getApprover());
        approvalOpinionRepository.save(opinion);

        if (request.getResult() == ApprovalResult.APPROVE) {
            BigDecimal approvedAmount = request.getApprovedAmount() != null 
                ? request.getApprovedAmount() : application.getRequestAmount();
            application.setApprovedAmount(approvedAmount);
            application.setStatus(ApplicationStatus.APPROVED);
            
            lockQuota(application);
        } else if (request.getResult() == ApprovalResult.REJECT) {
            application.setStatus(ApplicationStatus.REJECTED);
        }

        return applicationRepository.save(application);
    }

    @Transactional
    public void lockQuota(BorrowApplication application) {
        SharedPool sharedPool = sharedPoolRepository.findByPoolCode(application.getPoolCode())
            .orElseThrow(() -> new BusinessException("POOL_NOT_FOUND", "共享池不存在"));

        BigDecimal amount = application.getApprovedAmount();
        
        if (amount.compareTo(sharedPool.getAvailableAmount()) > 0) {
            throw new BusinessException("INSUFFICIENT_POOL_AMOUNT", "共享池可用额度不足");
        }

        sharedPool.setAllocatedAmount(sharedPool.getAllocatedAmount().add(amount));
        sharedPool.setAvailableAmount(sharedPool.getAvailableAmount().subtract(amount));
        sharedPoolRepository.save(sharedPool);

        CustomerQuota customerQuota = customerQuotaRepository.findByCustomerId(application.getCustomerId())
            .orElseThrow(() -> new BusinessException("CUSTOMER_NOT_FOUND", "客户不存在"));
        
        customerQuota.setLockedQuota(customerQuota.getLockedQuota().add(amount));
        customerQuotaRepository.save(customerQuota);

        createDeductionDetail(application, amount, "LOCK", "额度锁定", "system");
        application.setStatus(ApplicationStatus.LOCKED);
    }

    @Transactional
    public BorrowApplication activateApplication(Long applicationId) {
        BorrowApplication application = applicationRepository.findById(applicationId)
            .orElseThrow(() -> new BusinessException("APPLICATION_NOT_FOUND", "申请不存在"));

        if (application.getStatus() != ApplicationStatus.LOCKED) {
            throw new BusinessException("INVALID_STATUS", "只有已锁定状态可以激活");
        }

        CustomerQuota customerQuota = customerQuotaRepository.findByCustomerId(application.getCustomerId())
            .orElseThrow(() -> new BusinessException("CUSTOMER_NOT_FOUND", "客户不存在"));

        BigDecimal amount = application.getApprovedAmount();
        customerQuota.setLockedQuota(customerQuota.getLockedQuota().subtract(amount));
        customerQuota.setBorrowedQuota(customerQuota.getBorrowedQuota().add(amount));
        customerQuotaRepository.save(customerQuota);

        createReturnPlan(application);

        application.setStatus(ApplicationStatus.ACTIVE);
        createDeductionDetail(application, amount, "ACTIVATE", "额度激活", "system");
        
        return applicationRepository.save(application);
    }

    private void createReturnPlan(BorrowApplication application) {
        ReturnPlan plan = new ReturnPlan();
        plan.setApplicationId(application.getId());
        plan.setApplicationNo(application.getApplicationNo());
        plan.setTotalReturnAmount(application.getApprovedAmount());
        plan.setPlanReturnDate(LocalDateTime.now().plusDays(application.getBorrowDays()));
        application.setExpectedReturnDate(plan.getPlanReturnDate());
        returnPlanRepository.save(plan);
    }

    @Transactional
    public ReturnPlan processReturn(ReturnRequest request) {
        ReturnPlan plan = returnPlanRepository.findById(request.getPlanId())
            .orElseThrow(() -> new BusinessException("PLAN_NOT_FOUND", "归还计划不存在"));

        if (plan.getIsCompleted()) {
            throw new BusinessException("PLAN_COMPLETED", "该计划已完成归还");
        }

        if (request.getReturnAmount().compareTo(plan.getRemainingAmount()) > 0) {
            throw new BusinessException("EXCEED_REMAINING", "归还金额超过剩余应还金额");
        }

        plan.setReturnedAmount(plan.getReturnedAmount().add(request.getReturnAmount()));
        plan.setRemainingAmount(plan.getRemainingAmount().subtract(request.getReturnAmount()));

        if (plan.getRemainingAmount().compareTo(BigDecimal.ZERO) == 0) {
            plan.setIsCompleted(true);
            plan.setActualReturnDate(LocalDateTime.now());
        }

        BorrowApplication application = applicationRepository.findById(plan.getApplicationId())
            .orElseThrow(() -> new BusinessException("APPLICATION_NOT_FOUND", "申请不存在"));

        CustomerQuota customerQuota = customerQuotaRepository.findByCustomerId(application.getCustomerId())
            .orElseThrow(() -> new BusinessException("CUSTOMER_NOT_FOUND", "客户不存在"));

        customerQuota.setBorrowedQuota(customerQuota.getBorrowedQuota().subtract(request.getReturnAmount()));
        customerQuotaRepository.save(customerQuota);

        SharedPool sharedPool = sharedPoolRepository.findByPoolCode(application.getPoolCode())
            .orElseThrow(() -> new BusinessException("POOL_NOT_FOUND", "共享池不存在"));

        sharedPool.setAllocatedAmount(sharedPool.getAllocatedAmount().subtract(request.getReturnAmount()));
        sharedPool.setAvailableAmount(sharedPool.getAvailableAmount().add(request.getReturnAmount()));
        sharedPoolRepository.save(sharedPool);

        if (plan.getIsCompleted()) {
            application.setStatus(ApplicationStatus.FULLY_RETURNED);
        } else {
            application.setStatus(ApplicationStatus.PARTIALLY_RETURNED);
        }
        applicationRepository.save(application);

        createDeductionDetail(application, request.getReturnAmount(), "RETURN", 
            "额度归还: " + request.getRemarks(), request.getOperator());

        return returnPlanRepository.save(plan);
    }

    private void createDeductionDetail(BorrowApplication application, BigDecimal amount, 
            String type, String remarks, String operator) {
        DeductionDetail detail = new DeductionDetail();
        detail.setTransactionNo(generateTransactionNo());
        detail.setApplicationId(application.getId());
        detail.setApplicationNo(application.getApplicationNo());
        detail.setCustomerId(application.getCustomerId());
        detail.setPoolCode(application.getPoolCode());
        detail.setAmount(amount);
        detail.setDeductionType(type);
        detail.setRemarks(remarks);
        detail.setOperator(operator);
        deductionDetailRepository.save(detail);
    }

    private String generateTransactionNo() {
        return "TXN" + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss")) 
            + UUID.randomUUID().toString().substring(0, 6).toUpperCase();
    }

    public BorrowApplication getApplication(String applicationNo) {
        return applicationRepository.findByApplicationNo(applicationNo)
            .orElseThrow(() -> new BusinessException("APPLICATION_NOT_FOUND", "申请不存在"));
    }

    public List<BorrowApplication> getApplicationsByCustomer(String customerId) {
        return applicationRepository.findByCustomerId(customerId);
    }

    public List<ApprovalOpinion> getApprovalOpinions(Long applicationId) {
        return approvalOpinionRepository.findByApplicationId(applicationId);
    }

    public List<ReturnPlan> getReturnPlans(Long applicationId) {
        return returnPlanRepository.findByApplicationId(applicationId);
    }

    public List<DeductionDetail> getDeductionDetails(Long applicationId) {
        return deductionDetailRepository.findByApplicationId(applicationId);
    }

    public CustomerQuota getCustomerQuota(String customerId) {
        return customerQuotaRepository.findByCustomerId(customerId)
            .orElseThrow(() -> new BusinessException("CUSTOMER_NOT_FOUND", "客户配额不存在"));
    }

    public SharedPool getSharedPool(String poolCode) {
        return sharedPoolRepository.findByPoolCode(poolCode)
            .orElseThrow(() -> new BusinessException("POOL_NOT_FOUND", "共享池不存在"));
    }

    @Transactional
    public CustomerQuota createCustomerQuota(CustomerQuota quota) {
        if (customerQuotaRepository.existsByCustomerId(quota.getCustomerId())) {
            throw new BusinessException("DUPLICATE_CUSTOMER", "客户ID已存在");
        }
        return customerQuotaRepository.save(quota);
    }

    @Transactional
    public SharedPool createSharedPool(SharedPool pool) {
        if (sharedPoolRepository.existsByPoolCode(pool.getPoolCode())) {
            throw new BusinessException("DUPLICATE_POOL", "共享池编码已存在");
        }
        return sharedPoolRepository.save(pool);
    }
}
