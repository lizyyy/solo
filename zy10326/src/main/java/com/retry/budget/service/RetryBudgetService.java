package com.retry.budget.service;

import com.retry.budget.dto.*;
import com.retry.budget.entity.ExhaustionRecord;
import com.retry.budget.entity.FailureHistory;
import com.retry.budget.entity.RetryBudget;
import com.retry.budget.enums.BackoffStrategy;
import com.retry.budget.enums.FailureType;
import com.retry.budget.repository.ExhaustionRecordRepository;
import com.retry.budget.repository.FailureHistoryRepository;
import com.retry.budget.repository.RetryBudgetRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class RetryBudgetService {
    
    private final RetryBudgetRepository retryBudgetRepository;
    private final FailureHistoryRepository failureHistoryRepository;
    private final ExhaustionRecordRepository exhaustionRecordRepository;
    
    @Transactional
    public BudgetResponse createBudget(CreateBudgetRequest request) {
        if (retryBudgetRepository.existsByCallerIdAndTargetApi(request.getCallerId(), request.getTargetApi())) {
            RetryBudget existing = retryBudgetRepository.findByCallerIdAndTargetApi(
                    request.getCallerId(), request.getTargetApi()).orElseThrow();
            return convertToResponse(existing);
        }
        
        RetryBudget budget = new RetryBudget();
        budget.setCallerId(request.getCallerId());
        budget.setTargetApi(request.getTargetApi());
        budget.setTotalBudget(request.getTotalBudget());
        budget.setRemainingBudget(request.getTotalBudget());
        budget.setUsedBudget(0);
        budget.setFailedCount(0);
        budget.setConsecutiveFailures(0);
        budget.setSuccessCount(0);
        budget.setBackoffStrategy(request.getBackoffStrategy());
        budget.setInitialBackoffMs(request.getInitialBackoffMs());
        budget.setMaxBackoffMs(request.getMaxBackoffMs());
        budget.setBackoffMultiplier(request.getBackoffMultiplier());
        budget.setIsExhausted(false);
        budget.setRecoveryIntervalMs(request.getRecoveryIntervalMs());
        
        RetryBudget saved = retryBudgetRepository.save(budget);
        log.info("Created retry budget for caller: {}, target: {}", request.getCallerId(), request.getTargetApi());
        return convertToResponse(saved);
    }
    
    @Transactional
    public RetryCheckResponse checkAndRecordRetry(RetryCheckRequest request) {
        String idempotentKey = request.getIdempotentKey();
        
        if (idempotentKey != null && !idempotentKey.isEmpty()) {
            Optional<FailureHistory> existingHistory = failureHistoryRepository.findByIdempotentKey(idempotentKey);
            if (existingHistory.isPresent()) {
                FailureHistory history = existingHistory.get();
                RetryBudget budget = retryBudgetRepository.findById(history.getBudgetId()).orElseThrow();
                return RetryCheckResponse.builder()
                        .allowed(!budget.getIsExhausted())
                        .budgetId(budget.getId())
                        .callerId(budget.getCallerId())
                        .targetApi(budget.getTargetApi())
                        .remainingBudget(budget.getRemainingBudget())
                        .usedBudget(budget.getUsedBudget())
                        .consecutiveFailures(budget.getConsecutiveFailures())
                        .backoffMs(history.getBackoffMs())
                        .nextRetryAt(history.getCreatedAt().plus(Duration.ofMillis(history.getBackoffMs())))
                        .failureType(history.getFailureType())
                        .isExhausted(budget.getIsExhausted())
                        .isIdempotentHit(true)
                        .message("幂等请求命中，返回历史记录")
                        .build();
            }
        }
        
        RetryBudget budget = retryBudgetRepository.findByCallerIdAndTargetApi(
                request.getCallerId(), request.getTargetApi()).orElseThrow(
                    () -> new IllegalArgumentException("预算不存在，请先创建预算"));
        
        checkAndProcessRecovery(budget);
        
        FailureType classifiedType = classifyFailure(request.getFailureType(), request.getFailureReason());
        
        if (!shouldConsumeBudget(classifiedType)) {
            long backoffMs = calculateBackoff(budget, budget.getConsecutiveFailures());
            return RetryCheckResponse.builder()
                    .allowed(true)
                    .budgetId(budget.getId())
                    .callerId(budget.getCallerId())
                    .targetApi(budget.getTargetApi())
                    .remainingBudget(budget.getRemainingBudget())
                    .usedBudget(budget.getUsedBudget())
                    .consecutiveFailures(budget.getConsecutiveFailures())
                    .backoffMs(backoffMs)
                    .nextRetryAt(LocalDateTime.now().plus(Duration.ofMillis(backoffMs)))
                    .failureType(classifiedType)
                    .isExhausted(false)
                    .isIdempotentHit(false)
                    .message("非消耗性失败，不扣除预算")
                    .build();
        }
        
        if (budget.getIsExhausted()) {
            return RetryCheckResponse.builder()
                    .allowed(false)
                    .budgetId(budget.getId())
                    .callerId(budget.getCallerId())
                    .targetApi(budget.getTargetApi())
                    .remainingBudget(0)
                    .usedBudget(budget.getUsedBudget())
                    .consecutiveFailures(budget.getConsecutiveFailures())
                    .backoffMs(budget.getMaxBackoffMs())
                    .nextRetryAt(budget.getNextRecoveryAt())
                    .failureType(classifiedType)
                    .isExhausted(true)
                    .isIdempotentHit(false)
                    .message("预算已耗尽，请等待恢复或联系管理员")
                    .build();
        }
        
        budget.setUsedBudget(budget.getUsedBudget() + 1);
        budget.setRemainingBudget(budget.getTotalBudget() - budget.getUsedBudget());
        budget.setFailedCount(budget.getFailedCount() + 1);
        budget.setConsecutiveFailures(budget.getConsecutiveFailures() + 1);
        budget.setLastFailureAt(LocalDateTime.now());
        
        int consecutiveFailures = budget.getConsecutiveFailures();
        long backoffMs = calculateBackoff(budget, consecutiveFailures);
        
        boolean isExhausted = budget.getRemainingBudget() <= 0;
        if (isExhausted) {
            budget.setIsExhausted(true);
            budget.setExhaustedAt(LocalDateTime.now());
            budget.setNextRecoveryAt(LocalDateTime.now().plus(Duration.ofMillis(budget.getRecoveryIntervalMs())));
            
            ExhaustionRecord exhaustionRecord = new ExhaustionRecord();
            exhaustionRecord.setBudgetId(budget.getId());
            exhaustionRecord.setCallerId(budget.getCallerId());
            exhaustionRecord.setTargetApi(budget.getTargetApi());
            exhaustionRecord.setTotalBudgetUsed(budget.getUsedBudget());
            exhaustionRecord.setConsecutiveFailuresAtExhaust(budget.getConsecutiveFailures());
            exhaustionRecord.setTriggeringFailureReason(request.getFailureReason());
            exhaustionRecord.setIsRecovered(false);
            exhaustionRecordRepository.save(exhaustionRecord);
            
            log.warn("Budget exhausted for caller: {}, target: {}", budget.getCallerId(), budget.getTargetApi());
        }
        
        retryBudgetRepository.save(budget);
        
        FailureHistory history = new FailureHistory();
        history.setBudgetId(budget.getId());
        history.setCallerId(budget.getCallerId());
        history.setTargetApi(budget.getTargetApi());
        history.setFailureType(classifiedType);
        history.setFailureReason(request.getFailureReason());
        history.setAttemptNumber(budget.getConsecutiveFailures());
        history.setBackoffMs(backoffMs);
        history.setBudgetExhausted(isExhausted);
        if (idempotentKey != null && !idempotentKey.isEmpty()) {
            history.setIdempotentKey(idempotentKey);
        } else {
            history.setIdempotentKey(UUID.randomUUID().toString().replace("-", ""));
        }
        failureHistoryRepository.save(history);
        
        return RetryCheckResponse.builder()
                .allowed(!isExhausted)
                .budgetId(budget.getId())
                .callerId(budget.getCallerId())
                .targetApi(budget.getTargetApi())
                .remainingBudget(budget.getRemainingBudget())
                .usedBudget(budget.getUsedBudget())
                .consecutiveFailures(budget.getConsecutiveFailures())
                .backoffMs(backoffMs)
                .nextRetryAt(LocalDateTime.now().plus(Duration.ofMillis(backoffMs)))
                .failureType(classifiedType)
                .isExhausted(isExhausted)
                .isIdempotentHit(false)
                .message(isExhausted ? "预算已耗尽" : "重试预算检查通过")
                .build();
    }
    
    @Transactional
    public BudgetResponse recordSuccess(String callerId, String targetApi) {
        RetryBudget budget = retryBudgetRepository.findByCallerIdAndTargetApi(callerId, targetApi)
                .orElseThrow(() -> new IllegalArgumentException("预算不存在"));
        
        budget.setConsecutiveFailures(0);
        budget.setSuccessCount(budget.getSuccessCount() + 1);
        budget.setLastSuccessAt(LocalDateTime.now());
        
        if (budget.getIsExhausted()) {
            budget.setIsExhausted(false);
            budget.setNextRecoveryAt(null);
            
            List<ExhaustionRecord> records = exhaustionRecordRepository.findByBudgetId(budget.getId());
            records.forEach(record -> {
                if (!record.getIsRecovered()) {
                    record.setIsRecovered(true);
                    record.setRecoveredAt(LocalDateTime.now());
                    exhaustionRecordRepository.save(record);
                }
            });
        }
        
        RetryBudget saved = retryBudgetRepository.save(budget);
        log.info("Success recorded for caller: {}, target: {}", callerId, targetApi);
        return convertToResponse(saved);
    }
    
    public BudgetResponse getBudget(String callerId, String targetApi) {
        RetryBudget budget = retryBudgetRepository.findByCallerIdAndTargetApi(callerId, targetApi)
                .orElseThrow(() -> new IllegalArgumentException("预算不存在"));
        return convertToResponse(budget);
    }
    
    public List<BudgetResponse> getBudgetsByCaller(String callerId) {
        return retryBudgetRepository.findByCallerId(callerId).stream()
                .map(this::convertToResponse)
                .collect(Collectors.toList());
    }
    
    public Page<FailureHistory> getFailureHistory(String callerId, String targetApi, Pageable pageable) {
        return failureHistoryRepository.findByCallerIdAndTargetApi(callerId, targetApi, pageable);
    }
    
    public List<FailureHistory> getFailureHistoryByBudgetId(Long budgetId) {
        return failureHistoryRepository.findByBudgetId(budgetId);
    }
    
    public List<ExhaustionRecord> getExhaustionRecords(String callerId, String targetApi) {
        return exhaustionRecordRepository.findByCallerIdAndTargetApi(callerId, targetApi);
    }
    
    private FailureType classifyFailure(FailureType reportedType, String failureReason) {
        if (failureReason != null) {
            String reason = failureReason.toLowerCase();
            if (reason.contains("timeout") || reason.contains("timed out")) {
                return FailureType.TIMEOUT;
            }
            if (reason.contains("network") || reason.contains("connection") || reason.contains("socket")) {
                return FailureType.NETWORK_ERROR;
            }
            if (reason.contains("rate") || reason.contains("limit") || reason.contains("throttle")) {
                return FailureType.RATE_LIMITED;
            }
            if (reason.contains("auth") || reason.contains("unauthorized") || reason.contains("forbidden")) {
                return FailureType.AUTHENTICATION_ERROR;
            }
            if (reason.contains("400") || reason.contains("404") || reason.contains("bad request")) {
                return FailureType.CLIENT_ERROR;
            }
            if (reason.contains("500") || reason.contains("502") || reason.contains("503") || reason.contains("server error")) {
                return FailureType.SERVER_ERROR;
            }
            if (reason.contains("transient") || reason.contains("temporary")) {
                return FailureType.TRANSIENT;
            }
        }
        return reportedType;
    }
    
    private boolean shouldConsumeBudget(FailureType failureType) {
        return failureType != FailureType.CLIENT_ERROR && 
               failureType != FailureType.AUTHENTICATION_ERROR;
    }
    
    private long calculateBackoff(RetryBudget budget, int attempt) {
        BackoffStrategy strategy = budget.getBackoffStrategy();
        long initial = budget.getInitialBackoffMs();
        long max = budget.getMaxBackoffMs();
        double multiplier = budget.getBackoffMultiplier();
        
        long backoff;
        switch (strategy) {
            case FIXED:
                backoff = initial;
                break;
            case LINEAR:
                backoff = (long) (initial * attempt);
                break;
            case EXPONENTIAL:
                backoff = (long) (initial * Math.pow(multiplier, attempt - 1));
                break;
            case FIBONACCI:
                backoff = (long) (initial * fibonacci(attempt));
                break;
            default:
                backoff = initial;
        }
        return Math.min(backoff, max);
    }
    
    private int fibonacci(int n) {
        if (n <= 1) return 1;
        int a = 1, b = 1;
        for (int i = 2; i <= n; i++) {
            int temp = a + b;
            a = b;
            b = temp;
        }
        return b;
    }
    
    private void checkAndProcessRecovery(RetryBudget budget) {
        if (budget.getIsExhausted() && budget.getNextRecoveryAt() != null) {
            if (LocalDateTime.now().isAfter(budget.getNextRecoveryAt())) {
                int recoveryAmount = (int) (budget.getTotalBudget() * 0.1);
                recoveryAmount = Math.max(recoveryAmount, 1);
                
                budget.setRemainingBudget(budget.getRemainingBudget() + recoveryAmount);
                budget.setIsExhausted(false);
                budget.setNextRecoveryAt(null);
                
                List<ExhaustionRecord> records = exhaustionRecordRepository.findByBudgetId(budget.getId());
                records.forEach(record -> {
                    if (!record.getIsRecovered()) {
                        record.setIsRecovered(true);
                        record.setRecoveredAt(LocalDateTime.now());
                        exhaustionRecordRepository.save(record);
                    }
                });
                
                log.info("Budget recovered for caller: {}, target: {}, recovered amount: {}", 
                        budget.getCallerId(), budget.getTargetApi(), recoveryAmount);
            }
        }
    }
    
    @Scheduled(fixedRate = 60000)
    @Transactional
    public void scheduledRecovery() {
        List<RetryBudget> recoverable = retryBudgetRepository.findRecoverableBudgets(LocalDateTime.now());
        for (RetryBudget budget : recoverable) {
            checkAndProcessRecovery(budget);
            retryBudgetRepository.save(budget);
        }
        if (!recoverable.isEmpty()) {
            log.info("Scheduled recovery processed {} budgets", recoverable.size());
        }
    }
    
    private BudgetResponse convertToResponse(RetryBudget budget) {
        return BudgetResponse.builder()
                .id(budget.getId())
                .callerId(budget.getCallerId())
                .targetApi(budget.getTargetApi())
                .totalBudget(budget.getTotalBudget())
                .remainingBudget(budget.getRemainingBudget())
                .usedBudget(budget.getUsedBudget())
                .failedCount(budget.getFailedCount())
                .consecutiveFailures(budget.getConsecutiveFailures())
                .successCount(budget.getSuccessCount())
                .backoffStrategy(budget.getBackoffStrategy())
                .initialBackoffMs(budget.getInitialBackoffMs())
                .maxBackoffMs(budget.getMaxBackoffMs())
                .backoffMultiplier(budget.getBackoffMultiplier())
                .isExhausted(budget.getIsExhausted())
                .exhaustedAt(budget.getExhaustedAt())
                .lastFailureAt(budget.getLastFailureAt())
                .lastSuccessAt(budget.getLastSuccessAt())
                .recoveryIntervalMs(budget.getRecoveryIntervalMs())
                .nextRecoveryAt(budget.getNextRecoveryAt())
                .createdAt(budget.getCreatedAt())
                .updatedAt(budget.getUpdatedAt())
                .build();
    }
}
