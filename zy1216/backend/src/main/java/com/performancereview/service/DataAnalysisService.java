package com.performancereview.service;

import com.performancereview.entity.*;
import com.performancereview.enums.BottleneckSeverity;
import com.performancereview.enums.PerformanceMetricType;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;
import java.util.stream.Stream;

@Service
@Slf4j
public class DataAnalysisService {

    public void analyzeIncident(Incident incident) {
        log.info("开始分析事故: {}", incident.getTitle());

        // 构建时间线
        buildTimeline(incident);

        // 排序瓶颈
        sortBottlenecks(incident);

        // 提取证据片段
        extractEvidenceFragments(incident);

        // 计算整体严重程度
        calculateOverallSeverity(incident);

        log.info("事故分析完成: {}", incident.getTitle());
    }

    private void buildTimeline(Incident incident) {
        log.info("构建时间线...");

        List<TimelineEvent> timeline = new ArrayList<>();

        // 添加所有类型的时间线事件
        for (CpuHotSpot item : incident.getCpuHotSpots()) {
            timeline.add(new TimelineEvent(
                    item.getTimestamp(),
                    PerformanceMetricType.CPU_HOTSPOT,
                    item.getId(),
                    "CPU 热点: " + item.getMethodName(),
                    item.getSeverity()
            ));
        }

        for (HeapGrowth item : incident.getHeapGrowths()) {
            timeline.add(new TimelineEvent(
                    item.getTimestamp(),
                    PerformanceMetricType.HEAP_GROWTH,
                    item.getId(),
                    "堆增长: " + formatBytes(item.getHeapUsedBytes()),
                    item.getSeverity()
            ));
        }

        for (GcPause item : incident.getGcPauses()) {
            timeline.add(new TimelineEvent(
                    item.getTimestamp(),
                    PerformanceMetricType.GC_PAUSE,
                    item.getId(),
                    "GC 暂停: " + item.getPauseDurationMs() + "ms",
                    item.getSeverity()
            ));
        }

        for (LockWaitChain item : incident.getLockWaitChains()) {
            timeline.add(new TimelineEvent(
                    item.getTimestamp(),
                    PerformanceMetricType.LOCK_WAIT,
                    item.getId(),
                    "锁等待: " + item.getLockName() + " (" + item.getWaitingThreadName() + ")",
                    item.getSeverity()
            ));
        }

        for (IoBlock item : incident.getIoBlocks()) {
            timeline.add(new TimelineEvent(
                    item.getTimestamp(),
                    PerformanceMetricType.IO_BLOCK,
                    item.getId(),
                    "I/O 阻塞: " + item.getResourcePath() + " (" + item.getBlockDurationMs() + "ms)",
                    item.getSeverity()
            ));
        }

        for (NetworkRtt item : incident.getNetworkRtts()) {
            timeline.add(new TimelineEvent(
                    item.getTimestamp(),
                    PerformanceMetricType.NETWORK_RTT,
                    item.getId(),
                    "网络延迟: " + item.getDestinationAddress() + " (" + item.getRttMs() + "ms)",
                    item.getSeverity()
            ));
        }

        for (SlowRequest item : incident.getSlowRequests()) {
            timeline.add(new TimelineEvent(
                    item.getTimestamp(),
                    PerformanceMetricType.SLOW_REQUEST,
                    item.getId(),
                    "慢请求: " + item.getHttpMethod() + " " + item.getUri() + " (" + item.getTotalDurationMs() + "ms)",
                    item.getSeverity()
            ));
        }

        // 按时间排序
        timeline.sort(Comparator.comparing(TimelineEvent::getTimestamp));

        log.info("时间线构建完成，共 {} 个事件", timeline.size());
    }

    private void sortBottlenecks(Incident incident) {
        log.info("排序瓶颈...");

        List<BottleneckInfo> bottlenecks = new ArrayList<>();

        // 收集所有瓶颈
        for (CpuHotSpot item : incident.getCpuHotSpots()) {
            bottlenecks.add(new BottleneckInfo(
                    PerformanceMetricType.CPU_HOTSPOT,
                    item.getId(),
                    item.getSeverity(),
                    calculateCpuScore(item),
                    item.getMethodName()
            ));
        }

        for (HeapGrowth item : incident.getHeapGrowths()) {
            bottlenecks.add(new BottleneckInfo(
                    PerformanceMetricType.HEAP_GROWTH,
                    item.getId(),
                    item.getSeverity(),
                    calculateHeapScore(item),
                    formatBytes(item.getHeapUsedBytes())
            ));
        }

        for (GcPause item : incident.getGcPauses()) {
            bottlenecks.add(new BottleneckInfo(
                    PerformanceMetricType.GC_PAUSE,
                    item.getId(),
                    item.getSeverity(),
                    calculateGcScore(item),
                    item.getPauseDurationMs() + "ms"
            ));
        }

        for (LockWaitChain item : incident.getLockWaitChains()) {
            bottlenecks.add(new BottleneckInfo(
                    PerformanceMetricType.LOCK_WAIT,
                    item.getId(),
                    item.getSeverity(),
                    calculateLockScore(item),
                    item.getLockName()
            ));
        }

        for (IoBlock item : incident.getIoBlocks()) {
            bottlenecks.add(new BottleneckInfo(
                    PerformanceMetricType.IO_BLOCK,
                    item.getId(),
                    item.getSeverity(),
                    calculateIoScore(item),
                    item.getResourcePath()
            ));
        }

        for (NetworkRtt item : incident.getNetworkRtts()) {
            bottlenecks.add(new BottleneckInfo(
                    PerformanceMetricType.NETWORK_RTT,
                    item.getId(),
                    item.getSeverity(),
                    calculateNetworkScore(item),
                    item.getDestinationAddress()
            ));
        }

        for (SlowRequest item : incident.getSlowRequests()) {
            bottlenecks.add(new BottleneckInfo(
                    PerformanceMetricType.SLOW_REQUEST,
                    item.getId(),
                    item.getSeverity(),
                    calculateSlowRequestScore(item),
                    item.getHttpMethod() + " " + item.getUri()
            ));
        }

        // 按严重程度和分数排序
        bottlenecks.sort((a, b) -> {
            int severityCompare = b.getSeverity().compareTo(a.getSeverity());
            if (severityCompare != 0) {
                return severityCompare;
            }
            return Double.compare(b.getScore(), a.getScore());
        });

        log.info("瓶颈排序完成，共 {} 个瓶颈，前 3 个: {}", 
                bottlenecks.size(), 
                bottlenecks.subList(0, Math.min(3, bottlenecks.size())));
    }

    private void extractEvidenceFragments(Incident incident) {
        log.info("提取证据片段...");

        // 从各种性能指标中提取关键证据片段
        Set<String> existingFragments = new HashSet<>();

        // 收集所有已存在的证据片段，避免重复
        for (EvidenceFragment fragment : incident.getEvidenceFragments()) {
            existingFragments.add(fragment.getFragmentContent());
        }

        // 从 CPU 热点提取
        for (CpuHotSpot item : incident.getCpuHotSpots()) {
            if (item.getSeverity() == BottleneckSeverity.CRITICAL || 
                item.getSeverity() == BottleneckSeverity.HIGH) {
                if (item.getEvidenceSnippet() != null && !existingFragments.contains(item.getEvidenceSnippet())) {
                    EvidenceFragment fragment = new EvidenceFragment();
                    fragment.setTimestamp(item.getTimestamp());
                    fragment.setMetricType(PerformanceMetricType.CPU_HOTSPOT);
                    fragment.setMetricId(item.getId());
                    fragment.setFragmentTitle("CPU 热点: " + item.getMethodName());
                    fragment.setFragmentContent(item.getEvidenceSnippet());
                    fragment.setIsKeyEvidence(true);
                    fragment.setIncident(incident);
                    incident.getEvidenceFragments().add(fragment);
                    existingFragments.add(item.getEvidenceSnippet());
                }
            }
        }

        // 从 GC 暂停提取
        for (GcPause item : incident.getGcPauses()) {
            if (item.getSeverity() == BottleneckSeverity.CRITICAL || 
                item.getSeverity() == BottleneckSeverity.HIGH) {
                if (item.getEvidenceSnippet() != null && !existingFragments.contains(item.getEvidenceSnippet())) {
                    EvidenceFragment fragment = new EvidenceFragment();
                    fragment.setTimestamp(item.getTimestamp());
                    fragment.setMetricType(PerformanceMetricType.GC_PAUSE);
                    fragment.setMetricId(item.getId());
                    fragment.setFragmentTitle("GC 暂停: " + item.getPauseDurationMs() + "ms");
                    fragment.setFragmentContent(item.getEvidenceSnippet());
                    fragment.setIsKeyEvidence(Boolean.TRUE.equals(item.getConcurrentMarkFail()) || 
                                            Boolean.TRUE.equals(item.getToSpaceExhausted()));
                    fragment.setIncident(incident);
                    incident.getEvidenceFragments().add(fragment);
                    existingFragments.add(item.getEvidenceSnippet());
                }
            }
        }

        // 从锁等待提取
        for (LockWaitChain item : incident.getLockWaitChains()) {
            if (item.getSeverity() == BottleneckSeverity.CRITICAL || 
                item.getSeverity() == BottleneckSeverity.HIGH) {
                if (item.getEvidenceSnippet() != null && !existingFragments.contains(item.getEvidenceSnippet())) {
                    EvidenceFragment fragment = new EvidenceFragment();
                    fragment.setTimestamp(item.getTimestamp());
                    fragment.setMetricType(PerformanceMetricType.LOCK_WAIT);
                    fragment.setMetricId(item.getId());
                    fragment.setFragmentTitle("锁等待: " + item.getLockName());
                    fragment.setFragmentContent(item.getEvidenceSnippet());
                    fragment.setIsKeyEvidence(Boolean.TRUE.equals(item.getDeadlockDetected()));
                    fragment.setIncident(incident);
                    incident.getEvidenceFragments().add(fragment);
                    existingFragments.add(item.getEvidenceSnippet());
                }
            }
        }

        log.info("证据片段提取完成，共 {} 个关键证据", incident.getEvidenceFragments().size());
    }

    private void calculateOverallSeverity(Incident incident) {
        log.info("计算整体严重程度...");

        // 收集所有严重程度
        List<BottleneckSeverity> allSeverities = new ArrayList<>();

        allSeverities.addAll(incident.getCpuHotSpots().stream()
                .map(CpuHotSpot::getSeverity).collect(Collectors.toList()));
        allSeverities.addAll(incident.getHeapGrowths().stream()
                .map(HeapGrowth::getSeverity).collect(Collectors.toList()));
        allSeverities.addAll(incident.getGcPauses().stream()
                .map(GcPause::getSeverity).collect(Collectors.toList()));
        allSeverities.addAll(incident.getLockWaitChains().stream()
                .map(LockWaitChain::getSeverity).collect(Collectors.toList()));
        allSeverities.addAll(incident.getIoBlocks().stream()
                .map(IoBlock::getSeverity).collect(Collectors.toList()));
        allSeverities.addAll(incident.getNetworkRtts().stream()
                .map(NetworkRtt::getSeverity).collect(Collectors.toList()));
        allSeverities.addAll(incident.getSlowRequests().stream()
                .map(SlowRequest::getSeverity).collect(Collectors.toList()));

        if (allSeverities.isEmpty()) {
            incident.setSeverity("INFO");
            return;
        }

        // 找出最高严重程度
        BottleneckSeverity maxSeverity = Collections.max(allSeverities);

        // 统计各严重程度的数量
        long criticalCount = allSeverities.stream().filter(s -> s == BottleneckSeverity.CRITICAL).count();
        long highCount = allSeverities.stream().filter(s -> s == BottleneckSeverity.HIGH).count();

        // 根据数量调整整体严重程度
        if (criticalCount > 2 || (criticalCount > 0 && highCount > 3)) {
            incident.setSeverity("CRITICAL");
        } else if (criticalCount > 0 || highCount > 2) {
            incident.setSeverity("HIGH");
        } else if (highCount > 0) {
            incident.setSeverity("MEDIUM");
        } else {
            incident.setSeverity("LOW");
        }

        log.info("整体严重程度计算完成: {}", incident.getSeverity());
    }

    private double calculateCpuScore(CpuHotSpot item) {
        double score = 0;
        if (item.getCpuUsagePercent() != null) {
            score += item.getCpuUsagePercent();
        }
        if (item.getSelfTimeMs() != null) {
            score += item.getSelfTimeMs() / 100.0;
        }
        return score;
    }

    private double calculateHeapScore(HeapGrowth item) {
        double score = 0;
        if (item.getHeapPercent() != null) {
            score += item.getHeapPercent();
        }
        if (item.getGrowthRateBytesPerSecond() != null) {
            score += item.getGrowthRateBytesPerSecond() / 1024.0 / 1024.0; // MB/s
        }
        return score;
    }

    private double calculateGcScore(GcPause item) {
        double score = 0;
        if (item.getPauseDurationMs() != null) {
            score += item.getPauseDurationMs();
        }
        if (Boolean.TRUE.equals(item.getConcurrentMarkFail()) || 
            Boolean.TRUE.equals(item.getToSpaceExhausted())) {
            score += 1000; // 严重的 GC 问题
        }
        return score;
    }

    private double calculateLockScore(LockWaitChain item) {
        double score = 0;
        if (item.getWaitDurationMs() != null) {
            score += item.getWaitDurationMs();
        }
        if (Boolean.TRUE.equals(item.getDeadlockDetected())) {
            score += 1000; // 死锁是严重问题
        }
        return score;
    }

    private double calculateIoScore(IoBlock item) {
        double score = 0;
        if (item.getBlockDurationMs() != null) {
            score += item.getBlockDurationMs();
        }
        if (item.getBytesTransferred() != null) {
            score += item.getBytesTransferred() / 1024.0 / 1024.0; // MB
        }
        return score;
    }

    private double calculateNetworkScore(NetworkRtt item) {
        double score = 0;
        if (item.getRttMs() != null) {
            score += item.getRttMs();
        } else if (item.getRttAvgMs() != null) {
            score += item.getRttAvgMs();
        }
        if (item.getPacketLossPercent() != null) {
            score += item.getPacketLossPercent() * 10; // 丢包是严重问题
        }
        return score;
    }

    private double calculateSlowRequestScore(SlowRequest item) {
        double score = 0;
        if (item.getTotalDurationMs() != null) {
            score += item.getTotalDurationMs();
        }
        if (item.getResponseStatus() != null && item.getResponseStatus() >= 500) {
            score += 500; // 5xx 错误
        }
        return score;
    }

    private String formatBytes(Long bytes) {
        if (bytes == null) return "0 B";
        if (bytes < 1024) return bytes + " B";
        if (bytes < 1024 * 1024) return String.format("%.2f KB", bytes / 1024.0);
        if (bytes < 1024 * 1024 * 1024) return String.format("%.2f MB", bytes / (1024.0 * 1024.0));
        return String.format("%.2f GB", bytes / (1024.0 * 1024.0 * 1024.0));
    }

    // 内部类用于时间线事件
    public static class TimelineEvent {
        private LocalDateTime timestamp;
        private PerformanceMetricType type;
        private Long entityId;
        private String description;
        private BottleneckSeverity severity;

        public TimelineEvent(LocalDateTime timestamp, PerformanceMetricType type, 
                            Long entityId, String description, BottleneckSeverity severity) {
            this.timestamp = timestamp;
            this.type = type;
            this.entityId = entityId;
            this.description = description;
            this.severity = severity;
        }

        public LocalDateTime getTimestamp() { return timestamp; }
        public PerformanceMetricType getType() { return type; }
        public Long getEntityId() { return entityId; }
        public String getDescription() { return description; }
        public BottleneckSeverity getSeverity() { return severity; }
    }

    // 内部类用于瓶颈信息
    public static class BottleneckInfo {
        private PerformanceMetricType type;
        private Long entityId;
        private BottleneckSeverity severity;
        private double score;
        private String description;

        public BottleneckInfo(PerformanceMetricType type, Long entityId, 
                             BottleneckSeverity severity, double score, String description) {
            this.type = type;
            this.entityId = entityId;
            this.severity = severity;
            this.score = score;
            this.description = description;
        }

        public PerformanceMetricType getType() { return type; }
        public Long getEntityId() { return entityId; }
        public BottleneckSeverity getSeverity() { return severity; }
        public double getScore() { return score; }
        public String getDescription() { return description; }

        @Override
        public String toString() {
            return type + "(" + severity + "): " + description;
        }
    }
}
