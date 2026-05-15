package com.privacy.replay.service;

import com.privacy.replay.exception.BusinessException;
import com.privacy.replay.exception.ErrorCode;
import com.privacy.replay.model.MaskingLevel;
import com.privacy.replay.model.PrivacyBudget;
import com.privacy.replay.repository.PrivacyBudgetRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class PrivacyBudgetService {

    private final PrivacyBudgetRepository privacyBudgetRepository;

    public PrivacyBudget getBudgetByUserId(String userId) {
        return privacyBudgetRepository.findByUserIdAndIsActiveTrue(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.BUDGET_NOT_FOUND));
    }

    @Transactional(rollbackFor = Exception.class)
    public PrivacyBudget createBudget(String userId, BigDecimal totalBudget,
                                     Integer maxUsageCount, MaskingLevel defaultMaskingLevel) {
        PrivacyBudget budget = new PrivacyBudget();
        budget.setBudgetId("BUD" + UUID.randomUUID().toString().replace("-", "").substring(0, 16));
        budget.setUserId(userId);
        budget.setTotalBudget(totalBudget);
        budget.setRemainingBudget(totalBudget);
        budget.setMaxUsageCount(maxUsageCount);
        budget.setRemainingCount(maxUsageCount);
        budget.setDefaultMaskingLevel(defaultMaskingLevel);
        budget.setExpiredAt(LocalDateTime.now().plusDays(30));
        return privacyBudgetRepository.save(budget);
    }

    @Transactional(rollbackFor = Exception.class)
    public void deductBudget(String userId, BigDecimal cost) {
        PrivacyBudget budget = getBudgetByUserId(userId);

        if (budget.getExpiredAt().isBefore(LocalDateTime.now())) {
            throw new BusinessException(ErrorCode.BUDGET_EXPIRED);
        }

        if (budget.getRemainingBudget().compareTo(cost) < 0) {
            throw new BusinessException(ErrorCode.BUDGET_INSUFFICIENT);
        }

        if (budget.getRemainingCount() <= 0) {
            throw new BusinessException(ErrorCode.COUNT_LIMIT_EXCEEDED);
        }

        budget.setUsedBudget(budget.getUsedBudget().add(cost));
        budget.setRemainingBudget(budget.getRemainingBudget().subtract(cost));
        budget.setUsedCount(budget.getUsedCount() + 1);
        budget.setRemainingCount(budget.getRemainingCount() - 1);

        privacyBudgetRepository.save(budget);
        log.info("Budget deducted: userId={}, cost={}, remaining={}", userId, cost, budget.getRemainingBudget());
    }

    public void checkBudgetAvailability(String userId, BigDecimal cost) {
        PrivacyBudget budget = getBudgetByUserId(userId);

        if (budget.getExpiredAt().isBefore(LocalDateTime.now())) {
            throw new BusinessException(ErrorCode.BUDGET_EXPIRED);
        }

        if (budget.getRemainingBudget().compareTo(cost) < 0) {
            throw new BusinessException(ErrorCode.BUDGET_INSUFFICIENT);
        }

        if (budget.getRemainingCount() <= 0) {
            throw new BusinessException(ErrorCode.COUNT_LIMIT_EXCEEDED);
        }
    }

    public boolean isMaskingLevelAllowed(String userId, MaskingLevel requestedLevel) {
        PrivacyBudget budget = getBudgetByUserId(userId);
        MaskingLevel defaultLevel = budget.getDefaultMaskingLevel();
        return requestedLevel.getLevel() >= defaultLevel.getLevel();
    }

    @Scheduled(cron = "0 0 1 * * ?")
    @Transactional(rollbackFor = Exception.class)
    public void expireOldBudgets() {
        List<PrivacyBudget> expiredBudgets = privacyBudgetRepository
                .findByExpiredAtBeforeAndIsActiveTrue(LocalDateTime.now());
        for (PrivacyBudget budget : expiredBudgets) {
            budget.setIsActive(false);
            privacyBudgetRepository.save(budget);
        }
        log.info("Expired {} budgets", expiredBudgets.size());
    }
}
