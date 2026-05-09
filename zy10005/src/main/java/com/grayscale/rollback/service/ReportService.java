package com.grayscale.rollback.service;

import com.grayscale.rollback.entity.OperationLog;
import com.grayscale.rollback.entity.Release;
import com.grayscale.rollback.enums.OperationType;
import com.grayscale.rollback.enums.ReleaseStatus;
import com.grayscale.rollback.repository.OperationLogRepository;
import com.grayscale.rollback.repository.ReleaseRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Service
@Slf4j
public class ReportService {
    
    private final ReleaseRepository releaseRepository;
    private final OperationLogRepository logRepository;
    private final OperationLogService logService;
    
    public ReportService(ReleaseRepository releaseRepository,
                        OperationLogRepository logRepository,
                        OperationLogService logService) {
        this.releaseRepository = releaseRepository;
        this.logRepository = logRepository;
        this.logService = logService;
    }
    
    public String generateReleaseReport(String releaseId) {
        Optional<Release> releaseOpt = releaseRepository.findById(releaseId);
        if (releaseOpt.isEmpty()) {
            return "# Error\n\nRelease not found: " + releaseId;
        }
        
        Release release = releaseOpt.get();
        List<OperationLog> logs = logService.getLogsForRelease(releaseId);
        
        StringBuilder report = new StringBuilder();
        
        report.append("# 灰度发布回滚报告\n\n");
        report.append("**生成时间**: ").append(LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME)).append("\n\n");
        
        report.append("## 1. 发布基本信息\n\n");
        report.append("| 字段 | 值 |\n");
        report.append("|------|-----|\n");
        report.append("| 发布ID | ").append(release.getId()).append(" |\n");
        report.append("| 服务名称 | ").append(release.getServiceName()).append(" |\n");
        report.append("| 当前版本 | ").append(release.getCurrentVersion()).append(" |\n");
        report.append("| 目标版本 | ").append(release.getTargetVersion()).append(" |\n");
        report.append("| 总实例数 | ").append(release.getTotalInstances()).append(" |\n");
        report.append("| 已更新实例 | ").append(release.getUpdatedInstances()).append(" |\n");
        report.append("| 当前状态 | ").append(release.getStatus()).append(" |\n");
        report.append("| 创建时间 | ").append(release.getCreatedAt()).append(" |\n");
        if (release.getStartedAt() != null) {
            report.append("| 开始时间 | ").append(release.getStartedAt()).append(" |\n");
        }
        if (release.getCompletedAt() != null) {
            report.append("| 完成时间 | ").append(release.getCompletedAt()).append(" |\n");
        }
        if (release.getFailedAt() != null) {
            report.append("| 失败时间 | ").append(release.getFailedAt()).append(" |\n");
        }
        report.append("\n");
        
        report.append("## 2. 状态流转历史\n\n");
        report.append("```mermaid\n");
        report.append("stateDiagram-v2\n");
        
        ReleaseStatus lastStatus = null;
        for (OperationLog logEntry : logs) {
            if (logEntry.getStatusBefore() != null && logEntry.getStatusAfter() != null) {
                if (!logEntry.getStatusBefore().equals(logEntry.getStatusAfter())) {
                    String color = logEntry.getSuccess() ? "" : ":::red";
                    report.append("    ").append(logEntry.getStatusBefore())
                          .append(" --> ").append(logEntry.getStatusAfter())
                          .append(" : ").append(logEntry.getOperationType()).append(color).append("\n");
                    lastStatus = logEntry.getStatusAfter();
                }
            }
        }
        report.append("```\n\n");
        
        report.append("## 3. 操作日志\n\n");
        report.append("| 时间 | 操作类型 | 状态变更 | 结果 | 耗时(ms) |\n");
        report.append("|------|----------|----------|------|----------|\n");
        
        for (OperationLog logEntry : logs) {
            String statusChange = "-";
            if (logEntry.getStatusBefore() != null && logEntry.getStatusAfter() != null) {
                statusChange = logEntry.getStatusBefore() + " → " + logEntry.getStatusAfter();
            }
            String result = logEntry.getSuccess() ? "✅ 成功" : "❌ 失败";
            String duration = logEntry.getDurationMs() != null ? String.valueOf(logEntry.getDurationMs()) : "-";
            report.append("| ").append(logEntry.getCreatedAt()).append(" | ")
                  .append(logEntry.getOperationType()).append(" | ")
                  .append(statusChange).append(" | ")
                  .append(result).append(" | ")
                  .append(duration).append(" |\n");
        }
        report.append("\n");
        
        List<OperationLog> failedLogs = logs.stream()
            .filter(l -> !l.getSuccess())
            .collect(Collectors.toList());
        
        if (!failedLogs.isEmpty()) {
            report.append("## 4. 错误详情\n\n");
            for (OperationLog failedLog : failedLogs) {
                report.append("### ").append(failedLog.getOperationType()).append(" 失败\n\n");
                report.append("- **时间**: ").append(failedLog.getCreatedAt()).append("\n");
                report.append("- **日志ID**: ").append(failedLog.getId()).append("\n");
                if (failedLog.getErrorMessage() != null) {
                    report.append("- **错误信息**: ").append(failedLog.getErrorMessage()).append("\n");
                }
                if (failedLog.getRequestDetails() != null) {
                    report.append("- **请求详情**: ").append(failedLog.getRequestDetails()).append("\n");
                }
                report.append("\n");
            }
        }
        
        if (release.getStatus() == ReleaseStatus.ROLLED_BACK || release.getStatus() == ReleaseStatus.FAILED) {
            report.append("## 5. 回滚分析\n\n");
            long totalOps = logs.size();
            long successOps = logs.stream().filter(OperationLog::getSuccess).count();
            long failedOps = totalOps - successOps;
            
            report.append("- 总操作数: ").append(totalOps).append("\n");
            report.append("- 成功操作: ").append(successOps).append("\n");
            report.append("- 失败操作: ").append(failedOps).append("\n");
            report.append("- 成功率: ").append(String.format("%.2f%%", totalOps > 0 ? (successOps * 100.0 / totalOps) : 0)).append("\n");
            report.append("\n");
            
            if (release.getErrorMessage() != null) {
                report.append("**最终错误**: ").append(release.getErrorMessage()).append("\n\n");
            }
        }
        
        if (!failedLogs.isEmpty()) {
            report.append("## 6. 恢复建议\n\n");
            report.append("以下失败操作可以尝试重放:\n\n");
            for (OperationLog failedLog : failedLogs) {
                report.append("- `POST /api/releases/").append(releaseId).append("/replay/")
                      .append(failedLog.getId()).append("`\n");
                report.append("  - 操作类型: ").append(failedLog.getOperationType()).append("\n");
            }
            report.append("\n");
        }
        
        return report.toString();
    }
    
    public String generateSystemReport(LocalDateTime startTime, LocalDateTime endTime) {
        List<Release> allReleases = releaseRepository.findAll();
        
        List<Release> releasesInRange = allReleases.stream()
            .filter(r -> !r.getCreatedAt().isBefore(startTime) && !r.getCreatedAt().isAfter(endTime))
            .collect(Collectors.toList());
        
        Map<ReleaseStatus, Long> statusCounts = releasesInRange.stream()
            .collect(Collectors.groupingBy(Release::getStatus, Collectors.counting()));
        
        StringBuilder report = new StringBuilder();
        
        report.append("# 系统概览报告\n\n");
        report.append("**时间范围**: ").append(startTime).append(" 至 ").append(endTime).append("\n\n");
        
        report.append("## 1. 发布统计\n\n");
        report.append("- 总发布数: ").append(releasesInRange.size()).append("\n");
        report.append("- 成功发布: ").append(statusCounts.getOrDefault(ReleaseStatus.COMPLETED, 0L)).append("\n");
        report.append("- 已回滚: ").append(statusCounts.getOrDefault(ReleaseStatus.ROLLED_BACK, 0L)).append("\n");
        report.append("- 失败: ").append(statusCounts.getOrDefault(ReleaseStatus.FAILED, 0L)).append("\n");
        report.append("\n");
        
        List<Release> activeReleases = releasesInRange.stream()
            .filter(r -> r.getStatus() != ReleaseStatus.COMPLETED && 
                        r.getStatus() != ReleaseStatus.ROLLED_BACK && 
                        r.getStatus() != ReleaseStatus.FAILED)
            .collect(Collectors.toList());
        
        if (!activeReleases.isEmpty()) {
            report.append("## 2. 进行中的发布\n\n");
            report.append("| 发布ID | 服务 | 状态 | 创建时间 |\n");
            report.append("|--------|------|------|----------|\n");
            for (Release release : activeReleases) {
                report.append("| ").append(release.getId()).append(" | ")
                      .append(release.getServiceName()).append(" | ")
                      .append(release.getStatus()).append(" | ")
                      .append(release.getCreatedAt()).append(" |\n");
            }
            report.append("\n");
        }
        
        List<Release> problemReleases = releasesInRange.stream()
            .filter(r -> r.getStatus() == ReleaseStatus.FAILED || r.getStatus() == ReleaseStatus.ROLLBACKING)
            .collect(Collectors.toList());
        
        if (!problemReleases.isEmpty()) {
            report.append("## 3. 需要关注的发布\n\n");
            for (Release release : problemReleases) {
                report.append("### ").append(release.getServiceName()).append(" (").append(release.getId()).append(")\n\n");
                report.append("- 状态: ").append(release.getStatus()).append("\n");
                if (release.getErrorMessage() != null) {
                    report.append("- 错误: ").append(release.getErrorMessage()).append("\n");
                }
                report.append("\n");
            }
        }
        
        return report.toString();
    }
}
