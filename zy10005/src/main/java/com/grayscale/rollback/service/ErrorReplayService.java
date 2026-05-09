package com.grayscale.rollback.service;

import com.grayscale.rollback.entity.OperationLog;
import com.grayscale.rollback.entity.Release;
import com.grayscale.rollback.enums.OperationType;
import com.grayscale.rollback.repository.OperationLogRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
@Slf4j
public class ErrorReplayService {
    
    private final OperationLogRepository logRepository;
    private final OperationLogService logService;
    private final ReleaseService releaseService;
    
    public ErrorReplayService(OperationLogRepository logRepository,
                              OperationLogService logService,
                              ReleaseService releaseService) {
        this.logRepository = logRepository;
        this.logService = logService;
        this.releaseService = releaseService;
    }
    
    public List<OperationLog> getFailedOperations(String releaseId) {
        return logRepository.findFailedOperations(releaseId);
    }
    
    public OperationLog getLatestOperation(String releaseId) {
        Optional<OperationLog> latestLog = logRepository.findLatestLogByReleaseId(releaseId);
        return latestLog.orElse(null);
    }
    
    @Transactional
    public Release replayOperation(String releaseId, Long logId, String operator) {
        long startTime = System.currentTimeMillis();
        Optional<OperationLog> logOpt = logRepository.findById(logId);
        if (logOpt.isEmpty()) {
            throw new IllegalArgumentException("Operation log not found: " + logId);
        }
        
        OperationLog failedLog = logOpt.get();
        if (!failedLog.getReleaseId().equals(releaseId)) {
            throw new IllegalArgumentException("Log entry does not belong to release: " + releaseId);
        }
        
        if (failedLog.getSuccess()) {
            throw new IllegalStateException("Cannot replay successful operation");
        }
        
        log.info("Replaying failed operation: releaseId={}, logId={}, operationType={}",
                releaseId, logId, failedLog.getOperationType());
        
        try {
            Release releaseBefore = logService.deserializeRelease(failedLog.getBeforeState());
            
            Release result = switch (failedLog.getOperationType()) {
                case START_PREPARING -> releaseService.startRelease(releaseId);
                case ADVANCE_CANARY -> releaseService.advanceCanary(releaseId);
                case TRIGGER_ROLLBACK -> releaseService.triggerRollback(releaseId, 
                    "Replay: " + (failedLog.getErrorMessage() != null ? failedLog.getErrorMessage() : "unknown"));
                case EXECUTE_ROLLBACK, COMPLETE_ROLLBACK -> releaseService.executeRollback(releaseId);
                case FAIL_RELEASE -> releaseService.failRelease(releaseId,
                    "Replay: " + (failedLog.getErrorMessage() != null ? failedLog.getErrorMessage() : "unknown"));
                default -> throw new IllegalStateException("Cannot replay operation type: " + failedLog.getOperationType());
            };
            
            logService.logSuccess(releaseId, OperationType.REPLAY_OPERATION,
                    releaseBefore, result, operator,
                    String.format("Replayed failed operation %s (logId=%d)", failedLog.getOperationType(), logId),
                    System.currentTimeMillis() - startTime);
            
            return result;
        } catch (Exception e) {
            logService.logFailure(releaseId, OperationType.REPLAY_OPERATION,
                    null, null, e.getMessage(), operator,
                    String.format("Failed to replay operation %s (logId=%d)", failedLog.getOperationType(), logId),
                    System.currentTimeMillis() - startTime);
            throw e;
        }
    }
    
    @Transactional
    public List<Release> replayAllFailedOperations(String releaseId, String operator) {
        List<OperationLog> failedOps = getFailedOperations(releaseId);
        List<Release> results = new ArrayList<>();
        
        for (OperationLog failedOp : failedOps) {
            try {
                Release result = replayOperation(releaseId, failedOp.getId(), operator);
                results.add(result);
            } catch (Exception e) {
                log.warn("Failed to replay operation {}: {}", failedOp.getId(), e.getMessage());
            }
        }
        
        return results;
    }
    
    public String generateReplayReport(String releaseId) {
        List<OperationLog> logs = logRepository.findByReleaseIdOrderByCreatedAtAsc(releaseId);
        StringBuilder report = new StringBuilder();
        
        report.append("# Release Replay Report\n\n");
        report.append("Release ID: ").append(releaseId).append("\n\n");
        report.append("## Operation History\n\n");
        
        for (OperationLog logEntry : logs) {
            report.append("### ").append(logEntry.getOperationType()).append("\n");
            report.append("- Time: ").append(logEntry.getCreatedAt()).append("\n");
            report.append("- Status: ").append(logEntry.getSuccess() ? "SUCCESS" : "FAILED").append("\n");
            if (logEntry.getStatusBefore() != null) {
                report.append("- State: ").append(logEntry.getStatusBefore())
                      .append(" → ").append(logEntry.getStatusAfter()).append("\n");
            }
            if (!logEntry.getSuccess() && logEntry.getErrorMessage() != null) {
                report.append("- Error: ").append(logEntry.getErrorMessage()).append("\n");
            }
            report.append("\n");
        }
        
        List<OperationLog> failedOps = getFailedOperations(releaseId);
        if (!failedOps.isEmpty()) {
            report.append("## Failed Operations for Replay\n\n");
            for (OperationLog failedOp : failedOps) {
                report.append("- Log ID: ").append(failedOp.getId()).append("\n");
                report.append("  - Type: ").append(failedOp.getOperationType()).append("\n");
                report.append("  - Error: ").append(failedOp.getErrorMessage()).append("\n\n");
            }
        }
        
        return report.toString();
    }
}
