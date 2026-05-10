package com.grayscale.rollback.service;

import com.grayscale.rollback.entity.OperationLog;
import com.grayscale.rollback.entity.Release;
import com.grayscale.rollback.enums.OperationType;
import com.grayscale.rollback.enums.ReleaseStatus;
import com.grayscale.rollback.repository.OperationLogRepository;
import com.grayscale.rollback.repository.ReleaseRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;

@Service
@Slf4j
public class ErrorReplayService {
    
    private final OperationLogRepository logRepository;
    private final OperationLogService logService;
    private final ReleaseRepository releaseRepository;
    private final ReleaseService releaseService;
    
    public ErrorReplayService(OperationLogRepository logRepository,
                              OperationLogService logService,
                              ReleaseRepository releaseRepository,
                              ReleaseService releaseService) {
        this.logRepository = logRepository;
        this.logService = logService;
        this.releaseRepository = releaseRepository;
        this.releaseService = releaseService;
    }
    
    public List<OperationLog> getFailedOperations(String releaseId) {
        return logRepository.findFailedOperations(releaseId);
    }
    
    public OperationLog getLatestOperation(String releaseId) {
        Optional<OperationLog> latestLog = logRepository.findLatestLogByReleaseId(releaseId);
        return latestLog.orElse(null);
    }
    
    public List<OperationLog> getOperationChain(String releaseId) {
        return logRepository.findByReleaseIdOrderByCreatedAtAsc(releaseId);
    }
    
    @Transactional
    public ReplayResult replayOperation(String releaseId, Long logId, String operator) {
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
        
        log.info("=== 开始错误回放 ===");
        log.info("Release ID: {}", releaseId);
        log.info("Failed Log ID: {}", logId);
        log.info("Operation Type: {}", failedLog.getOperationType());
        log.info("Original Error: {}", failedLog.getErrorMessage());
        
        Optional<Release> currentReleaseOpt = releaseRepository.findById(releaseId);
        if (currentReleaseOpt.isEmpty()) {
            throw new IllegalArgumentException("Release not found: " + releaseId);
        }
        
        Release currentRelease = currentReleaseOpt.get();
        Release beforeStateRelease = logService.deserializeRelease(failedLog.getBeforeState());
        
        log.info("当前发布状态: {}", currentRelease.getStatus());
        log.info("日志记录的操作前状态: {}", beforeStateRelease != null ? beforeStateRelease.getStatus() : "null");
        
        boolean needsStateRestore = false;
        Release restoredRelease = null;
        
        if (beforeStateRelease != null && !currentRelease.getStatus().equals(beforeStateRelease.getStatus())) {
            log.warn("状态不一致！当前状态 {} 与失败操作记录的操作前状态 {} 不同", 
                    currentRelease.getStatus(), beforeStateRelease.getStatus());
            log.info("将先恢复到失败操作前的精确状态，再重放操作");
            needsStateRestore = true;
            
            log.info("优先使用失败日志记录的 beforeState 进行恢复（精确匹配失败操作前的状态）");
            restoredRelease = releaseService.restoreReleaseFromCheckpoint(releaseId, beforeStateRelease);
            log.info("已恢复到失败操作前状态: {}", restoredRelease.getStatus());
            
            if (restoredRelease == null || !restoredRelease.getStatus().equals(beforeStateRelease.getStatus())) {
                log.warn("使用 beforeState 恢复失败，尝试使用检查点作为备选");
                if (currentRelease.getRollbackCheckpoint() != null) {
                    Release checkpoint = releaseService.parseCheckpoint(currentRelease.getRollbackCheckpoint());
                    if (checkpoint != null) {
                        restoredRelease = releaseService.restoreReleaseFromCheckpoint(releaseId, checkpoint);
                        log.warn("已恢复到检查点状态（备选方案）: {}", restoredRelease.getStatus());
                    }
                }
            }
        }
        
        Release releaseToUse = restoredRelease != null ? restoredRelease : currentRelease;
        
        ReplayResult result = new ReplayResult();
        result.releaseId = releaseId;
        result.failedLogId = logId;
        result.originalOperationType = failedLog.getOperationType();
        result.originalError = failedLog.getErrorMessage();
        result.stateRestored = needsStateRestore;
        result.stateBeforeReplay = releaseToUse.getStatus();
        
        try {
            log.info("开始重放操作: {}", failedLog.getOperationType());
            
            Release operationResult = executeOperation(releaseId, failedLog);
            
            result.success = true;
            result.stateAfterReplay = operationResult.getStatus();
            result.durationMs = System.currentTimeMillis() - startTime;
            result.replayTime = LocalDateTime.now();
            
            logService.logSuccess(releaseId, OperationType.REPLAY_OPERATION,
                    releaseToUse, operationResult, operator,
                    String.format("Replayed failed operation %s (logId=%d), state restored: %b", 
                            failedLog.getOperationType(), logId, needsStateRestore),
                    result.durationMs);
            
            log.info("=== 回放成功 ===");
            log.info("状态变更: {} -> {}", result.stateBeforeReplay, result.stateAfterReplay);
            
            return result;
            
        } catch (Exception e) {
            result.success = false;
            result.errorMessage = e.getMessage();
            result.durationMs = System.currentTimeMillis() - startTime;
            result.replayTime = LocalDateTime.now();
            result.stateAfterReplay = currentRelease.getStatus();
            
            logService.logFailure(releaseId, OperationType.REPLAY_OPERATION,
                    releaseToUse, currentRelease, e.getMessage(), operator,
                    String.format("Failed to replay operation %s (logId=%d)", failedLog.getOperationType(), logId),
                    result.durationMs);
            
            log.error("=== 回放失败 ===");
            log.error("错误: {}", e.getMessage());
            
            throw new ReplayException(result, e);
        }
    }
    
    @Transactional
    public List<ReplayResult> replayAllFailedOperations(String releaseId, String operator) {
        List<OperationLog> failedOps = getFailedOperations(releaseId);
        List<ReplayResult> results = new ArrayList<>();
        
        log.info("准备重放 {} 个失败操作", failedOps.size());
        
        for (OperationLog failedOp : failedOps) {
            try {
                ReplayResult result = replayOperation(releaseId, failedOp.getId(), operator);
                results.add(result);
                if (!result.success) {
                    log.warn("操作 {} 回放失败，停止继续重放", failedOp.getId());
                    break;
                }
            } catch (ReplayException e) {
                results.add(e.result);
                log.error("重放链中断: {}", e.getMessage());
                break;
            } catch (Exception e) {
                log.error("未预期的重放错误: {}", e.getMessage());
            }
        }
        
        return results;
    }
    
    @Transactional
    public ReplayResult restoreToCheckpoint(String releaseId, String operator) {
        long startTime = System.currentTimeMillis();
        Optional<Release> releaseOpt = releaseRepository.findById(releaseId);
        if (releaseOpt.isEmpty()) {
            throw new IllegalArgumentException("Release not found: " + releaseId);
        }
        
        Release release = releaseOpt.get();
        ReplayResult result = new ReplayResult();
        result.releaseId = releaseId;
        result.stateBeforeReplay = release.getStatus();
        
        if (release.getRollbackCheckpoint() == null) {
            throw new IllegalStateException("No checkpoint available for this release");
        }
        
        try {
            Release checkpoint = releaseService.parseCheckpoint(release.getRollbackCheckpoint());
            if (checkpoint == null) {
                throw new IllegalStateException("Failed to parse checkpoint");
            }
            
            log.info("恢复到检查点: {}", checkpoint.getStatus());
            
            Release restored = releaseService.restoreReleaseFromCheckpoint(releaseId, checkpoint);
            
            result.success = true;
            result.stateRestored = true;
            result.stateAfterReplay = restored.getStatus();
            result.durationMs = System.currentTimeMillis() - startTime;
            result.replayTime = LocalDateTime.now();
            result.originalOperationType = OperationType.REPLAY_OPERATION;
            
            logService.logSuccess(releaseId, OperationType.REPLAY_OPERATION,
                    release, restored, operator,
                    "Restored to checkpoint state: " + checkpoint.getStatus(),
                    result.durationMs);
            
            return result;
        } catch (Exception e) {
            result.success = false;
            result.errorMessage = e.getMessage();
            result.durationMs = System.currentTimeMillis() - startTime;
            throw new ReplayException(result, e);
        }
    }
    
    private Release executeOperation(String releaseId, OperationLog failedLog) {
        return switch (failedLog.getOperationType()) {
            case START_PREPARING -> {
                Optional<Release> releaseOpt = releaseRepository.findById(releaseId);
                if (releaseOpt.isPresent() && releaseOpt.get().getStatus() == ReleaseStatus.PREPARING) {
                    log.info("发布已在 PREPARING 状态，跳过 startRelease");
                    yield releaseOpt.get();
                }
                yield releaseService.startRelease(releaseId);
            }
            case ADVANCE_CANARY -> releaseService.advanceCanary(releaseId);
            case TRIGGER_ROLLBACK -> {
                String reason = failedLog.getErrorMessage() != null ? 
                    "Replay: " + failedLog.getErrorMessage() : "Replay triggered rollback";
                yield releaseService.triggerRollback(releaseId, reason);
            }
            case EXECUTE_ROLLBACK, COMPLETE_ROLLBACK -> releaseService.executeRollback(releaseId);
            case FAIL_RELEASE -> {
                String reason = failedLog.getErrorMessage() != null ? 
                    "Replay: " + failedLog.getErrorMessage() : "Replay failed release";
                yield releaseService.failRelease(releaseId, reason);
            }
            default -> throw new IllegalStateException("Cannot replay operation type: " + failedLog.getOperationType());
        };
    }
    
    public ReplayAnalysis analyzeForReplay(String releaseId) {
        List<OperationLog> allLogs = getOperationChain(releaseId);
        List<OperationLog> failedLogs = getFailedOperations(releaseId);
        Optional<Release> releaseOpt = releaseRepository.findById(releaseId);
        
        ReplayAnalysis analysis = new ReplayAnalysis();
        analysis.releaseId = releaseId;
        analysis.totalOperations = allLogs.size();
        analysis.failedOperations = failedLogs.size();
        analysis.canReplay = !failedLogs.isEmpty();
        
        if (releaseOpt.isPresent()) {
            Release release = releaseOpt.get();
            analysis.currentStatus = release.getStatus();
            analysis.hasCheckpoint = release.getRollbackCheckpoint() != null;
            
            if (analysis.hasCheckpoint) {
                Release checkpoint = releaseService.parseCheckpoint(release.getRollbackCheckpoint());
                if (checkpoint != null) {
                    analysis.checkpointStatus = checkpoint.getStatus();
                    analysis.canRestoreToCheckpoint = 
                        !release.getStatus().equals(ReleaseStatus.COMPLETED) &&
                        !release.getStatus().equals(ReleaseStatus.ROLLED_BACK);
                }
            }
        }
        
        if (!failedLogs.isEmpty()) {
            OperationLog firstFailed = failedLogs.get(0);
            analysis.firstFailedLogId = firstFailed.getId();
            analysis.firstFailedOperation = firstFailed.getOperationType();
            analysis.firstFailedError = firstFailed.getErrorMessage();
            analysis.firstFailedTime = firstFailed.getCreatedAt();
            
            Release beforeState = logService.deserializeRelease(firstFailed.getBeforeState());
            if (beforeState != null) {
                analysis.expectedStateBeforeReplay = beforeState.getStatus();
                if (releaseOpt.isPresent()) {
                    analysis.stateMatchesExpected = 
                        releaseOpt.get().getStatus().equals(beforeState.getStatus());
                }
            }
        }
        
        return analysis;
    }
    
    public String generateReplayReport(String releaseId) {
        List<OperationLog> logs = logRepository.findByReleaseIdOrderByCreatedAtAsc(releaseId);
        ReplayAnalysis analysis = analyzeForReplay(releaseId);
        StringBuilder report = new StringBuilder();
        
        report.append("# 错误回放分析报告\n\n");
        report.append("**生成时间**: ").append(LocalDateTime.now()).append("\n\n");
        
        report.append("## 1. 发布概况\n\n");
        report.append("| 项目 | 值 |\n");
        report.append("|------|-----|\n");
        report.append("| 发布ID | ").append(analysis.releaseId).append(" |\n");
        report.append("| 当前状态 | ").append(analysis.currentStatus).append(" |\n");
        report.append("| 总操作数 | ").append(analysis.totalOperations).append(" |\n");
        report.append("| 失败操作数 | ").append(analysis.failedOperations).append(" |\n");
        report.append("| 有检查点 | ").append(analysis.hasCheckpoint ? "✅" : "❌").append(" |\n");
        if (analysis.hasCheckpoint) {
            report.append("| 检查点状态 | ").append(analysis.checkpointStatus).append(" |\n");
        }
        report.append("\n");
        
        if (analysis.canReplay) {
            report.append("## 2. 回放分析\n\n");
            report.append("- **可回放**: ").append(analysis.canReplay ? "✅ 是" : "❌ 否").append("\n");
            report.append("- **首个失败日志ID**: ").append(analysis.firstFailedLogId).append("\n");
            report.append("- **失败操作类型**: ").append(analysis.firstFailedOperation).append("\n");
            report.append("- **失败时间**: ").append(analysis.firstFailedTime).append("\n");
            report.append("- **错误信息**: ").append(analysis.firstFailedError).append("\n");
            report.append("- **期望的操作前状态**: ").append(analysis.expectedStateBeforeReplay).append("\n");
            report.append("- **当前状态是否匹配**: ").append(analysis.stateMatchesExpected ? "✅ 是" : "⚠️ 否").append("\n");
            report.append("- **可恢复到检查点**: ").append(analysis.canRestoreToCheckpoint ? "✅ 是" : "❌ 否").append("\n");
            report.append("\n");
            
            if (!analysis.stateMatchesExpected) {
                report.append("## ⚠️ 状态不一致警告\n\n");
                report.append("当前状态与失败操作期望的操作前状态不一致！\n\n");
                report.append("**回放机制**：系统会自动优先使用失败日志记录的 `beforeState` 恢复到失败操作前的精确状态，然后再重放操作。\n\n");
                report.append("如果需要手动控制，可以使用以下步骤：\n");
                report.append("1. 调用 `POST /api/releases/{id}/replay/{logId}` - 系统自动处理状态恢复\n");
                report.append("2. 或先调用 `POST /api/releases/{id}/replay/checkpoint` 恢复到检查点（备选方案）\n");
                report.append("\n");
            }
        }
        
        report.append("## 3. 操作历史\n\n");
        
        for (OperationLog logEntry : logs) {
            String icon = logEntry.getSuccess() ? "✅" : "❌";
            report.append("### ").append(icon).append(" ").append(logEntry.getOperationType()).append("\n\n");
            report.append("- **时间**: ").append(logEntry.getCreatedAt()).append("\n");
            report.append("- **结果**: ").append(logEntry.getSuccess() ? "成功" : "失败").append("\n");
            if (logEntry.getStatusBefore() != null) {
                report.append("- **状态变更**: ").append(logEntry.getStatusBefore())
                      .append(" → ").append(logEntry.getStatusAfter()).append("\n");
            }
            if (logEntry.getDurationMs() != null) {
                report.append("- **耗时**: ").append(logEntry.getDurationMs()).append("ms\n");
            }
            if (!logEntry.getSuccess() && logEntry.getErrorMessage() != null) {
                report.append("- **错误**: ").append(logEntry.getErrorMessage()).append("\n");
            }
            report.append("\n");
        }
        
        if (analysis.canReplay) {
            report.append("## 4. 回放步骤\n\n");
            report.append("### 方式一：重放单个失败操作\n\n");
            report.append("```bash\n");
            report.append("curl -X POST \"http://localhost:8080/api/releases/")
                  .append(releaseId).append("/replay/")
                  .append(analysis.firstFailedLogId).append("?operator=your-name\"\n");
            report.append("```\n\n");
            
            report.append("### 方式二：重放所有失败操作\n\n");
            report.append("```bash\n");
            report.append("curl -X POST \"http://localhost:8080/api/releases/")
                  .append(releaseId).append("/replay/all?operator=your-name\"\n");
            report.append("```\n\n");
            
            report.append("### 方式三：先恢复检查点再重放\n\n");
            report.append("```bash\n");
            report.append("# 1. 恢复到检查点\n");
            report.append("curl -X POST \"http://localhost:8080/api/releases/")
                  .append(releaseId).append("/replay/checkpoint?operator=your-name\"\n\n");
            report.append("# 2. 重放失败操作\n");
            report.append("curl -X POST \"http://localhost:8080/api/releases/")
                  .append(releaseId).append("/replay/")
                  .append(analysis.firstFailedLogId).append("?operator=your-name\"\n");
            report.append("```\n");
        }
        
        return report.toString();
    }
    
    public static class ReplayResult {
        public String releaseId;
        public Long failedLogId;
        public OperationType originalOperationType;
        public String originalError;
        public boolean success;
        public boolean stateRestored;
        public ReleaseStatus stateBeforeReplay;
        public ReleaseStatus stateAfterReplay;
        public String errorMessage;
        public Long durationMs;
        public LocalDateTime replayTime;
    }
    
    public static class ReplayAnalysis {
        public String releaseId;
        public ReleaseStatus currentStatus;
        public int totalOperations;
        public int failedOperations;
        public boolean canReplay;
        public boolean hasCheckpoint;
        public ReleaseStatus checkpointStatus;
        public boolean canRestoreToCheckpoint;
        public Long firstFailedLogId;
        public OperationType firstFailedOperation;
        public String firstFailedError;
        public LocalDateTime firstFailedTime;
        public ReleaseStatus expectedStateBeforeReplay;
        public boolean stateMatchesExpected;
    }
    
    public static class ReplayException extends RuntimeException {
        public final ReplayResult result;
        
        public ReplayException(ReplayResult result, Throwable cause) {
            super(result.errorMessage, cause);
            this.result = result;
        }
    }
}
