package com.performancereview.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.performancereview.entity.*;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Service
@Slf4j
public class ReportExportService {

    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    private final ObjectMapper objectMapper;

    public ReportExportService() {
        this.objectMapper = new ObjectMapper();
        this.objectMapper.registerModule(new JavaTimeModule());
        this.objectMapper.disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
        this.objectMapper.enable(SerializationFeature.INDENT_OUTPUT);
    }

    public String exportToMarkdown(Incident incident) {
        log.info("导出 Markdown 报告: {}", incident.getTitle());

        StringBuilder sb = new StringBuilder();

        // 标题
        sb.append("# 性能事故复盘报告\n\n");
        sb.append("## 基本信息\n\n");
        sb.append("| 项目 | 内容 |\n");
        sb.append("|------|------|\n");
        sb.append("| 标题 | ").append(escapeMarkdown(incident.getTitle())).append(" |\n");
        if (incident.getDescription() != null) {
            sb.append("| 描述 | ").append(escapeMarkdown(incident.getDescription())).append(" |\n");
        }
        if (incident.getIncidentTime() != null) {
            sb.append("| 事故时间 | ").append(incident.getIncidentTime().format(DATE_FORMATTER)).append(" |\n");
        }
        sb.append("| 状态 | ").append(incident.getStatus() != null ? incident.getStatus() : "未知").append(" |\n");
        sb.append("| 严重程度 | ").append(incident.getSeverity() != null ? incident.getSeverity() : "未知").append(" |\n");
        sb.append("\n");

        // 处置建议
        if (incident.getDispositionSuggestion() != null && !incident.getDispositionSuggestion().isEmpty()) {
            sb.append("## 处置建议\n\n");
            sb.append(incident.getDispositionSuggestion()).append("\n\n");
        }

        // 解决方案备注
        if (incident.getResolutionNotes() != null && !incident.getResolutionNotes().isEmpty()) {
            sb.append("## 解决方案\n\n");
            sb.append(incident.getResolutionNotes()).append("\n\n");
        }

        // 上传文件
        if (incident.getUploadedFiles() != null && !incident.getUploadedFiles().isEmpty()) {
            sb.append("## 上传文件\n\n");
            sb.append("| 文件名 | 类型 | 大小 | 状态 |\n");
            sb.append("|--------|------|------|------|\n");
            for (UploadedFile file : incident.getUploadedFiles()) {
                sb.append("| ")
                        .append(escapeMarkdown(file.getFileName())).append(" | ")
                        .append(file.getFileType() != null ? file.getFileType() : "未知").append(" | ")
                        .append(formatFileSize(file.getFileSize())).append(" | ")
                        .append(file.getStatus() != null ? file.getStatus() : "未知").append(" |\n");
            }
            sb.append("\n");
        }

        // CPU 热点
        if (incident.getCpuHotSpots() != null && !incident.getCpuHotSpots().isEmpty()) {
            sb.append("## CPU 热点分析\n\n");
            
            List<CpuHotSpot> sortedBySelfTime = incident.getCpuHotSpots().stream()
                    .sorted(Comparator.comparing(h -> h.getSelfTimeMs() != null ? -h.getSelfTimeMs() : 0L))
                    .limit(10)
                    .collect(Collectors.toList());
            
            sb.append("### 按 Self Time 排序的 Top 10 热点\n\n");
            sb.append("| 方法名 | 类名 | Self Time | Total Time | CPU 使用率 |\n");
            sb.append("|--------|------|-----------|------------|------------|\n");
            for (CpuHotSpot hotspot : sortedBySelfTime) {
                sb.append("| ")
                        .append(escapeMarkdown(hotspot.getMethodName() != null ? hotspot.getMethodName() : "未知")).append(" | ")
                        .append(escapeMarkdown(hotspot.getClassName() != null ? hotspot.getClassName() : "未知")).append(" | ")
                        .append(hotspot.getSelfTimeMs() != null ? hotspot.getSelfTimeMs() + "ms" : "N/A").append(" | ")
                        .append(hotspot.getTotalTimeMs() != null ? hotspot.getTotalTimeMs() + "ms" : "N/A").append(" | ")
                        .append(hotspot.getCpuUsagePercent() != null ? hotspot.getCpuUsagePercent() + "%" : "N/A").append(" |\n");
            }
            sb.append("\n");
        }

        // 堆增长
        if (incident.getHeapGrowths() != null && !incident.getHeapGrowths().isEmpty()) {
            sb.append("## 堆内存分析\n\n");
            
            List<HeapGrowth> sortedByHeapPercent = incident.getHeapGrowths().stream()
                    .sorted(Comparator.comparing(h -> h.getHeapPercent() != null ? -h.getHeapPercent() : 0.0))
                    .limit(10)
                    .collect(Collectors.toList());
            
            sb.append("### 按堆使用率排序的 Top 10\n\n");
            sb.append("| 时间 | 已用堆 | 最大堆 | 使用率 | 增长率 |\n");
            sb.append("|------|--------|--------|--------|--------|\n");
            for (HeapGrowth growth : sortedByHeapPercent) {
                sb.append("| ")
                        .append(growth.getTimestamp() != null ? growth.getTimestamp().format(DATE_FORMATTER) : "N/A").append(" | ")
                        .append(formatBytes(growth.getHeapUsedBytes())).append(" | ")
                        .append(formatBytes(growth.getHeapMaxBytes())).append(" | ")
                        .append(growth.getHeapPercent() != null ? growth.getHeapPercent() + "%" : "N/A").append(" | ")
                        .append(growth.getGrowthRateBytesPerSecond() != null ? formatBytes(growth.getGrowthRateBytesPerSecond().longValue()) + "/s" : "N/A").append(" |\n");
            }
            sb.append("\n");

            // 大对象分析
            List<HeapGrowth> withLargeObjects = incident.getHeapGrowths().stream()
                    .filter(g -> g.getObjectClassName() != null)
                    .sorted(Comparator.comparing(h -> h.getRetainedSizeBytes() != null ? -h.getRetainedSizeBytes() : 0L))
                    .limit(10)
                    .collect(Collectors.toList());
            
            if (!withLargeObjects.isEmpty()) {
                sb.append("### 大对象分析\n\n");
                sb.append("| 类名 | 实例数 | 占用大小 | Retained 大小 |\n");
                sb.append("|------|--------|----------|---------------|\n");
                for (HeapGrowth growth : withLargeObjects) {
                    sb.append("| ")
                            .append(escapeMarkdown(growth.getObjectClassName())).append(" | ")
                            .append(growth.getObjectCount() != null ? growth.getObjectCount().toString() : "N/A").append(" | ")
                            .append(formatBytes(growth.getObjectSizeBytes())).append(" | ")
                            .append(formatBytes(growth.getRetainedSizeBytes())).append(" |\n");
                }
                sb.append("\n");
            }
        }

        // GC 暂停
        if (incident.getGcPauses() != null && !incident.getGcPauses().isEmpty()) {
            sb.append("## GC 暂停分析\n\n");
            
            List<GcPause> sortedByPauseTime = incident.getGcPauses().stream()
                    .sorted(Comparator.comparing(g -> g.getPauseDurationMs() != null ? -g.getPauseDurationMs() : 0.0))
                    .limit(10)
                    .collect(Collectors.toList());
            
            sb.append("### 按暂停时间排序的 Top 10\n\n");
            sb.append("| 时间 | GC 类型 | 暂停时间 | 堆变化(前->后) | 严重程度 |\n");
            sb.append("|------|---------|----------|----------------|----------|\n");
            for (GcPause gcPause : sortedByPauseTime) {
                String heapChange = formatBytes(gcPause.getHeapBeforeBytes()) + " -> " + formatBytes(gcPause.getHeapAfterBytes());
                sb.append("| ")
                        .append(gcPause.getTimestamp() != null ? gcPause.getTimestamp().format(DATE_FORMATTER) : "N/A").append(" | ")
                        .append(gcPause.getGcType() != null ? gcPause.getGcType() : "N/A").append(" | ")
                        .append(gcPause.getPauseDurationMs() != null ? gcPause.getPauseDurationMs() + "ms" : "N/A").append(" | ")
                        .append(heapChange).append(" | ")
                        .append(gcPause.getSeverity() != null ? gcPause.getSeverity() : "N/A").append(" |\n");
            }
            sb.append("\n");

            // 特殊 GC 事件
            List<GcPause> specialEvents = incident.getGcPauses().stream()
                    .filter(g -> Boolean.TRUE.equals(g.getConcurrentMarkFail()) || Boolean.TRUE.equals(g.getToSpaceExhausted()))
                    .collect(Collectors.toList());
            
            if (!specialEvents.isEmpty()) {
                sb.append("### 特殊 GC 事件\n\n");
                for (GcPause gcPause : specialEvents) {
                    sb.append("- **时间**: ").append(gcPause.getTimestamp() != null ? gcPause.getTimestamp().format(DATE_FORMATTER) : "N/A").append("\n");
                    sb.append("  - **类型**: ").append(gcPause.getGcType() != null ? gcPause.getGcType() : "N/A").append("\n");
                    if (Boolean.TRUE.equals(gcPause.getConcurrentMarkFail())) {
                        sb.append("  - **Concurrent Mark Failure**: 是\n");
                    }
                    if (Boolean.TRUE.equals(gcPause.getToSpaceExhausted())) {
                        sb.append("  - **To Space Exhausted**: 是\n");
                    }
                    sb.append("\n");
                }
            }
        }

        // 锁等待链
        if (incident.getLockWaitChains() != null && !incident.getLockWaitChains().isEmpty()) {
            sb.append("## 锁等待分析\n\n");

            // 死锁检测
            List<LockWaitChain> deadlocks = incident.getLockWaitChains().stream()
                    .filter(l -> Boolean.TRUE.equals(l.getDeadlockDetected()))
                    .collect(Collectors.toList());
            
            if (!deadlocks.isEmpty()) {
                sb.append("### 检测到的死锁\n\n");
                for (LockWaitChain chain : deadlocks) {
                    sb.append("#### 死锁 ").append(chain.getId()).append("\n\n");
                    sb.append("- **时间**: ").append(chain.getTimestamp() != null ? chain.getTimestamp().format(DATE_FORMATTER) : "N/A").append("\n");
                    sb.append("- **锁名**: ").append(escapeMarkdown(chain.getLockName() != null ? chain.getLockName() : "N/A")).append("\n");
                    sb.append("- **等待线程**: ").append(escapeMarkdown(chain.getWaitingThreadName() != null ? chain.getWaitingThreadName() : "N/A")).append("\n");
                    sb.append("- **持有锁线程**: ").append(escapeMarkdown(chain.getLockOwnerThreadName() != null ? chain.getLockOwnerThreadName() : "N/A")).append("\n");
                    sb.append("\n");
                }
            }

            // 锁等待链
            List<LockWaitChain> sortedByWaitTime = incident.getLockWaitChains().stream()
                    .sorted(Comparator.comparing(l -> l.getWaitDurationMs() != null ? -l.getWaitDurationMs() : 0L))
                    .limit(10)
                    .collect(Collectors.toList());
            
            if (!sortedByWaitTime.isEmpty() && deadlocks.isEmpty()) {
                sb.append("### 按等待时间排序的 Top 10\n\n");
                sb.append("| 锁名 | 类型 | 等待线程 | 持有线程 | 等待时间 | 严重程度 |\n");
                sb.append("|------|------|----------|----------|----------|----------|\n");
                for (LockWaitChain chain : sortedByWaitTime) {
                    sb.append("| ")
                            .append(escapeMarkdown(chain.getLockName() != null ? chain.getLockName() : "N/A")).append(" | ")
                            .append(chain.getLockType() != null ? chain.getLockType() : "N/A").append(" | ")
                            .append(escapeMarkdown(chain.getWaitingThreadName() != null ? chain.getWaitingThreadName() : "N/A")).append(" | ")
                            .append(escapeMarkdown(chain.getLockOwnerThreadName() != null ? chain.getLockOwnerThreadName() : "N/A")).append(" | ")
                            .append(chain.getWaitDurationMs() != null ? chain.getWaitDurationMs() + "ms" : "N/A").append(" | ")
                            .append(chain.getSeverity() != null ? chain.getSeverity() : "N/A").append(" |\n");
                }
                sb.append("\n");
            }
        }

        // I/O 阻塞
        if (incident.getIoBlocks() != null && !incident.getIoBlocks().isEmpty()) {
            sb.append("## I/O 阻塞分析\n\n");
            
            List<IoBlock> sortedByBlockTime = incident.getIoBlocks().stream()
                    .sorted(Comparator.comparing(i -> i.getBlockDurationMs() != null ? -i.getBlockDurationMs() : 0L))
                    .limit(10)
                    .collect(Collectors.toList());
            
            sb.append("### 按阻塞时间排序的 Top 10\n\n");
            sb.append("| 资源路径 | I/O 类型 | 阻塞时间 | 传输数据 | 方法名 |\n");
            sb.append("|----------|----------|----------|----------|--------|\n");
            for (IoBlock ioBlock : sortedByBlockTime) {
                sb.append("| ")
                        .append(escapeMarkdown(ioBlock.getResourcePath() != null ? ioBlock.getResourcePath() : "N/A")).append(" | ")
                        .append(ioBlock.getIoType() != null ? ioBlock.getIoType() : "N/A").append(" | ")
                        .append(ioBlock.getBlockDurationMs() != null ? ioBlock.getBlockDurationMs() + "ms" : "N/A").append(" | ")
                        .append(formatBytes(ioBlock.getBytesTransferred())).append(" | ")
                        .append(escapeMarkdown(ioBlock.getMethodName() != null ? ioBlock.getMethodName() : "N/A")).append(" |\n");
            }
            sb.append("\n");
        }

        // 网络 RTT
        if (incident.getNetworkRtts() != null && !incident.getNetworkRtts().isEmpty()) {
            sb.append("## 网络延迟分析\n\n");
            
            List<NetworkRtt> sortedByRtt = incident.getNetworkRtts().stream()
                    .sorted(Comparator.comparing(n -> {
                        if (n.getRttMs() != null) return -n.getRttMs();
                        if (n.getRttAvgMs() != null) return -n.getRttAvgMs();
                        return 0.0;
                    }))
                    .limit(10)
                    .collect(Collectors.toList());
            
            sb.append("### 按 RTT 排序的 Top 10\n\n");
            sb.append("| 目标地址 | 协议 | RTT | 最小 | 最大 | 平均 | 丢包率 |\n");
            sb.append("|----------|------|-----|------|------|------|--------|\n");
            for (NetworkRtt rtt : sortedByRtt) {
                sb.append("| ")
                        .append(escapeMarkdown(rtt.getDestinationAddress() != null ? rtt.getDestinationAddress() : "N/A")).append(" | ")
                        .append(rtt.getProtocol() != null ? rtt.getProtocol() : "N/A").append(" | ")
                        .append(rtt.getRttMs() != null ? rtt.getRttMs() + "ms" : "N/A").append(" | ")
                        .append(rtt.getRttMinMs() != null ? rtt.getRttMinMs() + "ms" : "N/A").append(" | ")
                        .append(rtt.getRttMaxMs() != null ? rtt.getRttMaxMs() + "ms" : "N/A").append(" | ")
                        .append(rtt.getRttAvgMs() != null ? rtt.getRttAvgMs() + "ms" : "N/A").append(" | ")
                        .append(rtt.getPacketLossPercent() != null ? rtt.getPacketLossPercent() + "%" : "N/A").append(" |\n");
            }
            sb.append("\n");

            // 高丢包率的连接
            List<NetworkRtt> highLoss = incident.getNetworkRtts().stream()
                    .filter(n -> n.getPacketLossPercent() != null && n.getPacketLossPercent() > 0)
                    .sorted(Comparator.comparing(n -> -n.getPacketLossPercent()))
                    .limit(10)
                    .collect(Collectors.toList());
            
            if (!highLoss.isEmpty()) {
                sb.append("### 高丢包率连接\n\n");
                sb.append("| 目标地址 | 丢包率 | RTT 平均 | 重传次数 |\n");
                sb.append("|----------|--------|----------|----------|\n");
                for (NetworkRtt rtt : highLoss) {
                    sb.append("| ")
                            .append(escapeMarkdown(rtt.getDestinationAddress() != null ? rtt.getDestinationAddress() : "N/A")).append(" | ")
                            .append(rtt.getPacketLossPercent() + "%").append(" | ")
                            .append(rtt.getRttAvgMs() != null ? rtt.getRttAvgMs() + "ms" : "N/A").append(" | ")
                            .append(rtt.getRetransmissionCount() != null ? rtt.getRetransmissionCount().toString() : "N/A").append(" |\n");
                }
                sb.append("\n");
            }
        }

        // 慢请求
        if (incident.getSlowRequests() != null && !incident.getSlowRequests().isEmpty()) {
            sb.append("## 慢请求分析\n\n");
            
            List<SlowRequest> sortedByDuration = incident.getSlowRequests().stream()
                    .sorted(Comparator.comparing(s -> s.getTotalDurationMs() != null ? -s.getTotalDurationMs() : 0L))
                    .limit(10)
                    .collect(Collectors.toList());
            
            sb.append("### 按响应时间排序的 Top 10\n\n");
            sb.append("| 时间 | 方法 | URI | 总耗时 | 状态码 | 客户端IP |\n");
            sb.append("|------|------|-----|--------|--------|----------|\n");
            for (SlowRequest req : sortedByDuration) {
                sb.append("| ")
                        .append(req.getTimestamp() != null ? req.getTimestamp().format(DATE_FORMATTER) : "N/A").append(" | ")
                        .append(req.getHttpMethod() != null ? req.getHttpMethod() : "N/A").append(" | ")
                        .append(escapeMarkdown(req.getUri() != null ? req.getUri() : "N/A")).append(" | ")
                        .append(req.getTotalDurationMs() != null ? req.getTotalDurationMs() + "ms" : "N/A").append(" | ")
                        .append(req.getResponseStatus() != null ? req.getResponseStatus().toString() : "N/A").append(" | ")
                        .append(escapeMarkdown(req.getClientIp() != null ? req.getClientIp() : "N/A")).append(" |\n");
            }
            sb.append("\n");

            // 5xx 错误
            List<SlowRequest> serverErrors = incident.getSlowRequests().stream()
                    .filter(s -> s.getResponseStatus() != null && s.getResponseStatus() >= 500)
                    .collect(Collectors.toList());
            
            if (!serverErrors.isEmpty()) {
                sb.append("### 服务端错误 (5xx)\n\n");
                sb.append("| 时间 | 方法 | URI | 状态码 | 耗时 |\n");
                sb.append("|------|------|-----|--------|------|\n");
                for (SlowRequest req : serverErrors) {
                    sb.append("| ")
                            .append(req.getTimestamp() != null ? req.getTimestamp().format(DATE_FORMATTER) : "N/A").append(" | ")
                            .append(req.getHttpMethod() != null ? req.getHttpMethod() : "N/A").append(" | ")
                            .append(escapeMarkdown(req.getUri() != null ? req.getUri() : "N/A")).append(" | ")
                            .append(req.getResponseStatus()).append(" | ")
                            .append(req.getTotalDurationMs() != null ? req.getTotalDurationMs() + "ms" : "N/A").append(" |\n");
                }
                sb.append("\n");
            }
        }

        // 证据片段
        if (incident.getEvidenceFragments() != null && !incident.getEvidenceFragments().isEmpty()) {
            sb.append("## 关键证据片段\n\n");
            
            List<EvidenceFragment> keyEvidence = incident.getEvidenceFragments().stream()
                    .filter(e -> Boolean.TRUE.equals(e.getIsKeyEvidence()))
                    .collect(Collectors.toList());
            
            if (keyEvidence.isEmpty()) {
                keyEvidence = new ArrayList<>(incident.getEvidenceFragments());
            }
            
            keyEvidence = keyEvidence.stream()
                    .sorted(Comparator.comparing(EvidenceFragment::getTimestamp, Comparator.nullsLast(Comparator.reverseOrder())))
                    .limit(20)
                    .collect(Collectors.toList());
            
            for (int i = 0; i < keyEvidence.size(); i++) {
                EvidenceFragment fragment = keyEvidence.get(i);
                sb.append("### 证据 ").append(i + 1).append(": ")
                        .append(escapeMarkdown(fragment.getFragmentTitle() != null ? fragment.getFragmentTitle() : "未命名")).append("\n\n");
                sb.append("- **类型**: ").append(fragment.getMetricType() != null ? fragment.getMetricType() : "N/A").append("\n");
                sb.append("- **时间**: ").append(fragment.getTimestamp() != null ? fragment.getTimestamp().format(DATE_FORMATTER) : "N/A").append("\n");
                sb.append("- **来源文件**: ").append(escapeMarkdown(fragment.getSourceFile() != null ? fragment.getSourceFile() : "N/A")).append("\n");
                if (Boolean.TRUE.equals(fragment.getIsKeyEvidence())) {
                    sb.append("- **关键证据**: 是\n");
                }
                sb.append("\n");
                sb.append("```\n");
                sb.append(fragment.getFragmentContent() != null ? fragment.getFragmentContent() : "无内容");
                sb.append("\n```\n\n");
            }
        }

        // 报告生成时间
        sb.append("---\n\n");
        sb.append("*报告生成时间: ").append(java.time.LocalDateTime.now().format(DATE_FORMATTER)).append("*\n");

        return sb.toString();
    }

    public String exportToJson(Incident incident) {
        log.info("导出 JSON 报告: {}", incident.getTitle());

        try {
            Map<String, Object> report = new LinkedHashMap<>();
            
            // 基本信息
            Map<String, Object> basicInfo = new LinkedHashMap<>();
            basicInfo.put("id", incident.getId());
            basicInfo.put("title", incident.getTitle());
            basicInfo.put("description", incident.getDescription());
            basicInfo.put("incidentTime", incident.getIncidentTime());
            basicInfo.put("status", incident.getStatus());
            basicInfo.put("severity", incident.getSeverity());
            basicInfo.put("dispositionSuggestion", incident.getDispositionSuggestion());
            basicInfo.put("resolutionNotes", incident.getResolutionNotes());
            basicInfo.put("createdAt", incident.getCreatedAt());
            basicInfo.put("updatedAt", incident.getUpdatedAt());
            report.put("basicInfo", basicInfo);

            // 上传文件
            if (incident.getUploadedFiles() != null) {
                List<Map<String, Object>> files = new ArrayList<>();
                for (UploadedFile file : incident.getUploadedFiles()) {
                    Map<String, Object> fileMap = new LinkedHashMap<>();
                    fileMap.put("id", file.getId());
                    fileMap.put("fileName", file.getFileName());
                    fileMap.put("fileSize", file.getFileSize());
                    fileMap.put("fileType", file.getFileType());
                    fileMap.put("status", file.getStatus());
                    fileMap.put("parseError", file.getParseError());
                    fileMap.put("uploadedAt", file.getUploadedAt());
                    files.add(fileMap);
                }
                report.put("uploadedFiles", files);
            }

            // 统计信息
            Map<String, Object> statistics = new LinkedHashMap<>();
            statistics.put("cpuHotSpotCount", incident.getCpuHotSpots() != null ? incident.getCpuHotSpots().size() : 0);
            statistics.put("heapGrowthCount", incident.getHeapGrowths() != null ? incident.getHeapGrowths().size() : 0);
            statistics.put("gcPauseCount", incident.getGcPauses() != null ? incident.getGcPauses().size() : 0);
            statistics.put("lockWaitCount", incident.getLockWaitChains() != null ? incident.getLockWaitChains().size() : 0);
            statistics.put("ioBlockCount", incident.getIoBlocks() != null ? incident.getIoBlocks().size() : 0);
            statistics.put("networkRttCount", incident.getNetworkRtts() != null ? incident.getNetworkRtts().size() : 0);
            statistics.put("slowRequestCount", incident.getSlowRequests() != null ? incident.getSlowRequests().size() : 0);
            statistics.put("evidenceFragmentCount", incident.getEvidenceFragments() != null ? incident.getEvidenceFragments().size() : 0);
            report.put("statistics", statistics);

            // 详细数据
            if (incident.getCpuHotSpots() != null && !incident.getCpuHotSpots().isEmpty()) {
                report.put("cpuHotSpots", incident.getCpuHotSpots());
            }
            if (incident.getHeapGrowths() != null && !incident.getHeapGrowths().isEmpty()) {
                report.put("heapGrowths", incident.getHeapGrowths());
            }
            if (incident.getGcPauses() != null && !incident.getGcPauses().isEmpty()) {
                report.put("gcPauses", incident.getGcPauses());
            }
            if (incident.getLockWaitChains() != null && !incident.getLockWaitChains().isEmpty()) {
                report.put("lockWaitChains", incident.getLockWaitChains());
            }
            if (incident.getIoBlocks() != null && !incident.getIoBlocks().isEmpty()) {
                report.put("ioBlocks", incident.getIoBlocks());
            }
            if (incident.getNetworkRtts() != null && !incident.getNetworkRtts().isEmpty()) {
                report.put("networkRtts", incident.getNetworkRtts());
            }
            if (incident.getSlowRequests() != null && !incident.getSlowRequests().isEmpty()) {
                report.put("slowRequests", incident.getSlowRequests());
            }
            if (incident.getEvidenceFragments() != null && !incident.getEvidenceFragments().isEmpty()) {
                report.put("evidenceFragments", incident.getEvidenceFragments());
            }

            // 报告生成时间
            report.put("reportGeneratedAt", java.time.LocalDateTime.now());

            return objectMapper.writeValueAsString(report);
        } catch (Exception e) {
            log.error("导出 JSON 报告失败: {}", e.getMessage(), e);
            throw new RuntimeException("导出 JSON 报告失败", e);
        }
    }

    private String escapeMarkdown(String text) {
        if (text == null) return "";
        return text
                .replace("|", "\\|")
                .replace("*", "\\*")
                .replace("_", "\\_")
                .replace("`", "\\`")
                .replace("#", "\\#")
                .replace("\n", " ");
    }

    private String formatBytes(Long bytes) {
        if (bytes == null) return "N/A";
        if (bytes < 1024) return bytes + " B";
        if (bytes < 1024 * 1024) return String.format("%.2f KB", bytes / 1024.0);
        if (bytes < 1024 * 1024 * 1024) return String.format("%.2f MB", bytes / (1024.0 * 1024.0));
        return String.format("%.2f GB", bytes / (1024.0 * 1024.0 * 1024.0));
    }

    private String formatFileSize(Long bytes) {
        if (bytes == null) return "N/A";
        return formatBytes(bytes);
    }
}
