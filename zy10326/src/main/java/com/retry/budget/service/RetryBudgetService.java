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
        boolean consumeBudget = shouldConsumeBudget(classifiedType);
        
        boolean wasExhausted = budget.getIsExhausted();
        int consecutiveFailures = budget.getConsecutiveFailures();
        long backoffMs;
        boolean isExhausted;
        boolean budgetConsumed = false;
        
        if (!consumeBudget) {
            backoffMs = calculateBackoff(budget, consecutiveFailures);
            isExhausted = wasExhausted;
        } else if (wasExhausted) {
            backoffMs = budget.getMaxBackoffMs();
            isExhausted = true;
        } else {
            budget.setUsedBudget(budget.getUsedBudget() + 1);
            budget.setRemainingBudget(budget.getTotalBudget() - budget.getUsedBudget());
            budget.setFailedCount(budget.getFailedCount() + 1);
            budget.setConsecutiveFailures(budget.getConsecutiveFailures() + 1);
            budget.setLastFailureAt(LocalDateTime.now());
            budgetConsumed = true;
            
            consecutiveFailures = budget.getConsecutiveFailures();
            backoffMs = calculateBackoff(budget, consecutiveFailures);
            
            isExhausted = budget.getRemainingBudget() <= 0;
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
        }
        
        String finalIdempotentKey = (idempotentKey != null && !idempotentKey.isEmpty()) 
                ? idempotentKey 
                : UUID.randomUUID().toString().replace("-", "");
        
        FailureHistory history = new FailureHistory();
        history.setBudgetId(budget.getId());
        history.setCallerId(budget.getCallerId());
        history.setTargetApi(budget.getTargetApi());
        history.setFailureType(classifiedType);
        history.setFailureReason(request.getFailureReason());
        history.setAttemptNumber(consecutiveFailures);
        history.setBackoffMs(backoffMs);
        history.setBudgetExhausted(isExhausted);
        history.setIdempotentKey(finalIdempotentKey);
        history.setBudgetConsumed(budgetConsumed);
        failureHistoryRepository.save(history);
        
        String message;
        if (!consumeBudget) {
            message = "非消耗性失败，不扣除预算";
        } else if (wasExhausted) {
            message = "预算已耗尽，请等待恢复或联系管理员";
        } else if (isExhausted) {
            message = "本次重试耗尽预算，请等待恢复";
        } else {
            message = "重试预算检查通过";
        }
        
        LocalDateTime nextRetryAt = isExhausted && budget.getNextRecoveryAt() != null 
                ? budget.getNextRecoveryAt() 
                : LocalDateTime.now().plus(Duration.ofMillis(backoffMs));
        
        return RetryCheckResponse.builder()
                .allowed(!isExhausted)
                .budgetId(budget.getId())
                .callerId(budget.getCallerId())
                .targetApi(budget.getTargetApi())
                .remainingBudget(budget.getRemainingBudget())
                .usedBudget(budget.getUsedBudget())
                .consecutiveFailures(budget.getConsecutiveFailures())
                .backoffMs(backoffMs)
                .nextRetryAt(nextRetryAt)
                .failureType(classifiedType)
                .isExhausted(isExhausted)
                .isIdempotentHit(false)
                .message(message)
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
    
    public String exportFailureHistoryAsCsv(String callerId, String targetApi) {
        List<FailureHistory> histories = failureHistoryRepository.findByCallerIdAndTargetApi(callerId, targetApi);
        
        StringBuilder csv = new StringBuilder();
        csv.append("id,budgetId,callerId,targetApi,failureType,failureReason,attemptNumber,backoffMs,budgetExhausted,budgetConsumed,idempotentKey,createdAt\n");
        
        for (FailureHistory h : histories) {
            csv.append(h.getId()).append(",");
            csv.append(h.getBudgetId()).append(",");
            csv.append(escapeCsv(h.getCallerId())).append(",");
            csv.append(escapeCsv(h.getTargetApi())).append(",");
            csv.append(h.getFailureType()).append(",");
            csv.append(escapeCsv(h.getFailureReason())).append(",");
            csv.append(h.getAttemptNumber()).append(",");
            csv.append(h.getBackoffMs()).append(",");
            csv.append(h.getBudgetExhausted()).append(",");
            csv.append(h.getBudgetConsumed()).append(",");
            csv.append(escapeCsv(h.getIdempotentKey())).append(",");
            csv.append(h.getCreatedAt()).append("\n");
        }
        
        return csv.toString();
    }
    
    public String exportAllAsJson(String callerId, String targetApi) {
        RetryBudget budget = retryBudgetRepository.findByCallerIdAndTargetApi(callerId, targetApi).orElse(null);
        List<FailureHistory> histories = failureHistoryRepository.findByCallerIdAndTargetApi(callerId, targetApi);
        List<ExhaustionRecord> exhaustionRecords = exhaustionRecordRepository.findByCallerIdAndTargetApi(callerId, targetApi);
        
        StringBuilder json = new StringBuilder();
        json.append("{\n");
        
        if (budget != null) {
            json.append("  \"budget\": {\n");
            json.append("    \"id\": ").append(budget.getId()).append(",\n");
            json.append("    \"callerId\": \"").append(budget.getCallerId()).append("\",\n");
            json.append("    \"targetApi\": \"").append(budget.getTargetApi()).append("\",\n");
            json.append("    \"totalBudget\": ").append(budget.getTotalBudget()).append(",\n");
            json.append("    \"remainingBudget\": ").append(budget.getRemainingBudget()).append(",\n");
            json.append("    \"usedBudget\": ").append(budget.getUsedBudget()).append(",\n");
            json.append("    \"failedCount\": ").append(budget.getFailedCount()).append(",\n");
            json.append("    \"consecutiveFailures\": ").append(budget.getConsecutiveFailures()).append(",\n");
            json.append("    \"successCount\": ").append(budget.getSuccessCount()).append(",\n");
            json.append("    \"isExhausted\": ").append(budget.getIsExhausted()).append(",\n");
            json.append("    \"createdAt\": \"").append(budget.getCreatedAt()).append("\"\n");
            json.append("  },\n");
        }
        
        json.append("  \"failureHistory\": [\n");
        for (int i = 0; i < histories.size(); i++) {
            FailureHistory h = histories.get(i);
            json.append("    {\n");
            json.append("      \"id\": ").append(h.getId()).append(",\n");
            json.append("      \"failureType\": \"").append(h.getFailureType()).append("\",\n");
            json.append("      \"failureReason\": \"").append(escapeJson(h.getFailureReason())).append("\",\n");
            json.append("      \"attemptNumber\": ").append(h.getAttemptNumber()).append(",\n");
            json.append("      \"backoffMs\": ").append(h.getBackoffMs()).append(",\n");
            json.append("      \"budgetExhausted\": ").append(h.getBudgetExhausted()).append(",\n");
            json.append("      \"budgetConsumed\": ").append(h.getBudgetConsumed()).append(",\n");
            json.append("      \"idempotentKey\": \"").append(h.getIdempotentKey()).append("\",\n");
            json.append("      \"createdAt\": \"").append(h.getCreatedAt()).append("\"\n");
            json.append("    }").append(i < histories.size() - 1 ? "," : "").append("\n");
        }
        json.append("  ],\n");
        
        json.append("  \"exhaustionRecords\": [\n");
        for (int i = 0; i < exhaustionRecords.size(); i++) {
            ExhaustionRecord r = exhaustionRecords.get(i);
            json.append("    {\n");
            json.append("      \"id\": ").append(r.getId()).append(",\n");
            json.append("      \"totalBudgetUsed\": ").append(r.getTotalBudgetUsed()).append(",\n");
            json.append("      \"consecutiveFailuresAtExhaust\": ").append(r.getConsecutiveFailuresAtExhaust()).append(",\n");
            json.append("      \"triggeringFailureReason\": \"").append(escapeJson(r.getTriggeringFailureReason())).append("\",\n");
            json.append("      \"isRecovered\": ").append(r.getIsRecovered()).append(",\n");
            json.append("      \"createdAt\": \"").append(r.getCreatedAt()).append("\"\n");
            json.append("    }").append(i < exhaustionRecords.size() - 1 ? "," : "").append("\n");
        }
        json.append("  ]\n");
        json.append("}\n");
        
        return json.toString();
    }
    
    private String escapeCsv(String value) {
        if (value == null) return "";
        if (value.contains(",") || value.contains("\"") || value.contains("\n")) {
            return "\"" + value.replace("\"", "\"\"") + "\"";
        }
        return value;
    }
    
    private String escapeJson(String value) {
        if (value == null) return "";
        return value.replace("\"", "\\\"").replace("\n", "\\n").replace("\r", "\\r");
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
