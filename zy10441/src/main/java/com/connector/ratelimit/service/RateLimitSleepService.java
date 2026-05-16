package com.connector.ratelimit.service;

import com.connector.ratelimit.model.dto.*;
import com.connector.ratelimit.model.entity.*;
import com.connector.ratelimit.model.enums.FailureReason;
import com.connector.ratelimit.model.enums.RateLimitType;
import com.connector.ratelimit.model.enums.SleepStatus;
import com.connector.ratelimit.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class RateLimitSleepService {

    private final ConnectorRepository connectorRepository;
    private final SupplierAccountRepository supplierAccountRepository;
    private final RateLimitWindowRepository rateLimitWindowRepository;
    private final SleepStrategyRepository sleepStrategyRepository;
    private final RecoveryEventRepository recoveryEventRepository;
    private final RunSummaryRepository runSummaryRepository;
    private final ExceptionRecordRepository exceptionRecordRepository;

    public Connector createConnector(ConnectorCreateRequest request) {
        Connector connector = new Connector();
        connector.setConnectorCode(request.getConnectorCode());
        connector.setConnectorName(request.getConnectorName());
        connector.setDescription(request.getDescription());
        connector.setSupplierCode(request.getSupplierCode());
        connector.setStatus(SleepStatus.ACTIVE);
        connector.setCurrentSleepLevel(0);
        return connectorRepository.save(connector);
    }

    public Optional<Connector> getConnector(String connectorCode) {
        return connectorRepository.findByConnectorCode(connectorCode);
    }

    public List<Connector> getAllConnectors() {
        return connectorRepository.findAll();
    }

    public List<Connector> getConnectorsByStatus(SleepStatus status) {
        return connectorRepository.findByStatus(status);
    }

    @Transactional
    public ApiResponse<Connector> detectRateLimit(RateLimitDetectRequest request) {
        String connectorCode = request.getConnectorCode();
        
        if (request.getIdempotentKey() != null) {
            Optional<RecoveryEvent> existingEvent = recoveryEventRepository.findByIdempotentKey(request.getIdempotentKey());
            if (existingEvent.isPresent()) {
                log.info("幂等检查通过，跳过重复处理: {}", request.getIdempotentKey());
                Optional<Connector> connector = connectorRepository.findByConnectorCode(connectorCode);
                return connector.map(ApiResponse::success).orElseGet(() -> ApiResponse.error(404, "连接器不存在"));
            }
        }

        Optional<Connector> connectorOpt = connectorRepository.findByConnectorCode(connectorCode);
        if (connectorOpt.isEmpty()) {
            return ApiResponse.error(404, "连接器不存在");
        }

        Connector connector = connectorOpt.get();

        if (connector.getStatus() == SleepStatus.SLEEPING) {
            saveExceptionRecord(connectorCode, request, FailureReason.RATE_LIMIT_EXCEEDED, 
                    "连接器已在休眠状态，拒绝重复请求", "连接器当前处于休眠状态，需等待恢复后重试");
            return ApiResponse.error(400, "连接器当前处于休眠状态");
        }

        SleepStrategy strategy = sleepStrategyRepository.findBySleepLevel(connector.getCurrentSleepLevel() + 1)
                .orElse(sleepStrategyRepository.findBySleepLevel(1).orElse(null));
        
        if (strategy == null) {
            strategy = createDefaultStrategy();
        }

        SleepStatus oldStatus = connector.getStatus();
        connector.setStatus(SleepStatus.SLEEPING);
        connector.setCurrentSleepLevel(Math.min(connector.getCurrentSleepLevel() + 1, 5));
        connector.setSleepStartTime(LocalDateTime.now());
        connector.setExpectedWakeTime(LocalDateTime.now().plusSeconds(strategy.getSleepDurationSeconds()));
        connector.setLastError(request.getRawResponse() != null ? request.getRawResponse() : "触发限流");
        connectorRepository.save(connector);

        RateLimitWindow window = createRateLimitWindow(connectorCode, request.getLimitType());
        rateLimitWindowRepository.save(window);

        RecoveryEvent event = createRecoveryEvent(connectorCode, oldStatus, SleepStatus.SLEEPING, 
                "RATE_LIMIT_DETECT", "触发限流进入休眠", null, request.getIdempotentKey());
        recoveryEventRepository.save(event);

        saveExceptionRecord(connectorCode, request, 
                request.getFailureReason() != null ? request.getFailureReason() : FailureReason.RATE_LIMIT_EXCEEDED,
                request.getRawResponse(), "已触发休眠策略，等待" + strategy.getSleepDurationSeconds() + "秒后恢复");

        updateRunSummary(connectorCode, false, true);

        return ApiResponse.success("已触发休眠策略", connector);
    }

    @Transactional
    public ApiResponse<Connector> advanceStatus(String connectorCode) {
        Optional<Connector> connectorOpt = connectorRepository.findByConnectorCode(connectorCode);
        if (connectorOpt.isEmpty()) {
            return ApiResponse.error(404, "连接器不存在");
        }

        Connector connector = connectorOpt.get();

        if (connector.getStatus() == SleepStatus.SLEEPING) {
            if (LocalDateTime.now().isAfter(connector.getExpectedWakeTime())) {
                SleepStatus oldStatus = connector.getStatus();
                connector.setStatus(SleepStatus.RECOVERING);
                connectorRepository.save(connector);

                RecoveryEvent event = createRecoveryEvent(connectorCode, oldStatus, SleepStatus.RECOVERING,
                        "AUTO_RECOVERY", "休眠时间已到，进入恢复状态", null, null);
                recoveryEventRepository.save(event);

                return ApiResponse.success("状态已推进到恢复中", connector);
            } else {
                return ApiResponse.error(400, "休眠时间未到，无法推进状态");
            }
        }

        if (connector.getStatus() == SleepStatus.RECOVERING) {
            SleepStatus oldStatus = connector.getStatus();
            connector.setStatus(SleepStatus.RECOVERED);
            connector.setCurrentSleepLevel(0);
            connector.setSleepStartTime(null);
            connector.setExpectedWakeTime(null);
            connector.setLastError(null);
            connectorRepository.save(connector);

            RecoveryEvent event = createRecoveryEvent(connectorCode, oldStatus, SleepStatus.RECOVERED,
                    "RECOVERY_SUCCESS", "恢复成功", null, null);
            recoveryEventRepository.save(event);

            updateRunSummary(connectorCode, true, false);

            return ApiResponse.success("连接器已恢复正常", connector);
        }

        return ApiResponse.error(400, "当前状态不支持自动推进");
    }

    @Transactional
    public ApiResponse<Connector> manualCorrection(ManualCorrectionRequest request) {
        if (request.getIdempotentKey() != null) {
            Optional<RecoveryEvent> existingEvent = recoveryEventRepository.findByIdempotentKey(request.getIdempotentKey());
            if (existingEvent.isPresent()) {
                log.info("幂等检查通过，跳过重复人工修正: {}", request.getIdempotentKey());
                Optional<Connector> connector = connectorRepository.findByConnectorCode(request.getConnectorCode());
                return connector.map(ApiResponse::success).orElseGet(() -> ApiResponse.error(404, "连接器不存在"));
            }
        }

        Optional<Connector> connectorOpt = connectorRepository.findByConnectorCode(request.getConnectorCode());
        if (connectorOpt.isEmpty()) {
            return ApiResponse.error(404, "连接器不存在");
        }

        Connector connector = connectorOpt.get();
        SleepStatus oldStatus = connector.getStatus();
        connector.setStatus(request.getTargetStatus());
        
        if (request.getTargetStatus() == SleepStatus.ACTIVE || request.getTargetStatus() == SleepStatus.RECOVERED) {
            connector.setCurrentSleepLevel(0);
            connector.setSleepStartTime(null);
            connector.setExpectedWakeTime(null);
        }
        
        connectorRepository.save(connector);

        RecoveryEvent event = createRecoveryEvent(request.getConnectorCode(), oldStatus, request.getTargetStatus(),
                "MANUAL_CORRECTION", request.getReason(), request.getOperator(), request.getIdempotentKey());
        recoveryEventRepository.save(event);

        return ApiResponse.success("人工修正成功", connector);
    }

    public List<ExceptionRecord> getExceptionRecords(String connectorCode) {
        if (connectorCode != null) {
            return exceptionRecordRepository.findByConnectorCode(connectorCode);
        }
        return exceptionRecordRepository.findAll();
    }

    public List<RecoveryEvent> getRecoveryEvents(String connectorCode) {
        return recoveryEventRepository.findByConnectorCode(connectorCode);
    }

    public List<RunSummary> getRunSummaries(String connectorCode, String startDate, String endDate) {
        if (startDate != null && endDate != null) {
            return runSummaryRepository.findBySummaryDateBetween(startDate, endDate);
        }
        if (connectorCode != null) {
            return runSummaryRepository.findByConnectorCode(connectorCode);
        }
        return runSummaryRepository.findAll();
    }

    public String exportRunSummaries(String connectorCode, String startDate, String endDate) {
        List<RunSummary> summaries = getRunSummaries(connectorCode, startDate, endDate);
        StringBuilder sb = new StringBuilder();
        sb.append("连接器编码,日期,总请求,成功,失败,限流次数,休眠次数,恢复次数,总休眠秒数,失败原因\n");
        
        for (RunSummary summary : summaries) {
            sb.append(summary.getConnectorCode()).append(",")
              .append(summary.getSummaryDate()).append(",")
              .append(summary.getTotalRequests()).append(",")
              .append(summary.getSuccessCount()).append(",")
              .append(summary.getFailureCount()).append(",")
              .append(summary.getRateLimitCount()).append(",")
              .append(summary.getSleepCount()).append(",")
              .append(summary.getRecoveryCount()).append(",")
              .append(summary.getTotalSleepSeconds()).append(",")
              .append(summary.getFailureReasons()).append("\n");
        }
        
        return sb.toString();
    }

    public List<SleepStrategy> getSleepStrategies() {
        return sleepStrategyRepository.findByEnabledTrue();
    }

    public SleepStrategy createSleepStrategy(SleepStrategy strategy) {
        return sleepStrategyRepository.save(strategy);
    }

    private SleepStrategy createDefaultStrategy() {
        SleepStrategy strategy = new SleepStrategy();
        strategy.setStrategyCode("DEFAULT_LEVEL1");
        strategy.setStrategyName("默认休眠策略-级别1");
        strategy.setSleepLevel(1);
        strategy.setSleepDurationSeconds(60L);
        strategy.setBackoffType("FIXED");
        strategy.setEnabled(true);
        return sleepStrategyRepository.save(strategy);
    }

    private RateLimitWindow createRateLimitWindow(String connectorCode, RateLimitType limitType) {
        RateLimitWindow window = new RateLimitWindow();
        window.setConnectorCode(connectorCode);
        window.setLimitType(limitType != null ? limitType : RateLimitType.UNKNOWN);
        window.setLimitValue(100);
        window.setCurrentValue(101);
        window.setWindowStart(LocalDateTime.now().withMinute(0).withSecond(0).withNano(0));
        window.setWindowEnd(LocalDateTime.now().withMinute(0).withSecond(0).withNano(0).plusHours(1));
        window.setIsBreached(true);
        window.setBreachedAt(LocalDateTime.now());
        return window;
    }

    private RecoveryEvent createRecoveryEvent(String connectorCode, SleepStatus fromStatus, SleepStatus toStatus,
                                               String triggerSource, String reason, String operator, String idempotentKey) {
        RecoveryEvent event = new RecoveryEvent();
        event.setConnectorCode(connectorCode);
        event.setEventId(UUID.randomUUID().toString());
        event.setFromStatus(fromStatus);
        event.setToStatus(toStatus);
        event.setTriggerSource(triggerSource);
        event.setReason(reason);
        event.setOperator(operator);
        event.setIdempotentKey(idempotentKey);
        event.setIsIdempotent(idempotentKey != null);
        return event;
    }

    private void saveExceptionRecord(String connectorCode, RateLimitDetectRequest request, FailureReason reason,
                                     String errorMessage, String conclusion) {
        ExceptionRecord record = new ExceptionRecord();
        record.setConnectorCode(connectorCode);
        record.setRequestId(request.getRequestId());
        record.setRawInput(request.getRawResponse());
        record.setFailureReason(reason);
        record.setErrorMessage(errorMessage);
        record.setProcessingConclusion(conclusion);
        exceptionRecordRepository.save(record);
    }

    private void updateRunSummary(String connectorCode, boolean isRecovery, boolean isSleep) {
        String today = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd"));
        RunSummary summary = runSummaryRepository.findByConnectorCodeAndSummaryDate(connectorCode, today)
                .orElse(new RunSummary());
        
        if (summary.getConnectorCode() == null) {
            summary.setConnectorCode(connectorCode);
            summary.setSummaryDate(today);
            summary.setTotalRequests(0);
            summary.setSuccessCount(0);
            summary.setFailureCount(0);
            summary.setRateLimitCount(0);
            summary.setSleepCount(0);
            summary.setRecoveryCount(0);
            summary.setTotalSleepSeconds(0L);
        }
        
        summary.setTotalRequests(summary.getTotalRequests() + 1);
        if (isSleep) {
            summary.setSleepCount(summary.getSleepCount() + 1);
            summary.setRateLimitCount(summary.getRateLimitCount() + 1);
            summary.setFailureCount(summary.getFailureCount() + 1);
            summary.setTotalSleepSeconds(summary.getTotalSleepSeconds() + 60);
        }
        if (isRecovery) {
            summary.setRecoveryCount(summary.getRecoveryCount() + 1);
            summary.setSuccessCount(summary.getSuccessCount() + 1);
        }
        
        runSummaryRepository.save(summary);
    }

    public List<SupplierAccount> getSupplierAccounts() {
        return supplierAccountRepository.findAll();
    }

    public SupplierAccount createSupplierAccount(SupplierAccount account) {
        return supplierAccountRepository.save(account);
    }
}
